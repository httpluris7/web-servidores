import { createHmac, timingSafeEqual } from "node:crypto";
import { readSettings } from "@/lib/ajustes";
import type { PaymentEvent, PaymentVerifier, VerifyResult } from "./types";

/**
 * Selección y configuración del verificador de pasarela.
 *
 * El secreto de firma sale de los ajustes del panel (`/admin/configuracion`,
 * ver `lib/ajustes.ts`), con respaldo en `STRIPE_WEBHOOK_SECRET` del entorno.
 * Mientras no haya secreto, el endpoint usa el verificador "nulo" que rechaza
 * todo como `unconfigured` → el webhook queda inerte y seguro por defecto.
 *
 * Para otra pasarela (Redsys, PayPal…), implementa un `PaymentVerifier` nuevo
 * siguiendo el mismo contrato y enchúfalo en `getVerifier()`. El resto del flujo
 * (idempotencia, importe, fulfillment) no cambia.
 */

/* --------------------------- Verificador nulo ----------------------------- */

const nullVerifier: PaymentVerifier = {
  provider: "none",
  verify(): VerifyResult {
    return { ok: false, reason: "unconfigured" };
  },
};

/* ------------------------ Stripe (implementación ref) --------------------- */

// Tolerancia anti-replay: descartamos firmas con timestamp más viejo que esto.
const STRIPE_TOLERANCE_SECONDS = 5 * 60;

/** Parsea la cabecera `Stripe-Signature: t=...,v1=...,v1=...`. */
function parseStripeSigHeader(header: string): { t: number; v1: string[] } | null {
  let t = NaN;
  const v1: string[] = [];
  for (const part of header.split(",")) {
    const [k, v] = part.split("=");
    if (k === "t") t = Number(v);
    else if (k === "v1" && v) v1.push(v);
  }
  if (!Number.isFinite(t) || v1.length === 0) return null;
  return { t, v1 };
}

function hexEqual(a: string, b: string): boolean {
  // timingSafeEqual exige misma longitud; comparamos como hex de bytes.
  try {
    const ab = Buffer.from(a, "hex");
    const bb = Buffer.from(b, "hex");
    return ab.length === bb.length && ab.length > 0 && timingSafeEqual(ab, bb);
  } catch {
    return false;
  }
}

/** Extrae los campos normalizados del objeto de evento de Stripe. */
function normalizeStripeEvent(raw: unknown): PaymentEvent {
  const ev = (raw ?? {}) as {
    id?: unknown;
    type?: unknown;
    data?: { object?: Record<string, unknown> };
  };
  const obj = ev.data?.object ?? {};
  const type = typeof ev.type === "string" ? ev.type : "";
  const metadata = (obj.metadata as Record<string, unknown> | undefined) ?? {};
  const orderId = typeof metadata.orderId === "string" ? metadata.orderId : null;
  // La factura viaja en metadata tanto de la sesión como del PaymentIntent; si
  // faltara, `client_reference_id` de la sesión lleva el mismo id como respaldo.
  const invoiceId =
    typeof metadata.invoiceId === "string"
      ? metadata.invoiceId
      : typeof obj.client_reference_id === "string"
        ? obj.client_reference_id
        : null;

  // checkout.session.completed → amount_total; payment_intent.succeeded → amount.
  const amountRaw = obj.amount_total ?? obj.amount;
  const amountCents = typeof amountRaw === "number" ? amountRaw : null;
  const currency = typeof obj.currency === "string" ? obj.currency : null;

  // "Éxito" según el tipo de evento (y, en checkout, que el pago esté pagado).
  const succeeded =
    type === "payment_intent.succeeded" ||
    (type === "checkout.session.completed" && obj.payment_status === "paid");

  return {
    id: typeof ev.id === "string" ? ev.id : "",
    type,
    succeeded,
    orderId,
    invoiceId,
    amountCents,
    currency,
    raw,
  };
}

function makeStripeVerifier(secret: string): PaymentVerifier {
  return {
    provider: "stripe",
    verify(rawBody, headers): VerifyResult {
      const header = headers.get("stripe-signature");
      if (!header) return { ok: false, reason: "invalid", detail: "missing signature header" };

      const parsed = parseStripeSigHeader(header);
      if (!parsed) return { ok: false, reason: "invalid", detail: "malformed signature header" };

      // Anti-replay: el timestamp firmado no puede ser demasiado antiguo.
      const ageSeconds = Math.abs(Math.floor(Date.now() / 1000) - parsed.t);
      if (ageSeconds > STRIPE_TOLERANCE_SECONDS) {
        return { ok: false, reason: "invalid", detail: "timestamp outside tolerance" };
      }

      // La firma se calcula sobre `${t}.${cuerpo_crudo}`.
      const expected = createHmac("sha256", secret)
        .update(`${parsed.t}.${rawBody}`)
        .digest("hex");

      const match = parsed.v1.some((sig) => hexEqual(sig, expected));
      if (!match) return { ok: false, reason: "invalid", detail: "signature mismatch" };

      let json: unknown;
      try {
        json = JSON.parse(rawBody);
      } catch {
        return { ok: false, reason: "invalid", detail: "body is not valid JSON" };
      }

      const event = normalizeStripeEvent(json);
      if (!event.id) return { ok: false, reason: "invalid", detail: "event without id" };
      return { ok: true, event };
    },
  };
}

/* ------------------------------ Selector ---------------------------------- */

/** Devuelve el verificador según los ajustes guardados (fail-closed). */
export async function getVerifier(): Promise<PaymentVerifier> {
  const { stripe } = await readSettings();

  // Sin secreto de firma no se puede verificar nada: inerte antes que inseguro.
  // El interruptor `enabled` corta el cobro, no la recepción: si se desactiva
  // con un pago ya en curso, aún queremos poder darlo por bueno.
  if (stripe.webhookSecret) {
    return makeStripeVerifier(stripe.webhookSecret);
  }

  // TODO(pasarela): añadir aquí "redsys" / "paypal" cuando se elija, devolviendo
  // su propio PaymentVerifier. Hasta entonces, inerte.
  return nullVerifier;
}
