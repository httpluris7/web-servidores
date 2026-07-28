import { readLeads } from "@/lib/leads";
import { getInvoiceById, setInvoiceStatus } from "@/lib/facturas";
import { emailInvoiceDocument } from "@/lib/invoice-notify";
import type { PaymentEvent } from "./types";

/**
 * Fulfillment del pedido tras un pago confirmado.
 *
 * Antes de dar nada por bueno se comprueba, contra NUESTROS datos, que el
 * importe cobrado es exactamente el esperado y que la divisa es la nuestra: el
 * evento viene firmado por la pasarela, pero la sesión pudo crearse con otros
 * datos, y un descuadre debe pararlo todo.
 *
 * Hay dos caminos según lo que traiga el evento en metadata:
 *  - `invoiceId` → cobro de una factura (el caso normal desde que existe la
 *    pasarela): se marca pagada, lo que asigna su número fiscal y dispara el
 *    envío de la factura final.
 *  - `orderId` → cobro de un pedido sin factura asociada. Se queda en la
 *    validación de importe; el aprovisionamiento sigue pendiente.
 */

const round2 = (n: number) => Math.round((n + Number.EPSILON) * 100) / 100;

/** Total esperado del pedido (en céntimos) según nuestros datos, o null si no se conoce. */
export async function expectedOrderTotalCents(orderId: string): Promise<number | null> {
  const pedidos = await readLeads("pedido");
  const lines = pedidos.filter((p) => p.orderId === orderId);
  if (lines.length === 0) return null;
  const totalEur = lines.reduce((sum, p) => {
    const lt = typeof p.lineTotal === "number" ? p.lineTotal : 0;
    return sum + lt;
  }, 0);
  return Math.round(round2(totalEur) * 100);
}

export type FulfillResult =
  | { ok: true; invoiceId?: string; numero?: string }
  /** El evento no trae datos suficientes (sin referencia nuestra / sin importe). */
  | { ok: false; reason: "incomplete" }
  /** El pedido o la factura no existen en nuestros datos. */
  | { ok: false; reason: "unknown_order" }
  /** El importe cobrado NO coincide con el total esperado (posible manipulación). */
  | { ok: false; reason: "amount_mismatch"; expected: number; got: number }
  /** La divisa cobrada no es la nuestra. */
  | { ok: false; reason: "currency_mismatch"; expected: string; got: string };

/**
 * Procesa un pago confirmado. Devuelve un resultado que el endpoint usa para
 * decidir el código de respuesta y qué registrar. NO debe lanzar por validación
 * de negocio (eso son resultados), solo por fallos infraestructurales reales.
 */
export async function fulfillOrder(event: PaymentEvent): Promise<FulfillResult> {
  if (event.amountCents == null || (!event.invoiceId && !event.orderId)) {
    return { ok: false, reason: "incomplete" };
  }

  // La divisa real del negocio es el euro; el dólar de la web es solo una vista.
  if (event.currency && event.currency.toLowerCase() !== "eur") {
    return { ok: false, reason: "currency_mismatch", expected: "eur", got: event.currency };
  }

  /* --------------------------- Cobro de una factura ------------------------- */
  if (event.invoiceId) {
    const inv = await getInvoiceById(event.invoiceId);
    if (!inv) return { ok: false, reason: "unknown_order" };

    const expected = Math.round(round2(inv.total) * 100);
    if (event.amountCents !== expected) {
      return { ok: false, reason: "amount_mismatch", expected, got: event.amountCents };
    }

    const result = await setInvoiceStatus(inv.id, "pagada");
    if (!result) return { ok: false, reason: "unknown_order" };

    // El correo es best-effort: el cobro ya está registrado y la factura emitida,
    // así que un fallo de envío no puede tumbar el webhook ni hacer que la
    // pasarela reintente un pago que ya dimos por bueno.
    if (result.justPaid) {
      try {
        await emailInvoiceDocument(result.invoice);
      } catch (err) {
        console.error("[payments] no se pudo enviar la factura final:", inv.id, err);
      }
    }
    return { ok: true, invoiceId: inv.id, numero: result.invoice.numero };
  }

  /* --------------------------- Cobro de un pedido --------------------------- */
  const expected = await expectedOrderTotalCents(event.orderId!);
  if (expected == null) {
    return { ok: false, reason: "unknown_order" };
  }

  // Validación de importe servidor-side: nunca confiamos solo en el dato del
  // cliente; comparamos contra el total que recalculamos del catálogo al hacer
  // checkout. Un descuadre se marca y NO se cumple el pedido.
  if (event.amountCents !== expected) {
    return { ok: false, reason: "amount_mismatch", expected, got: event.amountCents };
  }

  // TODO(negocio): pedido pagado sin factura asociada. Falta disparar el
  // aprovisionamiento (idealmente encolado y reintentable, no aquí en línea).
  return { ok: true };
}
