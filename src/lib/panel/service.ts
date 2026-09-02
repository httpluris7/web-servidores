import "server-only";
import { getManagedForUser } from "@/lib/servidores/cliente";
import { getVpsDetalle, type VpsDetalle } from "@/lib/provisioner/client";
import { intentByProvisionOrderId } from "@/lib/provisioner/intents";
import { getInvoiceById, PAYMENT_METHOD_LABEL, type Invoice } from "@/lib/facturas";
import { leerMetricas, type Muestra } from "@/lib/servidores/metricas";
import { readCatalogo, texto } from "@/lib/catalogo/store";
import type { ManagedServer } from "@/lib/servidores/store";
import type { PanelService, PowerState, ServiceIp, ServiceStatus, Usage } from "./types";

/**
 * Construye la ficha del panel de un servicio con DATOS REALES (Fase 2).
 *
 * Fuentes, en modo HÍBRIDO:
 *  - Provisioner (`/vps/:id/detalle`): base, estado del hipervisor, red, plan.
 *  - Agente dentro del VPS (métricas): uso real de CPU/memoria/swap/disco y
 *    tráfico del mes. Cuando hay una muestra reciente, MANDA sobre lo que ve el
 *    hipervisor (Proxmox no ve el disco/swap del guest en QEMU).
 *  - Factura enlazada (por el pedido del provisioner): cabecera comercial.
 *
 * Pertenencia: `getManagedForUser` es el único punto de comprobación, igual que
 * el resto del área de cliente. Un servicio ajeno o que no sea de nuestro Proxmox
 * devuelve null (la pantalla lo trata como inexistente).
 *
 * `server-only`: nunca entra en el bundle del cliente.
 */

/** El provisioner no respondió: la pantalla muestra un aviso, no datos a medias. */
export class PanelUnavailableError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "PanelUnavailableError";
  }
}

export async function getPanelServiceForUser(
  id: string,
  userId: string,
  locale: string,
): Promise<PanelService | null> {
  const managed = await getManagedForUser(id, userId);
  if (!managed || managed.proveedor !== "proxmox") return null;

  let d: VpsDetalle;
  try {
    d = await getVpsDetalle(managed.remoteId);
  } catch (err) {
    throw new PanelUnavailableError((err as Error).message);
  }

  const [agente, factura, nombres] = await Promise.all([
    muestraReciente(managed),
    facturaDeVps(d.order_id),
    nombresCatalogo(d.plan_slug, locale),
  ]);

  return construir(managed, d, agente, factura, nombres);
}

/* -------------------------------- Fuentes --------------------------------- */

/** Última muestra del agente si hay agente activo y es reciente (<15 min). */
async function muestraReciente(m: ManagedServer): Promise<Muestra | null> {
  if (m.agenteTokenHash === null) return null;
  try {
    const serie = await leerMetricas(m.id, "1h");
    const u = serie.ultima;
    if (!u) return null;
    return Date.now() / 1000 - u.t < 15 * 60 ? u : null;
  } catch {
    return null;
  }
}

/** Factura enlazada al VPS (vía la intención de aprovisionamiento). */
async function facturaDeVps(orderId: number): Promise<Invoice | null> {
  try {
    const intent = await intentByProvisionOrderId(orderId);
    if (!intent) return null;
    return await getInvoiceById(intent.invoiceId);
  } catch {
    return null;
  }
}

/** Producto y plan legibles desde el catálogo (por el slug del plan). */
async function nombresCatalogo(
  planSlug: string | null,
  locale: string,
): Promise<{ producto: string | null; plan: string | null }> {
  if (!planSlug) return { producto: null, plan: null };
  try {
    const cat = await readCatalogo();
    const prod = cat.productos.find((p) => p.planId === planSlug);
    if (!prod) return { producto: null, plan: planSlug };
    const categoria = cat.categorias.find((c) => c.id === prod.categoriaId);
    return { producto: categoria ? texto(categoria.nombre, locale) : null, plan: prod.nombre };
  } catch {
    return { producto: null, plan: planSlug };
  }
}

/* -------------------------------- Ensamblaje ------------------------------ */

const MB = 1024 * 1024;
const GB = 1024 * 1024 * 1024;

