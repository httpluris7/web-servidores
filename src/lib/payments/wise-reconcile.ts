import { readSettings, wiseHasCreds } from "@/lib/ajustes";
import { listInvoices, transferRef, type Invoice } from "@/lib/facturas";
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
 * para que se resuelva a mano en el panel. Nunca lanza.
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

export type ResultadoConciliacion = {
  ok: boolean;
  motivo?: "deshabilitado" | "sin-credenciales" | "error";
  /** Ingresos EUR revisados en la ventana. */
  revisados: number;
  /** Ingresos que casaron con una proforma pendiente. */
  casados: number;
  /** Números de proforma efectivamente entregados en este sondeo. */
  entregadas: string[];
  error?: string;
};

const vacio = (motivo: ResultadoConciliacion["motivo"]): ResultadoConciliacion => ({
  ok: false,
  motivo,
  revisados: 0,
  casados: 0,
  entregadas: [],
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
  const pendientes = (await listInvoices()).filter((i) => i.estado === "pendiente");
  const porRef = new Map<string, Invoice>();
  for (const inv of pendientes) {
    const r = normRef(transferRef(inv));
    if (r) porRef.set(r, inv);
  }

  const entregadas: string[] = [];
  let casados = 0;

  for (const txn of creditos) {
    const ref = refDeIngreso(txn);
    if (!ref) continue;

    // La referencia de la proforma tiene que aparecer ENTERA en la del ingreso.
    // El ancho fijo (`VH` + 5 dígitos) impide que una sea prefijo de otra, así
    // que la coincidencia es inequívoca. Si encajara más de una, no adivinamos.
    const matches = [...porRef.entries()].filter(([r]) => ref.includes(r));
    const unico = matches.length === 1 ? matches[0] : null;
    if (!unico) {
      if (matches.length > 1) {
        console.error("[wise] ingreso con referencia ambigua, revisión manual:", ref);
      }
      continue;
    }
    const inv = unico[1];
    casados++;

    // Id estable del ingreso = clave de idempotencia entre sondeos.
    const txId = txn.referenceNumber || `${ref}-${txn.amount?.value ?? ""}-${txn.date ?? ""}`;
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

  return { ok: true, revisados: creditos.length, casados, entregadas };
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
