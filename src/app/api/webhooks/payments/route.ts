import { NextResponse } from "next/server";
import { getVerifier } from "@/lib/payments/verify";
import { reserve, release, markProcessed } from "@/lib/payments/events";
import { fulfillOrder } from "@/lib/payments/fulfill";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Webhook de pasarela de pago (agnóstico de proveedor).
 *
 * Propiedades de seguridad garantizadas aquí:
 *  - Verificación de FIRMA sobre el cuerpo CRUDO (req.text(), sin reparsear).
 *  - Anti-replay (la implementación del proveedor valida el timestamp firmado).
 *  - IDEMPOTENCIA: cada event.id se procesa una sola vez (reserva atómica).
 *  - Validación de IMPORTE contra el total recalculado servidor-side.
 *  - Fail-closed: si no hay pasarela configurada, responde 503 y no hace nada.
 *
 * Convención de códigos pensada para los reintentos del proveedor:
 *  - 2xx  → procesado (o ignorado/duplicado): el proveedor NO reintenta.
 *  - 4xx  → firma inválida o petición mala: NO reintentar (no se arregla solo).
 *  - 5xx  → fallo transitorio nuestro: el proveedor DEBE reintentar.
 */
export async function POST(req: Request) {
  // 1) Cuerpo CRUDO: la firma se calcula sobre los bytes exactos. No usar json().
  const rawBody = await req.text();

  // 2) Verificar firma + normalizar evento (según pasarela configurada).
  const verifier = getVerifier();
  const result = await verifier.verify(rawBody, req.headers);

  if (!result.ok) {
    if (result.reason === "unconfigured") {
      return NextResponse.json(
        { ok: false, error: "Payments webhook not configured." },
        { status: 503 }
      );
    }
    // Firma inválida / replay / cuerpo no válido → 400, sin reintento.
    return NextResponse.json({ ok: false, error: "Invalid signature." }, { status: 400 });
  }

  const event = result.event;

  // 3) Solo nos interesan los pagos confirmados; el resto se reconoce y se ignora.
  if (!event.succeeded) {
    return NextResponse.json({ ok: true, ignored: true, type: event.type });
  }

  // 4) Idempotencia: reservar el id. Si ya estaba visto, es un duplicado → ack.
  const fresh = await reserve(event.id);
  if (!fresh) {
    return NextResponse.json({ ok: true, duplicate: true });
  }

  try {
    // 5) Fulfillment + validación de importe.
    const outcome = await fulfillOrder(event);

    if (!outcome.ok) {
      // Descuadres / pedido desconocido: lo MARCAMOS como procesado-rechazado
      // (para no entrar en bucle de reintentos) y respondemos 200, pero NO se
      // cumple el pedido. Queda registrado para revisión manual.
      await markProcessed(event, { fulfilled: false, rejection: outcome });
      console.error("[payments] webhook rejected:", event.id, outcome);
      return NextResponse.json({ ok: true, fulfilled: false, reason: outcome.reason });
    }

    // 6) Éxito: registrar como procesado y reconocer.
    await markProcessed(event, { fulfilled: true });
    return NextResponse.json({ ok: true, fulfilled: true });
  } catch (err) {
    // Fallo infraestructural real: liberamos la reserva para permitir el
    // reintento del proveedor y devolvemos 5xx.
    release(event.id);
    console.error("[payments] webhook processing error:", event.id, err);
    return NextResponse.json({ ok: false, error: "Processing error." }, { status: 500 });
  }
}
