import "server-only";
import { chmod, mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { randomUUID } from "node:crypto";
import { listManagedServers, type ManagedServer } from "@/lib/servidores/store";
import { getInvoiceById } from "@/lib/facturas";
import { intentByProvisionOrderId, type ProvisionIntent } from "@/lib/provisioner/intents";
import { getVps, getVpsDetalle, ProvisionerError } from "@/lib/provisioner/client";
import { getPlanById } from "@/data/products";
import { getPublicUserById } from "@/lib/auth";
import { checkoutOrder } from "@/lib/payments/checkout";
import { readSettings } from "@/lib/ajustes";

/**
 * Renovaciones mensuales de los VPS aprovisionados (Proxmox).
 *
 * Periodo de servicio: el alta cubre UN MES desde la fecha de pago de su
 * proforma; cada renovación pagada añade otro mes al fin de periodo vigente
 * (no a la fecha de pago: pagar pronto no acorta el servicio). `diasAviso`
 * días antes del fin de periodo se emite la proforma de renovación al precio
 * ACTUAL del plan en el catálogo (manda la web) y se envía por correo.
 *
 * Política (2026-09-05): no hay suspensión automática por impago; el vencimiento
 * y las proformas pendientes quedan a la vista del cliente y del admin.
 * Interruptor en ajustes → apagado por defecto (vista previa disponible).
 *
 * Almacén `data/renovaciones-vps.jsonl` (0600): una fila por proforma emitida.
 */

const DATA_DIR = path.join(process.cwd(), "data");
const FILE = path.join(DATA_DIR, "renovaciones-vps.jsonl");
const ESTADO_FILE = path.join(DATA_DIR, "renovaciones-vps-estado.json");
/** El barrido corre como mucho una vez cada 20 h (latido cada 5 min). */
const BARRIDO_MIN_H = 20;

export type RenovacionVps = {
  id: string;
  servidorId: string;
  remoteId: number;
  userId: string;
  invoiceId: string;
  /** Periodo que cubre esta renovación (ISO). */
  periodoDesde: string;
  periodoHasta: string;
  importe: number;
  planSlug: string;
  estado: "pendiente" | "pagada" | "cancelada";
  creadoAt: string;
  pagadaAt: string | null;
};

async function readAll(): Promise<RenovacionVps[]> {
  let content: string;
  try {
    content = await readFile(FILE, "utf8");
  } catch {
    return [];
  }
  const out: RenovacionVps[] = [];
  for (const line of content.split("\n")) {
    if (!line.trim()) continue;
    try {
      const d = JSON.parse(line) as RenovacionVps;
      if (typeof d.id === "string" && typeof d.servidorId === "string") out.push(d);
    } catch {
      /* línea corrupta */
    }
  }
  return out;
}

async function writeAll(list: RenovacionVps[]): Promise<void> {
  await mkdir(DATA_DIR, { recursive: true });
  await writeFile(FILE, list.map((l) => JSON.stringify(l)).join("\n") + (list.length ? "\n" : ""), "utf8");
  await chmod(FILE, 0o600).catch(() => {});
}

/** Un mes natural después (misma hora). */
export function masUnMes(iso: string): string {
  const d = new Date(iso);
  const dia = d.getUTCDate();
  d.setUTCMonth(d.getUTCMonth() + 1);
  // 31 de enero + 1 mes → 28/29 de febrero (no 2/3 de marzo).
  if (d.getUTCDate() !== dia) d.setUTCDate(0);
  return d.toISOString();
}

/* ------------------------------ Vencimientos ------------------------------ */

export type Vencimiento = {
  ficha: ManagedServer;
  /** Fin del periodo pagado (ISO), o null si no se puede determinar. */
  periodoHasta: string | null;
  /** Renovación pendiente de pago para el siguiente periodo, si la hay. */
  pendiente: RenovacionVps | null;
  /** Origen del dato: factura de alta, renovación pagada o fecha de creación. */
  origen: "renovacion" | "alta" | "ficha";
};

/** Fin del periodo pagado de una ficha, con la renovación pendiente si existe. */
export async function vencimientoDeFicha(
  ficha: ManagedServer,
  intent?: ProvisionIntent | null,
  todas?: RenovacionVps[],
): Promise<Vencimiento> {
  const lista = (todas ?? (await readAll())).filter((r) => r.servidorId === ficha.id);
  const pagadas = lista.filter((r) => r.estado === "pagada").sort((a, b) => b.periodoHasta.localeCompare(a.periodoHasta));
  const pendiente = lista.find((r) => r.estado === "pendiente") ?? null;
  if (pagadas[0]) return { ficha, periodoHasta: pagadas[0].periodoHasta, pendiente, origen: "renovacion" };
  // Sin renovaciones: un mes desde el pago de la factura de alta.
  try {
    const it = intent === undefined ? await intentDeFicha(ficha) : intent;
    if (it) {
      const inv = await getInvoiceById(it.invoiceId);
      if (inv?.pagadaAt) return { ficha, periodoHasta: masUnMes(inv.pagadaAt), pendiente, origen: "alta" };
    }
  } catch {
    /* sin factura localizable: se cae a la fecha de creación */
  }
  return { ficha, periodoHasta: masUnMes(ficha.creadoAt), pendiente, origen: "ficha" };
}

/** El intent de alta se indexa por el order_id del provisioner, que solo trae `/detalle`. */
async function intentDeFicha(ficha: ManagedServer): Promise<ProvisionIntent | null> {
  try {
    const d = await getVpsDetalle(ficha.remoteId);
    return await intentByProvisionOrderId(d.order_id);
  } catch {
    return null; // provisioner caído: se cae a la fecha de creación de la ficha
  }
}

/** Vencimientos de todos los VPS Proxmox con cliente (para el admin y el barrido). */
export async function listarVencimientos(): Promise<Vencimiento[]> {
  const fichas = (await listManagedServers()).filter((f) => f.proveedor === "proxmox" && f.userId);
  const todas = await readAll();
  const out: Vencimiento[] = [];
  for (const f of fichas) out.push(await vencimientoDeFicha(f, undefined, todas));
  return out.sort((a, b) => (a.periodoHasta ?? "").localeCompare(b.periodoHasta ?? ""));
}

/* --------------------------------- Barrido -------------------------------- */

type EstadoBarrido = { lastSweepAt: string | null };

async function leerEstado(): Promise<EstadoBarrido> {
  try {
    const o = JSON.parse(await readFile(ESTADO_FILE, "utf8")) as Partial<EstadoBarrido>;
    return { lastSweepAt: typeof o.lastSweepAt === "string" ? o.lastSweepAt : null };
  } catch {
    return { lastSweepAt: null };
  }
}

async function guardarEstado(e: EstadoBarrido): Promise<void> {
  await mkdir(DATA_DIR, { recursive: true });
  await writeFile(ESTADO_FILE, JSON.stringify(e, null, 2), { encoding: "utf8", mode: 0o600 });
  await chmod(ESTADO_FILE, 0o600).catch(() => {});
}

/** Latido (cada 5 min): barre como mucho una vez cada 20 h y solo si está encendido. Nunca lanza. */
export async function comprobarRenovacionesVps(): Promise<void> {
  try {
    const { renovaciones } = await readSettings();
    if (!renovaciones.enabled) return;
    const estado = await leerEstado();
    const horas = estado.lastSweepAt ? (Date.now() - Date.parse(estado.lastSweepAt)) / 3_600_000 : Infinity;
    if (horas < BARRIDO_MIN_H) return;
    await guardarEstado({ lastSweepAt: new Date().toISOString() });
    const n = await barrerRenovacionesVps(renovaciones.diasAviso);
    if (n > 0) console.info(`[renovaciones] ${n} proforma(s) de renovación de VPS emitidas`);
  } catch (err) {
    console.error("[renovaciones] fallo en el latido:", err);
  }
}

/**
 * Emite la proforma de renovación de cada VPS cuyo periodo termina en
 * `diasAviso` días o menos (o ya terminó) y que no tenga ya una pendiente.
 * Devuelve cuántas emitió. `soloVista` no emite: devuelve las candidatas.
 */
export async function barrerRenovacionesVps(diasAviso: number, soloVista = false): Promise<number> {
  const candidatas = await candidatasARenovar(diasAviso);
  if (soloVista) return candidatas.length;
  let emitidas = 0;
  for (const c of candidatas) {
    try {
      await emitirRenovacion(c);
      emitidas++;
    } catch (err) {
      console.error(`[renovaciones] no se pudo emitir la renovación de ${c.ficha.id}:`, err instanceof ProvisionerError ? err.message : err);
    }
  }
  return emitidas;
}

export async function candidatasARenovar(diasAviso: number): Promise<Vencimiento[]> {
  const ahora = Date.now();
  const out: Vencimiento[] = [];
  for (const v of await listarVencimientos()) {
    if (!v.periodoHasta || v.pendiente) continue;
    const dias = (Date.parse(v.periodoHasta) - ahora) / 86_400_000;
    if (dias <= diasAviso) out.push(v);
  }
  return out;
}

async function emitirRenovacion(v: Vencimiento): Promise<RenovacionVps> {
  const ficha = v.ficha;
  if (!ficha.userId || !v.periodoHasta) throw new Error("ficha sin cliente o sin periodo");
  const [user, vps] = await Promise.all([getPublicUserById(ficha.userId), getVps(ficha.remoteId)]);
  if (!user) throw new Error("cliente no encontrado");
  if (vps.estado === "destroyed") throw new Error("vps destruido");
  if (!vps.plan_slug) throw new Error("vps sin plan");
  const located = await getPlanById(vps.plan_slug, "en");
  if (!located) throw new Error(`plan ${vps.plan_slug} no está en el catálogo`);
  const precio = located.plan.price;
  const nombre = vps.hostname || ficha.etiqueta || `vps-${vps.vmid}`;
  const desde = v.periodoHasta;
  const hasta = masUnMes(desde);
  const fmt = (iso: string) => iso.slice(0, 10);
  const { invoice } = await checkoutOrder({
    userId: ficha.userId,
    clienteNombre: [user.nombre, user.apellidos].filter(Boolean).join(" ") || user.email,
    clienteEmail: user.email,
    lineas: [
      {
        concepto: `Renewal ${located.plan.name} · ${nombre}`,
        descripcion: `Service period ${fmt(desde)} → ${fmt(hasta)} (monthly)`,
        cantidad: 1,
        precioUnitario: precio,
        productId: vps.plan_slug,
      },
    ],
    metodo: "transferencia",
    locale: "es",
    cancelPath: "/cuenta/servidores",
  });
  const r: RenovacionVps = {
    id: randomUUID(),
    servidorId: ficha.id,
    remoteId: ficha.remoteId,
    userId: ficha.userId,
    invoiceId: invoice.id,
    periodoDesde: desde,
    periodoHasta: hasta,
    importe: precio,
    planSlug: vps.plan_slug,
    estado: "pendiente",
    creadoAt: new Date().toISOString(),
    pagadaAt: null,
  };
  const list = await readAll();
  await writeAll([...list, r]);
  console.info(`[renovaciones] proforma ${invoice.numero} emitida para ${nombre} (${fmt(desde)} → ${fmt(hasta)}, ${precio} €)`);
  return r;
}

/* ------------------------------- Al cobrar -------------------------------- */

/** Marca pagadas las renovaciones cobradas por una factura. Idempotente; nunca lanza. */
export async function aplicarRenovacionesFacturaPagada(invoiceId: string): Promise<void> {
  try {
    const list = await readAll();
    let cambiado = false;
    const next = list.map((r) => {
      if (r.invoiceId !== invoiceId || r.estado !== "pendiente") return r;
      cambiado = true;
      return { ...r, estado: "pagada" as const, pagadaAt: new Date().toISOString() };
    });
    if (cambiado) {
      await writeAll(next);
      console.info("[renovaciones] renovación cobrada:", invoiceId);
    }
  } catch (err) {
    console.error("[renovaciones] no se pudo marcar la renovación pagada:", invoiceId, err);
  }
}

/** Si el admin cancela la proforma, la renovación deja de contar como pendiente. */
export async function cancelarRenovacionesFactura(invoiceId: string): Promise<void> {
  try {
    const list = await readAll();
    await writeAll(list.map((r) => (r.invoiceId === invoiceId && r.estado === "pendiente" ? { ...r, estado: "cancelada" as const } : r)));
  } catch (err) {
    console.error("[renovaciones] no se pudo cancelar la renovación:", invoiceId, err);
  }
}
