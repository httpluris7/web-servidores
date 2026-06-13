import { readLeads } from "@/lib/leads";
import type { PaymentEvent } from "./types";

/**
 * Fulfillment del pedido tras un pago confirmado.
 *
 * Aquí va la lógica de negocio que se dispara cuando un cobro se confirma:
 * marcar el pedido como pagado, generar la factura, y disparar el
 * aprovisionamiento. De momento dejamos resuelta la parte de SEGURIDAD —validar
 * que el importe cobrado coincide con el total que NOSOTROS calculamos para ese
 * pedido— y marcamos con TODO los efectos de negocio, que dependen de la pasarela
 * y del panel elegidos.
 */

/** Total esperado del pedido (en céntimos) según nuestros datos, o null si no se conoce. */
export async function expectedOrderTotalCents(orderId: string): Promise<number | null> {
  const pedidos = await readLeads("pedido");
  const lines = pedidos.filter((p) => p.orderId === orderId);
  if (lines.length === 0) return null;
  const totalEur = lines.reduce((sum, p) => {
    const lt = typeof p.lineTotal === "number" ? p.lineTotal : 0;
    return sum + lt;
  }, 0);
  return Math.round(totalEur * 100);
}

export type FulfillResult =
  | { ok: true }
  /** El evento no trae datos suficientes (sin orderId / sin importe). */
  | { ok: false; reason: "incomplete" }
  /** El pedido no existe en nuestros datos. */
  | { ok: false; reason: "unknown_order" }
  /** El importe cobrado NO coincide con el total esperado (posible manipulación). */
  | { ok: false; reason: "amount_mismatch"; expected: number; got: number };

/**
 * Procesa un pago confirmado. Devuelve un resultado que el endpoint usa para
 * decidir el código de respuesta y qué registrar. NO debe lanzar por validación
 * de negocio (eso son resultados), solo por fallos infraestructurales reales.
 */
export async function fulfillOrder(event: PaymentEvent): Promise<FulfillResult> {
  if (!event.orderId || event.amountCents == null) {
    return { ok: false, reason: "incomplete" };
  }

  const expected = await expectedOrderTotalCents(event.orderId);
  if (expected == null) {
    return { ok: false, reason: "unknown_order" };
  }

  // Validación de importe servidor-side: nunca confiamos solo en el dato del
  // cliente; comparamos contra el total que recalculamos del catálogo al hacer
  // checkout. Un descuadre se marca y NO se cumple el pedido.
  if (event.amountCents !== expected) {
    return { ok: false, reason: "amount_mismatch", expected, got: event.amountCents };
  }

  // TODO(negocio): a partir de aquí el pago es válido y verificado. Implementar:
  //   1. Marcar el pedido `event.orderId` como pagado (estado en el almacén).
  //   2. Emitir/marcar la factura como pagada (lib/facturas: setInvoiceStatus).
  //   3. Disparar el aprovisionamiento (panel/billing) — idealmente encolado y
  //      reintentable, no inline, para no perder el cobro si falla.
  // Estos efectos dependen de la pasarela y del panel definitivos.

  return { ok: true };
}
