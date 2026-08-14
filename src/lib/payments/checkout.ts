import {
  createInvoice,
  setInvoicePayment,
  type Invoice,
  type NewInvoiceLineInput,
} from "@/lib/facturas";
import { emailInvoiceDocument } from "@/lib/invoice-notify";
import { readSettings } from "@/lib/ajustes";
import { createCheckoutSession, StripeError } from "./stripe";
import { findDuplicateOrder, orderSignature } from "./duplicados";
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
 *
 * Es además donde se corta el pedido repetido (ver `duplicados.ts`): al estar
 * los dos caminos obligados a pasar por aquí, ninguno puede saltarse la
 * comprobación por olvido.
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
  /**
   * Proforma repetida ya localizada por quien llama (para no leer el fichero
   * dos veces). Si no se pasa, se busca aquí igualmente.
   */
  duplicado?: Invoice | null;
};

export type OrderCheckoutResult = {
  invoice: Invoice;
  /** Enlace de pago con tarjeta, si se pidió y se pudo crear. */
  paymentUrl: string | null;
  /** Motivo por el que no hay enlace, cuando se pidió tarjeta. */
  paymentError: string | null;
  /** El pedido repetía uno reciente: se devuelve su proforma, sin emitir otra. */
  duplicado: boolean;
};

/**
 * Pedidos en vuelo, por huella.
 *
 * El doble clic instantáneo llega antes de que la primera proforma esté en
 * disco, así que la búsqueda por fichero no lo ve. Aquí la segunda petición se
 * engancha a la primera y las dos responden lo mismo (mismo número, mismo
 * enlace de pago), que es justo lo que queremos: el cliente ve un solo pedido
 * abriera las pestañas que abriera. Vale con memoria porque corre un único
 * proceso pm2; si algún día hay réplicas, esto se queda corto y lo que sigue
 * cubriendo el caso es la búsqueda en disco.
 */
const enCurso = new Map<string, Promise<OrderCheckoutResult>>();

export async function checkoutOrder(input: OrderCheckoutInput): Promise<OrderCheckoutResult> {
  const firma = orderSignature(input.clienteEmail, input.lineas);
  const enVuelo = enCurso.get(firma);
  if (enVuelo) {
    console.warn("[payments] pedido repetido en vuelo de", input.clienteEmail, "- se comparte");
    return enVuelo;
  }

  const trabajo = emitirPedido(input).finally(() => {
    if (enCurso.get(firma) === trabajo) enCurso.delete(firma);
  });
  enCurso.set(firma, trabajo);
  return trabajo;
}

async function emitirPedido(input: OrderCheckoutInput): Promise<OrderCheckoutResult> {
  const repetido =
    input.duplicado ?? (await findDuplicateOrder(input.clienteEmail, input.lineas));
  if (repetido) return reutilizarProforma(repetido, input);

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

  return { invoice: current, paymentUrl, paymentError, duplicado: false };
}

/**
 * El pedido repetía uno reciente: se devuelve la proforma que ya tiene, sin
 * emitir otra ni volver a mandarle el correo (ya lo recibió).
 *
 * Si ahora pide tarjeta, el cobro se abre sobre ESA misma factura: reutiliza el
 * enlace si sigue vivo —Stripe los caduca a las 24 h— y, si no, genera uno
 * nuevo subiendo `intentos`, que es lo que rompe la idempotencia y evita que
 * Stripe devuelva la sesión vieja ya caducada.
 */
async function reutilizarProforma(
  dup: Invoice,
  input: OrderCheckoutInput
): Promise<OrderCheckoutResult> {
  console.warn(
    "[payments] pedido repetido de",
    input.clienteEmail,
    "- se reutiliza la proforma",
    dup.numero
  );

  if (input.metodo !== "tarjeta") {
    return { invoice: dup, paymentUrl: null, paymentError: null, duplicado: true };
  }

  const vigente =
    dup.pago && Date.now() - Date.parse(dup.pago.createdAt) < 23 * 60 * 60_000 ? dup.pago : null;
  if (vigente) {
    return { invoice: dup, paymentUrl: vigente.url, paymentError: null, duplicado: true };
  }

  const { stripe } = await readSettings();
  if (!stripe.enabled || !stripe.secretKey) {
    return {
      invoice: dup,
      paymentUrl: null,
      paymentError: "Card payments are not available right now.",
      duplicado: true,
    };
  }

  try {
    const intentos = (dup.pago?.intentos ?? 0) + 1;
    const session = await createCheckoutSession(stripe.secretKey, dup, {
      ...returnUrls(input.locale, input.cancelPath),
      locale: input.locale,
      attempt: intentos,
    });
    if (!session.url) {
      return {
        invoice: dup,
        paymentUrl: null,
        paymentError: "Stripe did not return a payment link.",
        duplicado: true,
      };
    }
    const actual =
      (await setInvoicePayment(dup.id, {
        provider: "stripe",
        sessionId: session.id,
        url: session.url,
        createdAt: new Date().toISOString(),
        intentos,
      })) ?? dup;
    return { invoice: actual, paymentUrl: session.url, paymentError: null, duplicado: true };
  } catch (err) {
    const paymentError = err instanceof StripeError ? err.message : "Could not reach Stripe.";
    console.error("[payments] cobro del pedido repetido fallido:", dup.numero, paymentError);
    return { invoice: dup, paymentUrl: null, paymentError, duplicado: true };
  }
}
