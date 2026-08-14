import { listInvoices, type Invoice, type NewInvoiceLineInput } from "@/lib/facturas";

/**
 * Pedidos repetidos: un doble clic no debe emitir dos proformas.
 *
 * Pasó de verdad (11/08/2026): el mismo pedido enviado dos veces con 23 s de
 * diferencia emitió dos proformas de 42 €, con sus dos correos. El tope por IP
 * no lo evita —son 2 de 10 intentos permitidos—: aquello limita el volumen, no
 * la repetición.
 *
 * La huella se calcula sobre lo que define un pedido para el cliente (a quién
 * se factura y qué líneas lleva) y se busca contra las proformas ya emitidas,
 * no contra un registro aparte: la factura en disco YA guarda todo lo que hace
 * falta para reconstruirla, así que la detección sobrevive a un `npm run
 * deploy` sin inventar un almacén nuevo que mantener sincronizado.
 */

/**
 * Margen en el que dos pedidos idénticos se consideran el mismo.
 *
 * Diez minutos cubren de sobra el doble clic, el "no me ha cargado, lo mando
 * otra vez" y el reintento tras un timeout, y se queda muy por debajo de lo que
 * tardaría alguien en querer de verdad dos unidades del mismo plan (para eso
 * está la cantidad del carrito, que además cambia la huella).
 */
export const DUPLICADO_MS = 10 * 60_000;

/**
 * Huella de un pedido: destinatario + líneas. Las líneas se ordenan porque el
 * carrito puede mandarlas en otro orden sin que el pedido sea otro; el importe
 * unitario entra en la huella para que un cambio de precio del catálogo entre
 * los dos envíos NO se trate como repetición.
 */
export function orderSignature(email: string, lineas: NewInvoiceLineInput[]): string {
  const partes = lineas
    .map((l) =>
      [
        l.productId ?? l.concepto,
        l.descripcion ?? "",
        l.cantidad,
        l.precioUnitario.toFixed(2),
      ].join("|")
    )
    .sort();
  return `${email.trim().toLowerCase()}::${partes.join("//")}`;
}

/** La misma huella, reconstruida desde una factura ya emitida. */
function invoiceSignature(inv: Invoice): string {
  return orderSignature(
    inv.clienteEmail,
    inv.lineas.map((l) => ({
      concepto: l.concepto,
      descripcion: l.descripcion,
      cantidad: l.cantidad,
      precioUnitario: l.precioUnitario,
      productId: l.productId,
    }))
  );
}

/**
 * ¿Este pedido repite una proforma reciente? Devuelve la más nueva que coincide,
 * o null.
 *
 * Solo mira proformas `pendiente`: una ya pagada es un pedido cerrado, y quien
 * vuelve a contratar el mismo plan después de pagarlo quiere otra unidad de
 * verdad. Las canceladas tampoco cuentan, para no resucitar una anulada.
 */
export async function findDuplicateOrder(
  email: string,
  lineas: NewInvoiceLineInput[],
  now = Date.now()
): Promise<Invoice | null> {
  const firma = orderSignature(email, lineas);
  const desde = now - DUPLICADO_MS;

  let mejor: Invoice | null = null;
  let mejorAt = 0;
  for (const inv of await listInvoices()) {
    if (inv.estado !== "pendiente") continue;
    const emitida = Date.parse(inv.emitidaAt);
    if (!Number.isFinite(emitida) || emitida < desde) continue;
    if (invoiceSignature(inv) !== firma) continue;
    if (emitida >= mejorAt) {
      mejor = inv;
      mejorAt = emitida;
    }
  }
  return mejor;
}
