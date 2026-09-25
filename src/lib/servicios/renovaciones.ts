import "server-only";
import { chmod, mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { randomUUID } from "node:crypto";
import { listManagedServers, updateManaged, type ManagedServer, type ServerProvider } from "@/lib/servidores/store";
import { providerConfig } from "@/lib/servidores/inventario";
import { stopServer } from "@/lib/servidores/v4vm";
import { getInvoiceById, setInvoiceStatus } from "@/lib/facturas";
import { intentByProvisionOrderId, type ProvisionIntent } from "@/lib/provisioner/intents";
import { deleteVps, getVps, getVpsDetalle, vpsAction, ProvisionerError } from "@/lib/provisioner/client";
import { cuentasHostingActivas, marcarHostingTerminado, type HostingIntent } from "@/lib/hosting/intents";
import { removeAccount, suspendAccount, WhmError } from "@/lib/hosting/whm";
import { getPlanById } from "@/data/products";
import { getPublicUserById } from "@/lib/auth";
import { checkoutOrder } from "@/lib/payments/checkout";
import { readSettings } from "@/lib/ajustes";
import { ALERT_FALLBACK_MAILBOX, sendServiceNoticeMail } from "@/lib/mail";
import { emailRe } from "@/lib/leads";

/**
 * Renovaciones mensuales de los servicios aprovisionados: VPS (Proxmox), VPS
 * del proveedor v4vm y cuentas de hosting (cPanel/WHM).
 *
 * Los VPS de v4vm no tienen plan en el catálogo: su precio mensual es el
 * `importe` del último registro de renovación de la ficha (el alta se siembra a
 * mano con ese importe) y, por impago, se PARAN en v4vm pero no se borran (el
 * proveedor no expone borrado por API): el borrado queda para el administrador.
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
 * se suspende y se BORRA: la VM se destruye (IP al pool) o la cuenta de cPanel
 * se suspende y elimina; la proforma se cancela. Irreversible; se avisa.
 *
 * Almacén `data/renovaciones-vps.jsonl` (0600): una fila por proforma emitida.
 */

const DATA_DIR = path.join(process.cwd(), "data");
const FILE = path.join(DATA_DIR, "renovaciones-vps.jsonl");
const ESTADO_FILE = path.join(DATA_DIR, "renovaciones-vps-estado.json");
/** El barrido corre como mucho una vez cada 20 h (latido cada 5 min). */
const BARRIDO_MIN_H = 20;
const DIA_MS = 86_400_000;

export type TipoServicio = "vps" | "hosting";

export type RenovacionVps = {
  id: string;
  tipo: TipoServicio;
  /** Ficha del VPS (id interno) o `hosting:<usuario cPanel>`. */
  servidorId: string;
  /** Id del VPS en el provisioner (0 en hosting). */
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
  /** Nombre del plan a mostrar (VPS de v4vm, sin plan en el catálogo). */
  planNombre?: string;
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
      if (typeof d.id === "string" && typeof d.servidorId === "string") out.push({ ...d, tipo: d.tipo === "hosting" ? "hosting" : "vps" });
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

async function marcarRenovacion(id: string, patch: Partial<RenovacionVps>): Promise<void> {
  const list = await readAll();
  await writeAll(list.map((r) => (r.id === id ? { ...r, ...patch } : r)));
}

export { masUnMes } from "./periodo";
import { masUnMes } from "./periodo";

const fecha = (iso: string): string => iso.slice(0, 10);

/* ------------------------------ Vencimientos ------------------------------ */

/** Servicio renovable: un VPS con cliente o una cuenta de hosting creada. */
export type Servicio =
  | { tipo: "vps"; id: string; userId: string; remoteId: number; etiqueta: string; proveedor: ServerProvider; ficha: ManagedServer }
  | { tipo: "hosting"; id: string; userId: string; remoteId: 0; etiqueta: string; cuenta: HostingIntent };

export type Vencimiento = {
  servicio: Servicio;
  /** Fin del periodo pagado (ISO), o null si no se puede determinar. */
  periodoHasta: string | null;
  /** Renovación pendiente de pago para el siguiente periodo, si la hay. */
  pendiente: RenovacionVps | null;
  /** Origen del dato: renovación pagada, factura de alta o fecha de creación. */
  origen: "renovacion" | "alta" | "ficha";
};

/** Fichas cuyo servicio renueva ViaHost: nuestro Proxmox y el proveedor v4vm. */
function esRenovable(f: ManagedServer): boolean {
  return f.proveedor === "proxmox" || f.proveedor === "v4vm";
}

function servicioDeFicha(ficha: ManagedServer): Servicio {
  return { tipo: "vps", id: ficha.id, userId: ficha.userId ?? "", remoteId: ficha.remoteId, etiqueta: ficha.etiqueta, proveedor: ficha.proveedor, ficha };
}

function servicioDeCuenta(c: HostingIntent): Servicio {
  return { tipo: "hosting", id: `hosting:${c.cpanelUser}`, userId: c.userId ?? "", remoteId: 0, etiqueta: c.domain ?? c.cpanelUser ?? "", cuenta: c };
}

async function vencimientoDe(s: Servicio, todas: RenovacionVps[], intent?: ProvisionIntent | null): Promise<Vencimiento> {
  const lista = todas.filter((r) => r.servidorId === s.id);
  const pagadas = lista.filter((r) => r.estado === "pagada").sort((a, b) => b.periodoHasta.localeCompare(a.periodoHasta));
  const pendiente = lista.find((r) => r.estado === "pendiente") ?? null;
  if (pagadas[0]) return { servicio: s, periodoHasta: pagadas[0].periodoHasta, pendiente, origen: "renovacion" };
  // Sin renovaciones: un mes desde el pago de la factura de alta.
  try {
    const invoiceId =
      s.tipo === "hosting"
        ? s.cuenta.invoiceId
        : s.proveedor !== "proxmox"
          ? undefined // v4vm: sin intent de alta; su periodo viene siempre de un registro de renovación
          : (intent === undefined ? await intentDeFicha(s.ficha) : intent)?.invoiceId;
    if (invoiceId) {
      const inv = await getInvoiceById(invoiceId);
      if (inv?.pagadaAt) return { servicio: s, periodoHasta: masUnMes(inv.pagadaAt), pendiente, origen: "alta" };
    }
  } catch {
    /* sin factura localizable: se cae a la fecha de creación */
  }
  // Un VPS de v4vm sin registro de renovación no está gestionado por este
  // módulo (ni precio ni periodo): no se le inventa un vencimiento ni se le
  // emite nada. Entra cuando el administrador siembra su primer registro.
  if (s.tipo === "vps" && s.proveedor === "v4vm") {
    return { servicio: s, periodoHasta: null, pendiente, origen: "ficha" };
  }
  const creado = s.tipo === "hosting" ? s.cuenta.creadoAt : s.ficha.creadoAt;
  return { servicio: s, periodoHasta: creado ? masUnMes(creado) : null, pendiente, origen: "ficha" };
}

/** Fin del periodo pagado de una ficha de VPS (lo usa el panel de cliente). */
export async function vencimientoDeFicha(ficha: ManagedServer, intent?: ProvisionIntent | null): Promise<Vencimiento> {
  return vencimientoDe(servicioDeFicha(ficha), await readAll(), intent);
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

/** Resumen por servicio para el área de cliente: fin de periodo y renovación pendiente. */
export type ResumenRenovacion = { periodoHasta: string | null; pendiente: { invoiceId: string; importe: number } | null };

export async function vencimientosDeUsuario(userId: string): Promise<Map<string, ResumenRenovacion>> {
  const out = new Map<string, ResumenRenovacion>();
  if (!userId) return out;
  try {
    const todas = await readAll();
    const fichas = (await listManagedServers()).filter((f) => esRenovable(f) && f.userId === userId);
    const cuentas = (await cuentasHostingActivas()).filter((c) => c.userId === userId);
    for (const s of [...fichas.map(servicioDeFicha), ...cuentas.map(servicioDeCuenta)]) {
      const v = await vencimientoDe(s, todas);
      out.set(s.id, { periodoHasta: v.periodoHasta, pendiente: v.pendiente ? { invoiceId: v.pendiente.invoiceId, importe: v.pendiente.importe } : null });
    }
  } catch (err) {
    console.error("[renovaciones] vencimientos de usuario:", err);
  }
  return out;
}

/** Vencimientos de todos los servicios con cliente (admin y barrido). */
export async function listarVencimientos(): Promise<Vencimiento[]> {
  const fichas = (await listManagedServers()).filter((f) => esRenovable(f) && f.userId);
  const cuentas = (await cuentasHostingActivas()).filter((c) => c.userId);
  const todas = await readAll();
  const out: Vencimiento[] = [];
  for (const f of fichas) out.push(await vencimientoDe(servicioDeFicha(f), todas));
  for (const c of cuentas) out.push(await vencimientoDe(servicioDeCuenta(c), todas));
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
    if (n > 0) console.info(`[renovaciones] ${n} proforma(s) de renovación emitidas`);
    const r = await procesarImpagos(renovaciones.diasGracia, renovaciones.borrarImpagados);
    if (r.avisados || r.borrados) console.info(`[renovaciones] impagos: ${r.avisados} avisados, ${r.borrados} borrados`);
    await notificarAdmin({ emitidas: n, ...r });
  } catch (err) {
    console.error("[renovaciones] fallo en el latido:", err);
  }
}

/**
 * Emite la proforma de renovación de cada servicio cuyo periodo termina en
 * `diasAviso` días o menos (o ya terminó) y que no tenga ya una pendiente.
 * Devuelve cuántas emitió.
 */
export async function barrerRenovacionesVps(diasAviso: number): Promise<number> {
  const candidatas = await candidatasARenovar(diasAviso);
  let emitidas = 0;
  for (const c of candidatas) {
    try {
      await emitirRenovacion(c);
      emitidas++;
    } catch (err) {
      console.error(`[renovaciones] no se pudo emitir la renovación de ${c.servicio.id}:`, err instanceof ProvisionerError ? err.message : err);
    }
  }
  return emitidas;
}

export async function candidatasARenovar(diasAviso: number): Promise<Vencimiento[]> {
  const ahora = Date.now();
  const out: Vencimiento[] = [];
  for (const v of await listarVencimientos()) {
    if (!v.periodoHasta || v.pendiente) continue;
    const dias = (Date.parse(v.periodoHasta) - ahora) / DIA_MS;
    if (dias <= diasAviso) out.push(v);
  }
  return out;
}

/** Plan, precio y nombre legible del servicio (VPS: plan vigente del provisioner). */
async function planYNombre(s: Servicio): Promise<{ planSlug: string; precio: number; planNombre: string; nombre: string }> {
  if (s.tipo === "hosting") {
    const located = await getPlanById(s.cuenta.planId, "en");
    if (!located) throw new Error(`plan ${s.cuenta.planId} no está en el catálogo`);
    return { planSlug: s.cuenta.planId, precio: located.plan.price, planNombre: located.plan.name, nombre: s.cuenta.domain ?? s.cuenta.cpanelUser ?? "hosting" };
  }
  if (s.proveedor === "v4vm") {
    // Sin plan en el catálogo: manda el último registro de renovación de la ficha.
    const ultimo = (await readAll())
      .filter((r) => r.servidorId === s.id && r.estado !== "cancelada")
      .sort((a, b) => b.creadoAt.localeCompare(a.creadoAt))[0];
    if (!ultimo || !(ultimo.importe > 0)) throw new Error("vps de v4vm sin precio de renovación registrado");
    return { planSlug: ultimo.planSlug, precio: ultimo.importe, planNombre: ultimo.planNombre ?? "VPS", nombre: s.etiqueta || `vps #${s.remoteId}` };
  }
  const vps = await getVps(s.remoteId);
  if (vps.estado === "destroyed") throw new Error("vps destruido");
  if (!vps.plan_slug) throw new Error("vps sin plan");
  const located = await getPlanById(vps.plan_slug, "en");
  if (!located) throw new Error(`plan ${vps.plan_slug} no está en el catálogo`);
  return { planSlug: vps.plan_slug, precio: located.plan.price, planNombre: located.plan.name, nombre: vps.hostname || s.etiqueta || `vps-${vps.vmid}` };
}

async function emitirRenovacion(v: Vencimiento): Promise<RenovacionVps> {
  const s = v.servicio;
  if (!s.userId || !v.periodoHasta) throw new Error("servicio sin cliente o sin periodo");
  const [user, info] = await Promise.all([getPublicUserById(s.userId), planYNombre(s)]);
  if (!user) throw new Error("cliente no encontrado");
  const desde = v.periodoHasta;
  const hasta = masUnMes(desde);
  const { invoice } = await checkoutOrder({
    userId: s.userId,
    clienteNombre: [user.nombre, user.apellidos].filter(Boolean).join(" ") || user.email,
    clienteEmail: user.email,
    lineas: [
      {
        concepto: `Renewal ${info.planNombre} · ${info.nombre}`,
        descripcion: `Service period ${fecha(desde)} → ${fecha(hasta)} (monthly)`,
        cantidad: 1,
        precioUnitario: info.precio,
        // Prefijo como en dominios (`domain:`): que la red de seguridad del alta no
        // confunda una renovación con una compra de VPS sin aprovisionar.
        productId: `renewal:${info.planSlug}`,
      },
    ],
    metodo: "transferencia",
    locale: "es",
    cancelPath: s.tipo === "hosting" ? "/cuenta/hosting" : "/cuenta/servidores",
  });
  const r: RenovacionVps = {
    id: randomUUID(),
    tipo: s.tipo,
    servidorId: s.id,
    remoteId: s.remoteId,
    userId: s.userId,
    invoiceId: invoice.id,
    periodoDesde: desde,
    periodoHasta: hasta,
    importe: info.precio,
    planSlug: info.planSlug,
    ...(s.tipo === "vps" && s.proveedor === "v4vm" ? { planNombre: info.planNombre } : {}),
    estado: "pendiente",
    creadoAt: new Date().toISOString(),
    pagadaAt: null,
  };
  const list = await readAll();
  await writeAll([...list, r]);
  console.info(`[renovaciones] proforma ${invoice.numero} emitida para ${info.nombre} (${fecha(desde)} → ${fecha(hasta)}, ${info.precio} €)`);
  anotar(`Proforma ${invoice.numero} (${info.precio} €) para ${s.tipo} ${info.nombre} · ${user.email} · periodo ${fecha(desde)} → ${fecha(hasta)}`);
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

/**
 * Vencidos sin pagar: (1) un único correo de aviso al vencer; (2) pasados
 * `diasGracia` días desde el vencimiento —y desde la emisión de la proforma,
 * para que el cliente haya tenido ese margen real— se suspende y se elimina el
 * servicio, se cancela la proforma y se avisa. Devuelve cuántos avisos y borrados.
 */
export async function procesarImpagos(
  diasGracia: number,
  borrar: boolean,
  ahora = Date.now(),
): Promise<{ avisados: number; borrados: number }> {
  let avisados = 0;
  let borrados = 0;
  for (const v of await listarVencimientos()) {
    const pend = v.pendiente;
    const s = v.servicio;
    if (!pend || !v.periodoHasta || !s.userId) continue;
    const vencidoMs = ahora - Date.parse(v.periodoHasta);
    if (vencidoMs < 0) continue; // aún dentro del periodo pagado
    const emitidaMs = ahora - Date.parse(pend.creadoAt);
    const user = await getPublicUserById(s.userId).catch(() => null);
    if (!user) continue;
    const inv = await getInvoiceById(pend.invoiceId).catch(() => null);
    if (!inv || inv.estado !== "pendiente") continue; // pagada/cancelada entretanto: los ganchos ya la marcan
    const nombre = await nombreDe(s);
    const queEs = s.tipo === "hosting" ? { es: "tu hosting", en: "your hosting account" } : { es: "tu servidor", en: "your server" };
    const cap = (t: string) => t.charAt(0).toUpperCase() + t.slice(1);
    const saludo = `Hola ${user.nombre || ""},`.trim();
    const hi = `Hi ${user.nombre || ""},`.trim();

    if (!pend.avisoVencidoAt) {
      const limite = fecha(new Date(Date.parse(v.periodoHasta) + diasGracia * DIA_MS).toISOString());
      try {
        await sendServiceNoticeMail({
          to: user.email,
          asunto: `Servicio vencido sin pagar: ${nombre} / Service expired: ${nombre}`,
          cuerpo: [
            saludo,
            "",
            `El periodo de ${queEs.es} ${nombre} terminó el ${fecha(v.periodoHasta)} y la proforma de renovación ${inv.numero} (${inv.total.toFixed(2)} €) sigue sin pagar.`,
            borrar
              ? impagoBorra(s)
                ? `Si no se recibe el pago antes del ${limite}, el servicio se suspenderá y se ELIMINARÁ automáticamente con todos sus datos. Esta acción no se puede deshacer.`
                : `Si no se recibe el pago antes del ${limite}, el servicio se suspenderá automáticamente.`
              : "Paga la proforma para mantener el servicio activo.",
            "",
            "Puedes pagar desde tu área de cliente: https://viahost.top/es/cuenta/facturas",
            "",
            "— — —",
            "",
            hi,
            "",
            `The service period of ${queEs.en} ${nombre} ended on ${fecha(v.periodoHasta)} and the renewal proforma ${inv.numero} (€${inv.total.toFixed(2)}) is still unpaid.`,
            borrar
              ? impagoBorra(s)
                ? `If payment is not received before ${limite}, the service will be suspended and DELETED automatically with all its data. This cannot be undone.`
                : `If payment is not received before ${limite}, the service will be suspended automatically.`
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
        anotar(`Aviso de vencimiento: ${s.tipo} ${nombre} · ${user.email} · ${inv.numero} sin pagar desde ${fecha(v.periodoHasta)}`);
      } catch (err) {
        console.error(`[renovaciones] no se pudo avisar del vencimiento de ${nombre}:`, err);
      }
      continue; // el borrado nunca va en el mismo barrido que el aviso
    }

    if (!borrar) continue;
    if (vencidoMs < diasGracia * DIA_MS || emitidaMs < diasGracia * DIA_MS) continue;

    try {
      await suspenderYBorrar(s);
      await setInvoiceStatus(inv.id, "cancelada");
      await marcarRenovacion(pend.id, { estado: "cancelada", borradoAt: new Date(ahora).toISOString() });
      borrados++;
      const borrado = impagoBorra(s);
      console.warn(`[renovaciones] SERVICIO ${borrado ? "BORRADO" : "PARADO (v4vm, borrar a mano)"} por impago: ${nombre} (${s.id}, ${inv.numero})`);
      anotar(`${borrado ? "BORRADO" : "PARADO en v4vm (pendiente de borrar a mano)"} por impago: ${s.tipo} ${nombre} · ${user.email} · ${inv.numero} cancelada`);
      try {
        await sendServiceNoticeMail({
          to: user.email,
          asunto: borrado
            ? `Servicio eliminado por impago: ${nombre} / Service deleted: ${nombre}`
            : `Servicio suspendido por impago: ${nombre} / Service suspended: ${nombre}`,
          cuerpo: [
            saludo,
            "",
            `${cap(queEs.es)} ${nombre} venció el ${fecha(v.periodoHasta)} y, pasados ${diasGracia} días sin recibir el pago de la proforma ${inv.numero}, ha sido ${borrado ? "suspendido y eliminado junto con sus datos" : "suspendido"}. La proforma queda cancelada.`,
            `Si quieres volver a contratar: https://viahost.top/es/${s.tipo === "hosting" ? "hosting" : "vps"}`,
            "",
            "— — —",
            "",
            hi,
            "",
            `${cap(queEs.en)} ${nombre} expired on ${fecha(v.periodoHasta)} and, ${diasGracia} days later with proforma ${inv.numero} still unpaid, it has been ${borrado ? "suspended and deleted together with its data" : "suspended"}. The proforma is now cancelled.`,
            `To order again: https://viahost.top/${s.tipo === "hosting" ? "hosting" : "vps"}`,
            "",
            "ViaHost · soporte@viahost.top",
          ].join("\n"),
        });
      } catch (err) {
        console.error("[renovaciones] no se pudo avisar del borrado:", err);
      }
    } catch (err) {
      console.error(`[renovaciones] no se pudo borrar ${nombre} por impago:`, err instanceof ProvisionerError || err instanceof WhmError ? err.message : err);
    }
  }
  return { avisados, borrados };
}

/** Suspende (parada / suspendacct) y elimina el servicio en su proveedor. */
async function suspenderYBorrar(s: Servicio): Promise<void> {
  if (s.tipo === "hosting") {
    const user = s.cuenta.cpanelUser!;
    await suspendAccount(user, "Unpaid renewal (ViaHost)").catch(() => {});
    await removeAccount(user);
    await marcarHostingTerminado(user);
    return;
  }
  if (s.proveedor === "v4vm") {
    // v4vm no expone borrado por API: se para el servidor y se deja anotado
    // en la ficha para que el administrador lo borre en el proveedor.
    const cfg = await providerConfig();
    if (!cfg) throw new Error("proveedor v4vm no configurado");
    await stopServer(cfg, s.remoteId, true);
    const nota = `Parado por impago el ${fecha(new Date().toISOString())} (renovación sin pagar). Pendiente de borrar en v4vm.`;
    await updateManaged(s.id, { notas: [s.ficha.notas, nota].filter(Boolean).join(" · ") });
    return;
  }
  await vpsAction(s.remoteId, "stop").catch(() => {});
  await deleteVps(s.remoteId);
}

/** ¿El impago borra el servicio (Proxmox, hosting) o solo lo para (v4vm)? */
function impagoBorra(s: Servicio): boolean {
  return !(s.tipo === "vps" && s.proveedor === "v4vm");
}

async function nombreDe(s: Servicio): Promise<string> {
  if (s.tipo === "hosting") return s.cuenta.domain ?? s.cuenta.cpanelUser ?? "hosting";
  if (s.proveedor === "v4vm") return s.etiqueta || `vps #${s.remoteId}`;
  try {
    const v = await getVps(s.remoteId);
    return v.hostname || s.etiqueta || `vps-${v.vmid}`;
  } catch {
    return s.etiqueta || `vps #${s.remoteId}`;
  }
}

/* ------------------------------ Aviso al admin ---------------------------- */

const diario: string[] = [];
function anotar(linea: string): void {
  diario.push(linea);
}

/**
 * Resumen del barrido al buzón de administración (destinatarios de los avisos
 * de recursos, o el buzón por defecto). Solo si ha pasado algo. Nunca lanza.
 */
export async function notificarAdmin(r: { emitidas: number; avisados: number; borrados: number }): Promise<void> {
  if (!r.emitidas && !r.avisados && !r.borrados) {
    diario.length = 0;
    return;
  }
  try {
    const { alerts } = await readSettings();
    const lista = alerts.destinatarios
      .split(",")
      .map((x) => x.trim())
      .filter((x) => emailRe.test(x) && !/[<>,;"]/.test(x));
    const to = lista.length > 0 ? lista : [ALERT_FALLBACK_MAILBOX];
    const cuerpo = [
      `Barrido de renovaciones (${new Date().toISOString().slice(0, 16).replace("T", " ")} UTC):`,
      "",
      `Proformas de renovación emitidas: ${r.emitidas}`,
      `Avisos de vencimiento enviados:   ${r.avisados}`,
      `Servicios SUSPENDIDOS Y BORRADOS: ${r.borrados}`,
      "",
      ...(diario.length ? ["Detalle:", ...diario.map((l) => `  - ${l}`), ""] : []),
      "Ajustes y vista previa: https://viahost.top/es/admin/configuracion",
    ].join("\n");
    for (const dest of to) {
      await sendServiceNoticeMail({ to: dest, asunto: `Renovaciones: ${r.emitidas} emitidas, ${r.avisados} avisos, ${r.borrados} borrados`, cuerpo });
    }
  } catch (err) {
    console.error("[renovaciones] no se pudo avisar al admin:", err);
  } finally {
    diario.length = 0;
  }
}
