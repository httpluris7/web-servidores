import { NextResponse } from "next/server";
import { readSettings, wiseHasCreds } from "@/lib/ajustes";
import { verifyWiseWebhook } from "@/lib/payments/wise";
import { comprobarWise } from "@/lib/payments/wise-reconcile";
import { clientIp, rateLimit } from "@/lib/rate-limit";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Webhook de Wise: DISPARADOR del conciliador (no entrega por sí mismo).
 *
 * El evento `balances#credit` de Wise avisa de que ha entrado dinero, pero NO trae
 * la referencia del pago. Por eso aquí no se casa nada: solo se ADELANTA el sondeo
 * (`comprobarWise`), que lee el statement autenticado (SCA), casa por referencia
 * `VH…` y valida el importe. El sondeo periódico de 5 min sigue como red de
 * seguridad por si un webhook se pierde o se retrasa. Todo es idempotente (por
 * `referenceNumber`), así que webhook + sondeo nunca provocan doble entrega.
 *
 * Seguridad: un webhook falsificado, como mucho, dispara un re-sondeo (que lee
 * datos reales y es idempotente); NUNCA puede inyectar un pago. Aun así:
 *  - Se verifica la firma `X-Signature-SHA256` (RSA-SHA256) con la clave pública
 *    de Wise (fail-closed: sin clave o firma inválida → 400, no se dispara nada).
 *  - Se limita el ritmo por IP para que nadie fuerce sondeos en bucle.
 *  - Se responde 2xx rápido (fire-and-forget) para que Wise no reintente.
 */
export async function POST(req: Request) {
  // Cuerpo CRUDO: la firma se calcula sobre estos bytes exactos. No usar json().
  const raw = await req.text();

  // Antirráfagas: el webhook solo dispara un re-sondeo, pero evitamos spam.
  const rl = rateLimit(`wise-webhook:${clientIp(req)}`, { limit: 60, windowMs: 60_000 });
  if (!rl.ok) {
    return NextResponse.json(
      { ok: false, error: "Too many requests." },
      { status: 429, headers: { "Retry-After": String(rl.retryAfter) } }
    );
  }

  const { wise } = await readSettings();

  // Firma obligatoria y válida. Fail-closed: si Wise rotara la clave, la firma no
  // validaría y nos quedaríamos con el sondeo de 5 min (nunca con entrega falsa).
  const sig = req.headers.get("x-signature-sha256") ?? req.headers.get("x-signature");
  if (!sig || !verifyWiseWebhook(raw, sig, wise.webhookPublicKey)) {
    return NextResponse.json({ ok: false, error: "Invalid signature." }, { status: 400 });
  }

  // Evento (defensivo). El test de alta de suscripción también viene firmado y cae
  // aquí: se responde 200 sin más.
  let evt: { event_type?: string; data?: unknown } = {};
  try {
    evt = JSON.parse(raw || "{}");
  } catch {
    // Firmado pero no es JSON: lo damos por reconocido para que Wise no reintente.
    return NextResponse.json({ ok: true, ignored: true });
  }

  const type = String(evt.event_type ?? "");

  // Solo un abono a una balance adelanta el conciliador; el resto se reconoce e ignora.
  if (type.startsWith("balances#credit")) {
    if (wise.enabled && wiseHasCreds(wise)) {
      // Fire-and-forget: no bloquear la respuesta del webhook con el sondeo.
      void comprobarWise();
    }
  }

  return NextResponse.json({ ok: true, type });
}
