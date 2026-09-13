import { chmod, mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { site } from "@/data/site";
import { readSettings, wiseHasCreds } from "@/lib/ajustes";
import { listInvoices, transferRef, type Invoice } from "@/lib/facturas";
import { emailRe } from "@/lib/leads";
import { ALERT_FALLBACK_MAILBOX, sendServiceNoticeMail } from "@/lib/mail";
import { fetchStatement, WiseError, type WiseTransaction } from "./wise";
import { reserve, release, markProcessed } from "./events";
import { fulfillOrder } from "./fulfill";
import type { PaymentEvent } from "./types";

/**
 * Conciliación de transferencias recibidas en Wise.
 *
 * Sondea el statement del balance EUR, casa cada INGRESO con la proforma cuya
 * referencia (`VH…`) coincide, y lo mete por el MISMO camino que un webhook de
 * pasarela: `reserve` (idempotencia) → `fulfillOrder` (valida importe/divisa,
 * marca la factura pagada, emite la factura final y aprovisiona el VPS) →
 * `markProcessed`. Así "transferencia recibida" y "pago con tarjeta" acaban en
 * exactamente la misma lógica de entrega.
 *
 * Es *best-effort* por naturaleza: si la referencia no llega, llega mal escrita,
 * o el importe no cuadra, el ingreso NO se cumple y la proforma sigue pendiente
 * para que se resuelva a mano en el panel. Eso sí, un ingreso que no casa con
 * ninguna proforma pendiente NO se traga en silencio: se avisa al admin por
 * correo (una sola vez por ingreso) con los datos para resolverlo a mano.
 * Nunca lanza.
 *
 * Lo dispara el latido de 5 min (`instrumentation-node.ts`), como el backup.
 */

/** Ventana de statement que se revisa en cada sondeo. */
const VENTANA_DIAS = 7;

/** Normaliza una referencia a solo `[A-Z0-9]` para casar pese a espacios/signos. */
export function normRef(s: string): string {
  return (s || "").toUpperCase().replace(/[^A-Z0-9]/g, "");
}

/** Referencia de un ingreso: campo dedicado y, si falta, la descripción. */
function refDeIngreso(txn: WiseTransaction): string {
  const d = txn.details ?? {};
  return normRef(d.paymentReference || d.reference || d.description || "");
}

/**
 * Índice clave→proforma. Cada proforma entra por DOS claves: su referencia de
 * pago (`VH…`, la que pedimos) y su número (`PRO-2026-XXXXXX`), porque parte de
 * los textos de la web hablan de "poner el número de factura como concepto" y
 * hay clientes que hacen justamente eso. Ambas son de ancho fijo, así que
 * ninguna puede ser prefijo de otra.
 */
export function indexarProformas(pendientes: Invoice[]): Map<string, Invoice> {
  const porRef = new Map<string, Invoice>();
  for (const inv of pendientes) {
    for (const clave of [normRef(transferRef(inv)), normRef(inv.numero)]) {
      if (clave) porRef.set(clave, inv);
    }
  }
  return porRef;
}

/**
 * Busca la proforma cuya clave aparece ENTERA en la referencia del ingreso.
 * Devuelve `ambigua: true` si encajan proformas DISTINTAS (no adivinamos); que
 * encajen las dos claves de la misma proforma no es ambigüedad.
 */
export function buscarProforma(
  refIngreso: string,
  indice: Map<string, Invoice>
): { inv: Invoice | null; ambigua: boolean } {
  if (!refIngreso) return { inv: null, ambigua: false };
  const vistas = new Map<string, Invoice>();
  for (const [clave, inv] of indice) {
    if (refIngreso.includes(clave)) vistas.set(inv.id, inv);
  }
  if (vistas.size === 1) return { inv: [...vistas.values()][0] ?? null, ambigua: false };
  return { inv: null, ambigua: vistas.size > 1 };
}

export type ResultadoConciliacion = {
  ok: boolean;
  motivo?: "deshabilitado" | "sin-credenciales" | "error";
  /** Ingresos EUR revisados en la ventana. */
  revisados: number;
  /** Ingresos que casaron con una proforma pendiente. */
  casados: number;
  /** Números de proforma efectivamente entregados en este sondeo. */
  entregadas: string[];
  /** Ingresos que no casaron con ninguna proforma pendiente (avisados al admin). */
  sinCasar: number;
  error?: string;
};

const vacio = (motivo: ResultadoConciliacion["motivo"]): ResultadoConciliacion => ({
  ok: false,
  motivo,
  revisados: 0,
  casados: 0,
  entregadas: [],
  sinCasar: 0,
});

export async function reconciliarWise(): Promise<ResultadoConciliacion> {
  const { wise } = await readSettings();
  if (!wise.enabled) return vacio("deshabilitado");
  if (!wiseHasCreds(wise)) return vacio("sin-credenciales");

  const now = new Date();
  const start = new Date(now.getTime() - VENTANA_DIAS * 24 * 3600 * 1000);

  let creditos: WiseTransaction[];
  try {
    const statement = await fetchStatement(wise, {
      currency: "EUR",
      intervalStart: start.toISOString(),
      intervalEnd: now.toISOString(),
    });
    creditos = (statement.transactions ?? []).filter(
      (t) =>
        (t.type ?? "").toUpperCase() === "CREDIT" &&
        (t.amount?.currency ?? "").toUpperCase() === "EUR"
    );
  } catch (err) {
    const msg = err instanceof WiseError ? err.message : String(err);
    console.error("[wise] no se pudo leer el statement:", msg);
    return { ...vacio("error"), error: msg };
  }

  // Índice referencia→proforma PENDIENTE. Solo pendientes: una pagada es un
  // pedido cerrado y no debe re-casarse; además reduce falsos positivos.
  const todas = await listInvoices();
  const pendientes = todas.filter((i) => i.estado === "pendiente");
  const porRef = indexarProformas(pendientes);

  const entregadas: string[] = [];
  let casados = 0;
  let sinCasar = 0;

  for (const txn of creditos) {
    const ref = refDeIngreso(txn);
    // Id estable del ingreso = clave de idempotencia entre sondeos (y de "ya avisado").
    const txId = txn.referenceNumber || `${ref}-${txn.amount?.value ?? ""}-${txn.date ?? ""}`;

    const { inv, ambigua } = buscarProforma(ref, porRef);
    if (!inv) {
      // Sin referencia, referencia desconocida o ambigua: no adivinamos, pero
      // tampoco lo dejamos pasar en silencio. Se avisa UNA vez por ingreso.
      sinCasar++;
      await avisarIngresoSinCasar(txn, txId, ref, ambigua, todas, pendientes);
      continue;
    }
    casados++;

    const eventId = `wise-${txId}`;
    const amountCents = txn.amount ? Math.round(txn.amount.value * 100) : null;

    const event: PaymentEvent = {
      id: eventId,
      type: "wise.balance.credit",
      succeeded: true,
      orderId: null,
      invoiceId: inv.id,
      amountCents,
      currency: "eur",
      raw: txn,
    };

    // Idempotencia: si este ingreso ya se procesó, no repetimos.
    const fresh = await reserve(eventId);
    if (!fresh) continue;

    try {
      const outcome = await fulfillOrder(event);
      if (outcome.ok) {
        await markProcessed(event, { fulfilled: true, invoiceId: inv.id, ref });
        entregadas.push(inv.numero);
      } else {
        // Descuadre de importe / factura desconocida: se marca procesado-rechazado
        // (no reintentar en bucle) y queda para revisión manual en el panel.
        await markProcessed(event, { fulfilled: false, invoiceId: inv.id, ref, rejection: outcome });
        console.error("[wise] ingreso casado pero NO cumplido:", inv.numero, outcome);
      }
    } catch (err) {
      // Fallo infraestructural real: liberamos para reintentar en el próximo sondeo.
      release(eventId);
      console.error("[wise] error cumpliendo ingreso de", inv.numero, err);
    }
  }

  return { ok: true, revisados: creditos.length, casados, entregadas, sinCasar };
}

/* ------------------------- Ingresos que no casan -------------------------- */

const DATA_DIR = path.join(process.cwd(), "data");
const AVISADOS_FILE = path.join(DATA_DIR, "wise-sin-casar.json");
/** Ids de ingreso ya avisados que se conservan (los más recientes). */
const MAX_AVISADOS = 500;

async function leerAvisados(): Promise<string[]> {
  try {
    const parsed = JSON.parse(await readFile(AVISADOS_FILE, "utf8")) as { avisados?: unknown };
    return Array.isArray(parsed.avisados) ? parsed.avisados.filter((x) => typeof x === "string") : [];
  } catch {
    return [];
  }
}

async function guardarAvisados(ids: string[]): Promise<void> {
  await mkdir(DATA_DIR, { recursive: true });
  await writeFile(AVISADOS_FILE, JSON.stringify({ avisados: ids.slice(-MAX_AVISADOS) }), {
    encoding: "utf8",
    mode: 0o600,
  });
  await chmod(AVISADOS_FILE, 0o600);
}

const eur = (n: number) => `${n.toFixed(2).replace(".", ",")} €`;

/**
 * Correo al admin por un ingreso que no se ha podido casar. Se manda una sola
 * vez por ingreso (`txId`), y nunca lanza: es información, no puede tumbar el
 * sondeo. Incluye pistas para resolverlo a mano: si la referencia es la de una
 * factura YA pagada, y qué proformas pendientes por transferencia tienen
 * exactamente ese importe.
 */
async function avisarIngresoSinCasar(
  txn: WiseTransaction,
  txId: string,
  ref: string,
  ambigua: boolean,
  todas: Invoice[],
  pendientes: Invoice[]
): Promise<void> {
  try {
    const avisados = await leerAvisados();
    if (avisados.includes(txId)) return;

    const importe = txn.amount?.value ?? null;
    const d = txn.details ?? {};
    const motivo = ambigua
      ? "la referencia encaja con MÁS DE UNA proforma pendiente"
      : !ref
        ? "el ingreso llegó SIN referencia"
        : "la referencia no coincide con ninguna proforma pendiente";

    // ¿Es la referencia de una factura que ya está pagada? (doble pago, o cobro
    // ya marcado a mano antes de que llegara el ingreso).
    const yaPagada = ref
      ? indexarProformas(todas.filter((i) => i.estado !== "pendiente"))
      : new Map<string, Invoice>();
    const pagada = buscarProforma(ref, yaPagada).inv;

    // Candidatas por importe exacto entre las pendientes por transferencia.
    const candidatas =
      importe == null
        ? []
        : pendientes.filter(
            (i) => i.metodoPago === "transferencia" && Math.round(i.total * 100) === Math.round(importe * 100)
          );

    console.warn(
      `[wise] ingreso sin casar (${motivo}):`,
      txId,
      importe != null ? eur(importe) : "?",
      d.senderName ?? "",
      ref || "(sin referencia)"
    );

    const { alerts } = await readSettings();
    const lista = alerts.destinatarios
      .split(",")
      .map((x) => x.trim())
      .filter((x) => emailRe.test(x) && !/[<>,;"]/.test(x));
    const to = lista.length > 0 ? lista : [ALERT_FALLBACK_MAILBOX];

    const cuerpo = [
      "Ha entrado dinero en Wise que el conciliador NO ha podido asignar a ninguna proforma pendiente.",
      `Motivo: ${motivo}.`,
      "",
      `Fecha:        ${txn.date ?? "?"}`,
      `Importe:      ${importe != null ? eur(importe) : "?"}`,
      `Ordenante:    ${d.senderName ?? "?"}`,
      `Referencia:   ${d.paymentReference || d.reference || "(vacía)"}`,
      `Descripción:  ${d.description ?? ""}`,
      `Id Wise:      ${txn.referenceNumber ?? txId}`,
      "",
      ...(pagada
        ? [
            `Atención: la referencia corresponde a ${pagada.numero}, que YA está pagada (¿doble pago o cobro marcado a mano?).`,
            "",
          ]
        : []),
      ...(candidatas.length > 0
        ? [
            `Proformas pendientes por transferencia con este importe exacto (${candidatas.length}):`,
            ...candidatas.map((i) => `  - ${i.numero} · ${i.clienteNombre} <${i.clienteEmail}> · ref ${transferRef(i)}`),
            "",
            "Si el ordenante coincide con el cliente, márcala pagada desde el panel.",
            "",
          ]
        : [
            "No hay ninguna proforma pendiente por transferencia con este importe exacto.",
            "",
          ]),
      `Panel de facturas: ${site.url}/es/admin/facturas`,
    ].join("\n");

    const asunto = `Wise: ingreso sin asignar de ${importe != null ? eur(importe) : "importe desconocido"}`;
    for (const dest of to) {
      await sendServiceNoticeMail({ to: dest, asunto, cuerpo });
    }

    await guardarAvisados([...avisados, txId]);
  } catch (err) {
    console.error("[wise] no se pudo avisar de un ingreso sin casar:", txId, err);
  }
}

/* ------------------------------- Programación ----------------------------- */

// Cerrojo en memoria: que dos latidos no solapen dos sondeos.
let enMarcha = false;

/**
 * Comprobación que cuelga del latido de 5 min. No hace nada si Wise está
 * apagado o sin credenciales. Registra las entregas para que queden en el log.
 */
export async function comprobarWise(): Promise<void> {
  if (enMarcha) return;
  enMarcha = true;
  try {
    const r = await reconciliarWise();
    if (r.ok && r.sinCasar > 0) {
      console.warn(`[wise] sondeo: ${r.sinCasar} ingreso(s) sin casar con ninguna proforma pendiente`);
    }
    if (r.entregadas.length > 0) {
      console.info(
        `[wise] sondeo: ${r.entregadas.length} proforma(s) entregada(s):`,
        r.entregadas.join(", ")
      );
    }
  } catch (err) {
    console.error("[wise] fallo en el sondeo:", err);
  } finally {
    enMarcha = false;
  }
}