function construir(
  m: ManagedServer,
  d: VpsDetalle,
  a: Muestra | null,
  inv: Invoice | null,
  nombres: { producto: string | null; plan: string | null },
): PanelService {
  const live = d.live;
  const running = live?.status === "running" || (live == null && d.estado === "running");
  const power: PowerState =
    d.estado === "suspended" ? "suspendido" : running ? "encendido" : "apagado";
  const status: ServiceStatus =
    inv?.estado === "cancelada" || d.estado === "destroyed"
      ? "cancelado"
      : d.estado === "suspended"
        ? "suspendido"
        : "activo";

  // CPU %: agente (guest) > hipervisor.
  const cpu: Usage = { usado: a?.cpu ?? live?.cpu_pct ?? null, total: 100, unidad: "pct" };

  // Memoria MB: agente > hipervisor (bytes → MB) > tamaño del plan.
  const memUsadaMb =
    a?.memUsadaMb ?? (live?.mem_bytes != null ? Math.round(live.mem_bytes / MB) : null);
  const memTotalMb =
    a?.memTotalMb ??
    (live?.maxmem_bytes != null ? Math.round(live.maxmem_bytes / MB) : d.ram_mb);
  const memoria: Usage = { usado: memUsadaMb, total: memTotalMb, unidad: "mb" };

  // Swap %: solo el agente lo ve.
  const swap: Usage = { usado: a?.swapPct ?? null, total: a ? 100 : null, unidad: "pct" };

  // Disco GB: uso solo del agente; total del agente, o del plan, o del hipervisor.
  const discoTotal =
    a?.discoTotalGb ??
    d.disco_gb ??
    (live?.maxdisk_bytes != null ? Math.round(live.maxdisk_bytes / GB) : null);
  const disco: Usage = { usado: a?.discoUsadoGb ?? null, total: discoTotal, unidad: "gb" };

  // Ancho de banda consumido: acumulado rx+tx del agente; sin tope → total null.
  const bwBytes =
    a && (a.rxTotal != null || a.txTotal != null) ? (a.rxTotal ?? 0) + (a.txTotal ?? 0) : null;
  const anchoBanda: Usage = {
    usado: bwBytes != null ? Math.round((bwBytes / GB) * 10) / 10 : null,
    total: null,
    unidad: "gb",
  };

  // Red: IPv4 (y IPv6 si existiera). Máscara desde el prefijo CIDR.
  const ips: ServiceIp[] = [];
  if (d.red) {
    ips.push({
      version: 4,
      address: d.red.ip,
      mac: d.red.mac ?? "—",
      netmask: d.red.cidr != null ? cidrToMask(d.red.cidr) : "—",
      gateway: d.red.gateway ?? "—",
    });
    if (d.red.ipv6) {
      ips.push({ version: 6, address: d.red.ipv6, mac: d.red.mac ?? "—", netmask: "/64", gateway: "—" });
    }
  }

  const importeEur = inv?.total ?? (d.precio_mes_eur != null ? d.precio_mes_eur / 100 : 0);

  return {
    id: m.id,
    producto: nombres.producto ?? "VPS",
    plan: nombres.plan ?? d.plan_slug ?? "—",
    status,
    power,
    altaAt: inv?.emitidaAt ?? d.creado ?? "",
    importeEur,
    ciclo: "mensual",
    vencimientoAt: inv?.vencimientoAt ?? "",
    metodoPago: inv?.metodoPago ? PAYMENT_METHOD_LABEL[inv.metodoPago] : "",
    nodo: d.node_nombre,
    nombre: d.hostname || m.etiqueta || `vps-${d.vmid}`,
    password: null,
    passwordManaged: true,
    uptimeSec: a?.uptime ?? live?.uptime_s ?? 0,
    creadoAt: d.creado,
    descripcion: m.etiqueta || "",
    cpu,
    cores: d.vcores ?? live?.cpus ?? null,
    memoria,
    swap,
    disco,
    backupsLimite: null,
    tasaRedMbps: d.config.net_rate_mbps,
    iso: d.config.iso,
    ordenArranque: d.config.boot_order ?? "—",
    anchoBanda,
    ips,
    agenteActivo: m.agenteTokenHash !== null,
  };
}

/** Prefijo CIDR (0–32) → máscara con puntos (24 → 255.255.255.0). */
function cidrToMask(cidr: number): string {
  if (cidr < 0 || cidr > 32) return "—";
  const mask = cidr === 0 ? 0 : (0xffffffff << (32 - cidr)) >>> 0;
  return [24, 16, 8, 0].map((s) => (mask >>> s) & 0xff).join(".");
}
