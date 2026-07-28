import type { Invoice } from "@/lib/facturas";

/**
 * Cliente mínimo de la API de Stripe.
 *
 * Hablamos con `api.stripe.com` por REST con `fetch`, sin añadir el SDK: solo
 * usamos dos operaciones (crear una sesión de Checkout y consultarla) y el
 * proyecto evita dependencias que no aporten. La API de Stripe recibe los
 * parámetros como formulario (`application/x-www-form-urlencoded`) con notación
 * de corchetes para lo anidado, de ahí el serializador de abajo.
 *
 * La clave secreta se pasa siempre como argumento (viene de `lib/ajustes.ts`) y
 * NO se registra en ningún log ni se incluye en los mensajes de error.
 */

/** Versión de la API fijada: protege de cambios incompatibles futuros. */
const STRIPE_API_VERSION = "2024-06-20";
const STRIPE_BASE = "https://api.stripe.com/v1";
const TIMEOUT_MS = 20_000;

/** Error de la API de Stripe, ya con un mensaje presentable. */
export class StripeError extends Error {
  readonly status: number;
  readonly code: string | null;
  constructor(message: string, status: number, code: string | null) {
    super(message);
    this.name = "StripeError";
    this.status = status;
    this.code = code;
  }
}

/**
 * Aplana un objeto a la notación de Stripe: `metadata[invoiceId]`,
 * `line_items[0][price_data][currency]`… Los `undefined`/`null` se omiten.
 */
function encodeForm(params: Record<string, unknown>, prefix = ""): string[] {
  const out: string[] = [];
  for (const [rawKey, value] of Object.entries(params)) {
    if (value === undefined || value === null) continue;
    const key = prefix ? `${prefix}[${rawKey}]` : rawKey;
    if (Array.isArray(value)) {
      value.forEach((item, i) => {
        if (item && typeof item === "object") {
          out.push(...encodeForm(item as Record<string, unknown>, `${key}[${i}]`));
        } else if (item !== undefined && item !== null) {
          out.push(`${encodeURIComponent(`${key}[${i}]`)}=${encodeURIComponent(String(item))}`);
        }
      });
    } else if (typeof value === "object") {
      out.push(...encodeForm(value as Record<string, unknown>, key));
    } else {
      out.push(`${encodeURIComponent(key)}=${encodeURIComponent(String(value))}`);
    }
  }
  return out;
}

async function stripeRequest<T>(
  secretKey: string,
  method: "GET" | "POST",
  path: string,
  params?: Record<string, unknown>,
  idempotencyKey?: string
): Promise<T> {
  const body = method === "POST" && params ? encodeForm(params).join("&") : undefined;
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);

  let res: Response;
  try {
    res = await fetch(`${STRIPE_BASE}${path}`, {
      method,
      headers: {
        Authorization: `Bearer ${secretKey}`,
        "Stripe-Version": STRIPE_API_VERSION,
        ...(body ? { "Content-Type": "application/x-www-form-urlencoded" } : {}),
        // Evita cobrar dos veces si reintentamos una creación que sí llegó.
        ...(idempotencyKey ? { "Idempotency-Key": idempotencyKey } : {}),
      },
      body,
      signal: controller.signal,
      cache: "no-store",
    });
  } catch (err) {
    throw new StripeError(
      err instanceof Error && err.name === "AbortError"
        ? "Stripe did not respond in time."
        : "Could not reach Stripe.",
      0,
      null
    );
  } finally {
    clearTimeout(timer);
  }

  const json = (await res.json().catch(() => null)) as
    | { error?: { message?: string; code?: string; type?: string } }
    | null;

  if (!res.ok) {
    const detail = json?.error?.message ?? `HTTP ${res.status}`;
    throw new StripeError(detail, res.status, json?.error?.code ?? json?.error?.type ?? null);
  }
  return json as T;
}

/* ---------------------------- Sesión de Checkout -------------------------- */

export type CheckoutSession = {
  id: string;
  url: string | null;
  status: string | null;
  payment_status: string | null;
  amount_total: number | null;
  currency: string | null;
  expires_at: number | null;
};

const toCents = (eur: number) => Math.round(eur * 100);

/**
 * Líneas de la sesión a partir de la factura.
 *
 * Si la factura lleva impuestos, la diferencia entre el total y la suma de
 * líneas se añade como una línea propia: así el importe que cobra Stripe
 * coincide AL CÉNTIMO con el total de la factura, que es justo lo que el
 * webhook comprueba antes de darla por pagada.
 */
function lineItems(inv: Invoice): Record<string, unknown>[] {
  const items = inv.lineas.map((l) => ({
    quantity: l.cantidad,
    price_data: {
      currency: "eur",
      unit_amount: toCents(l.precioUnitario),
      product_data: {
        name: l.concepto || inv.numero,
        // Stripe rechaza una descripción vacía: solo la mandamos si la hay.
        description: l.descripcion || undefined,
      },
    },
  }));

  const linesCents = inv.lineas.reduce((acc, l) => acc + toCents(l.precioUnitario) * l.cantidad, 0);
  const diff = toCents(inv.total) - linesCents;
  if (diff > 0) {
    items.push({
      quantity: 1,
      price_data: {
        currency: "eur",
        unit_amount: diff,
        product_data: { name: `Tax (${inv.ivaPct}%)`, description: undefined },
      },
    });
  }
  return items;
}

/**
 * Crea la sesión de pago de una factura y devuelve el enlace al que enviar al
 * cliente. `metadata.invoiceId` viaja también al PaymentIntent para que el
 * webhook pueda identificar la factura reciba el evento que reciba.
 */
export async function createCheckoutSession(
  secretKey: string,
  inv: Invoice,
  opts: { successUrl: string; cancelUrl: string; locale?: string; attempt?: number }
): Promise<CheckoutSession> {
  const metadata = { invoiceId: inv.id, numero: inv.numero };
  return stripeRequest<CheckoutSession>(
    secretKey,
    "POST",
    "/checkout/sessions",
    {
      mode: "payment",
      line_items: lineItems(inv),
      customer_email: inv.clienteEmail,
      client_reference_id: inv.id,
      metadata,
      payment_intent_data: { metadata },
      success_url: opts.successUrl,
      cancel_url: opts.cancelUrl,
      locale: opts.locale ?? "auto",
    },
    // Reintentar la MISMA generación no crea dos sesiones (doble clic, timeout
    // con la petición ya cursada). `attempt` sube cuando el admin pide un enlace
    // nuevo a propósito —p. ej. porque el anterior caducó—, y entonces sí
    // queremos una sesión distinta.
    `invoice-${inv.id}-${toCents(inv.total)}-${opts.attempt ?? 0}`
  );
}

/** Consulta el estado de una sesión (para comprobar a mano si el webhook falló). */
export async function retrieveCheckoutSession(
  secretKey: string,
  sessionId: string
): Promise<CheckoutSession> {
  return stripeRequest<CheckoutSession>(secretKey, "GET", `/checkout/sessions/${encodeURIComponent(sessionId)}`);
}

/** Comprobación de credenciales para el panel: ¿la clave es válida y de quién? */
export async function retrieveAccount(
  secretKey: string
): Promise<{ id: string; email: string | null; country: string | null }> {
  const acc = await stripeRequest<{ id: string; email?: string; country?: string }>(
    secretKey,
    "GET",
    "/account"
  );
  return { id: acc.id, email: acc.email ?? null, country: acc.country ?? null };
}
