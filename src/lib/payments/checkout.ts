import {
  createInvoice,
  setInvoicePayment,
  type Invoice,
  type NewInvoiceLineInput,
} from "@/lib/facturas";
import { emailInvoiceDocument } from "@/lib/invoice-notify";
import { readSettings } from "@/lib/ajustes";
import { createCheckoutSession, StripeError } from "./stripe";
import { returnUrls } from "./urls";

/**
 * Emisión de la proforma al confirmar un pedido, con su cobro si toca.
 *
 * Lo usan los dos caminos de compra (carrito y contratación de un plan) para
 * que hagan exactamente lo mismo: emitir la proforma —el cliente necesita su
 * número como referencia, pague como pague— y, si eligió tarjeta, abrir la
 * sesión de pago.
 *
 * Un fallo de la pasarela NO tumba el pedido: la proforma ya está emitida, así
 * que se devuelve sin enlace y con el motivo, y el cliente puede pagar por
 * transferencia mientras se revisa.
 */

export type CheckoutMethod = "tarjeta" | "transferencia";

export type OrderCheckoutInput = {
  userId: string | null;
  clienteNombre: string;
  clienteEmail: string;
  lineas: NewInvoiceLineInput[];
  metodo: CheckoutMethod;
  /** Idioma del cliente, para la pasarela y las URLs de vuelta. */
  locale?: string;
  /** A dónde vuelve si desiste del pago. */
  cancelPath?: string;
  notas?: string;
};

export type OrderCheckoutResult = {
  invoice: Invoice;
  /** Enlace de pago con tarjeta, si se pidió y se pudo crear. */
  paymentUrl: string | null;
  /** Motivo por el que no hay enlace, cuando se pidió tarjeta. */
  paymentError: string | null;
};

export async function checkoutOrder(input: OrderCheckoutInput): Promise<OrderCheckoutResult> {
  const invoice = await createInvoice({
    userId: input.userId,
    clienteNombre: input.clienteNombre,
    clienteEmail: input.clienteEmail,
    lineas: input.lineas,
    metodoPago: input.metodo === "tarjeta" ? "stripe" : "transferencia",
    notas: input.notas ?? "",
  });

  let current = invoice;
  let paymentUrl: string | null = null;
  let paymentError: string | null = null;

  if (input.metodo === "tarjeta") {
    const { stripe } = await readSettings();
    if (!stripe.enabled || !stripe.secretKey) {
      paymentError = "Card payments are not available right now.";
    } else {
      try {
        const session = await createCheckoutSession(stripe.secretKey, invoice, {
          ...returnUrls(input.locale, input.cancelPath),
          locale: input.locale,
          attempt: 1,
        });
        if (session.url) {
          paymentUrl = session.url;
          current =
            (await setInvoicePayment(invoice.id, {
              provider: "stripe",
              sessionId: session.id,
              url: session.url,
              createdAt: new Date().toISOString(),
              intentos: 1,
            })) ?? invoice;
        } else {
          paymentError = "Stripe did not return a payment link.";
        }
      } catch (err) {
        paymentError = err instanceof StripeError ? err.message : "Could not reach Stripe.";
        console.error("[payments] cobro del pedido fallido:", invoice.numero, paymentError);
      }
    }
  }

  // La proforma se envía siempre (lleva la referencia de la transferencia y, si
  // existe, el enlace de pago). Best-effort: ya está emitida y persistida.
  try {
    await emailInvoiceDocument(current);
  } catch (err) {
    console.error("[payments] no se pudo enviar la proforma", current.numero, err);
  }

  return { invoice: current, paymentUrl, paymentError };
}
