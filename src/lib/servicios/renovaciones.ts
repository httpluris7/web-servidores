import "server-only";
import { chmod, mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { randomUUID } from "node:crypto";
import { listManagedServers, type ManagedServer } from "@/lib/servidores/store";
import { getInvoiceById, setInvoiceStatus } from "@/lib/facturas";
import { intentByProvisionOrderId, type ProvisionIntent } from "@/lib/provisioner/intents";
import { deleteVps, getVps, getVpsDetalle, vpsAction, ProvisionerError } from "@/lib/provisioner/client";
import { getPlanById } from "@/data/products";
import { getPublicUserById } from "@/lib/auth";
import { checkoutOrder } from "@/lib/payments/checkout";
import { readSettings } from "@/lib/ajustes";
import { sendServiceNoticeMail } from "@/lib/mail";

/**
 * Renovaciones mensuales de los VPS aprovisionados (Proxmox).
 *
 * Periodo de servicio: el alta cubre UN MES desde la fecha de pago de su
 * proforma; cada renovación pagada añade otro mes al fin de periodo vigente
 * (no a la fecha de pago: pagar pronto no acorta el servicio). `diasAviso`
 * días antes del fin de periodo se emite la proforma de renovación al precio
 * ACTUAL del plan en el catálogo (manda la web) y se envía por correo.
 *
 * Impago (decisión del usuario, 2026-09-05): al VENCER el periodo sin pagar se
 * envía un correo de aviso; `diasGracia` días después del vencimiento, si la
 * proforma sigue sin pagar (y lleva al menos esos días emitida), el servicio
 * se suspende (parada en frío) y se BORRA: la VM se destruye, la IP vuelve al
 * pool y la proforma se cancela. Es irreversible; se avisa por correo.
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
  /** Cuándo se avisó al cliente de que el periodo venció sin pagar. */
  avisoVencidoAt?: string | null;
  /** Cuándo se suspendió y borró el servicio por impago. */
  borradoAt?: string | null;
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
    const r = await procesarImpagos(renovaciones.diasGracia, renovaciones.borrarImpagados);
    if (r.avisados || r.borrados) console.info(`[renovaciones] impagos: ${r.avisados} avisados, ${r.borrados} borrados`);
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

/* --------------------------------- Impagos -------------------------------- */

const DIA_MS = 86_400_000;

/**
 * Vencidos sin pagar: (1) un único correo de aviso al vencer; (2) pasados
 * `diasGracia` días desde el vencimiento —y desde la emisión de la proforma,
 * para que el cliente haya tenido ese margen real— se para y se destruye la VM,
 * se cancela la proforma y se avisa. Devuelve cuántos avisos y borrados.
 */
export async function procesarImpagos(
  diasGracia: number,
  borrar: boolean,
  ahora = Date.now(),
): Promise<{ avisados: number; borrados: number }> {
  let avisados = 0;
  let borrados = 0;
  const vencimientos = await listarVencimientos();
  for (const v of vencimientos) {
    const pend = v.pendiente;
    if (!pend || !v.periodoHasta || !v.ficha.userId) continue;
    const vencidoMs = ahora - Date.parse(v.periodoHasta);
    if (vencidoMs < 0) continue; // aún dentro del periodo pagado
    const emitidaMs = ahora - Date.parse(pend.creadoAt);
    const user = await getPublicUserById(v.ficha.userId).catch(() => null);
    if (!user) continue;
    const inv = await getInvoiceById(pend.invoiceId).catch(() => null);
    if (!inv || inv.estado !== "pendiente") continue; // pagada/cancelada entretanto: los ganchos ya la marcan
    const nombre = await nombreDe(v.ficha);

    if (!pend.avisoVencidoAt) {
      const limite = new Date(Date.parse(v.periodoHasta) + diasGracia * DIA_MS);
      try {
        await sendServiceNoticeMail({
          to: user.email,
          asunto: `Servicio vencido sin pagar: ${nombre} / Service expired: ${nombre}`,
          cuerpo: [
            `Hola ${user.nombre || ""},`.trim(),
            "",
            `El periodo de tu servidor ${nombre} terminó el ${fecha(v.periodoHasta)} y la proforma de renovación ${inv.numero} (${inv.total.toFixed(2)} €) sigue sin pagar.`,
            borrar
              ? `Si no se recibe el pago antes del ${fecha(limite.toISOString())}, el servidor se suspenderá y se ELIMINARÁ automáticamente con todos sus datos. Esta acción no se puede deshacer.`
              : "Paga la proforma para mantener el servicio activo.",
            "",
            "Puedes pagar desde tu área de cliente: https://viahost.top/es/cuenta/facturas",
            "",
            "— — —",
            "",
            `Hi ${user.nombre || ""},`.trim(),
            "",
            `The service period of your server ${nombre} ended on ${fecha(v.periodoHasta)} and the renewal proforma ${inv.numero} (€${inv.total.toFixed(2)}) is still unpaid.`,
            borrar
              ? `If payment is not received before ${fecha(limite.toISOString())}, the server will be suspended and DELETED automatically with all its data. This cannot be undone.`
              : "Please pay the proforma to keep the service active.",
            "",
            "Pay from your client area: https://viahost.top/cuenta/facturas",
            "",
            "ViaHost · soporte@viahost.top",
          ].join("\n"),
        });
        await marcarRenovacion(pend.id, { avisoVencidoAt: new Date(ahora).toISOString() });
        avisados++;
        console.info(`[renovaciones] aviso de vencimiento enviado: ${nombre} (${inv.numero})`);
      } catch (err) {
        console.error(`[renovaciones] no se pudo avisar del vencimiento de ${nombre}:`, err);
      }
      continue; // el borrado nunca va en el mismo barrido que el aviso
    }

    if (!borrar) continue;
    if (vencidoMs < diasGracia * DIA_MS || emitidaMs < diasGracia * DIA_MS) continue;

    try {
      // Suspender (parada en frío, best-effort) y destruir: VM + IP al pool.
      await vpsAction(v.ficha.remoteId, "stop").catch(() => {});
      await deleteVps(v.ficha.remoteId);
      await setInvoiceStatus(inv.id, "cancelada");
      await marcarRenovacion(pend.id, { estado: "cancelada", borradoAt: new Date(ahora).toISOString() });
      borrados++;
      console.warn(`[renovaciones] SERVICIO BORRADO por impago: ${nombre} (ficha ${v.ficha.id}, vps ${v.ficha.remoteId}, ${inv.numero})`);
      try {
        await sendServiceNoticeMail({
          to: user.email,
          asunto: `Servicio eliminado por impago: ${nombre} / Service deleted: ${nombre}`,
          cuerpo: [
            `Hola ${user.nombre || ""},`.trim(),
            "",
            `El servidor ${nombre} venció el ${fecha(v.periodoHasta)} y, pasados ${diasGracia} días sin recibir el pago de la proforma ${inv.numero}, ha sido suspendido y eliminado junto con sus datos. La proforma queda cancelada.`,
            "Si quieres volver a contratar un servidor: https://viahost.top/es/vps",
            "",
            "— — —",
            "",
            `Hi ${user.nombre || ""},`.trim(),
            "",
            `Your server ${nombre} expired on ${fecha(v.periodoHasta)} and, ${diasGracia} days later with proforma ${inv.numero} still unpaid, it has been suspended and deleted together with its data. The proforma is now cancelled.`,
            "To order a new server: https://viahost.top/vps",
            "",
            "ViaHost · soporte@viahost.top",
          ].join("\n"),
        });
      } catch (err) {
        console.error("[renovaciones] no se pudo avisar del borrado:", err);
      }
    } catch (err) {
      console.error(`[renovaciones] no se pudo borrar ${nombre} por impago:`, err instanceof ProvisionerError ? err.message : err);
    }
  }
  return { avisados, borrados };
}

async function marcarRenovacion(id: string, patch: Partial<RenovacionVps>): Promise<void> {
  const list = await readAll();
  await writeAll(list.map((r) => (r.id === id ? { ...r, ...patch } : r)));
}

async function nombreDe(ficha: ManagedServer): Promise<string> {
  try {
    const v = await getVps(ficha.remoteId);
    return v.hostname || ficha.etiqueta || `vps-${v.vmid}`;
  } catch {
    return ficha.etiqueta || `vps #${ficha.remoteId}`;
  }
}

const fecha = (iso: string): string => iso.slice(0, 10);
