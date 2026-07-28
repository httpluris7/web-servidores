import { NextResponse } from "next/server";
import { getAdminSession } from "@/lib/admin";
import { readSettings } from "@/lib/ajustes";
import { getInvoiceById, setInvoicePayment, type Invoice } from "@/lib/facturas";
import { emailInvoiceDocument } from "@/lib/invoice-notify";
import { createCheckoutSession, retrieveCheckoutSession, StripeError } from "@/lib/payments/stripe";
import { returnUrls } from "@/lib/payments/urls";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Enlace de pago con tarjeta de una factura (solo admin).
 *
 * POST crea la sesión de Checkout y devuelve la URL para enviársela al cliente.
 * Si ya hay una guardada se reutiliza, salvo que se pida `regenerar: true` —lo
 * normal cuando la anterior ha caducado (Stripe las cierra a las 24 h)—.
 *
 * GET consulta en Stripe el estado del enlace ya creado, para poder comprobar a
 * mano un cobro cuando el webhook no ha llegado.
 */

/**
 * Reenvía la proforma al cliente. El PDF y el correo ya incluyen el enlace de
 * pago si la factura lo tiene, así que basta con volver a enviarla. Best-effort:
 * el enlace ya está creado y no queremos perderlo por un fallo de correo.
 */
async function resendProforma(inv: Invoice): Promise<boolean> {
  try {
    await emailInvoiceDocument(inv);
    return true;
  } catch (err) {
    console.error("[payments] no se pudo reenviar la proforma", inv.id, err);
    return false;
  }
}

export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  if (!(await getAdminSession())) {
    return NextResponse.json({ ok: false, error: "Unauthorized." }, { status: 403 });
  }

  const { id } = await params;
  const inv = await getInvoiceById(id);
  if (!inv) {
    return NextResponse.json({ ok: false, error: "Invoice not found." }, { status: 404 });
  }
  if (inv.estado !== "pendiente") {
    return NextResponse.json(
      { ok: false, error: "Only pending invoices can be charged." },
      { status: 409 }
    );
  }
  if (inv.total <= 0) {
    return NextResponse.json({ ok: false, error: "The invoice total is zero." }, { status: 409 });
  }

  const { stripe } = await readSettings();
  if (!stripe.enabled || !stripe.secretKey) {
    return NextResponse.json(
      { ok: false, error: "Stripe is not configured. Set it up in Settings." },
      { status: 409 }
    );
  }

  const body = (await req.json().catch(() => ({}))) as {
    regenerar?: unknown;
    locale?: unknown;
    enviar?: unknown;
  };
  const regenerar = body.regenerar === true;
  const enviar = body.enviar === true;
  const locale = typeof body.locale === "string" ? body.locale : undefined;

  // Reutilizamos el enlace vivo: pedir otro sin necesidad solo confunde al
  // cliente, que puede tener el anterior en su correo.
  if (inv.pago && !regenerar) {
    const sent = enviar ? await resendProforma(inv) : null;
    return NextResponse.json({ ok: true, url: inv.pago.url, reused: true, sent });
  }

  try {
    const attempt = (inv.pago?.intentos ?? 0) + 1;
    const session = await createCheckoutSession(stripe.secretKey, inv, {
      ...returnUrls(locale),
      locale,
      attempt,
    });
    if (!session.url) {
      return NextResponse.json(
        { ok: false, error: "Stripe did not return a payment link." },
        { status: 502 }
      );
    }
    const updated = await setInvoicePayment(inv.id, {
      provider: "stripe",
      sessionId: session.id,
      url: session.url,
      createdAt: new Date().toISOString(),
      intentos: attempt,
    });
    const sent = enviar && updated ? await resendProforma(updated) : null;
    return NextResponse.json({ ok: true, url: session.url, reused: false, sent });
  } catch (err) {
    const message = err instanceof StripeError ? err.message : "Could not reach Stripe.";
    console.error("[payments] no se pudo crear el cobro de", inv.id, message);
    return NextResponse.json({ ok: false, error: message }, { status: 502 });
  }
}

export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  if (!(await getAdminSession())) {
    return NextResponse.json({ ok: false, error: "Unauthorized." }, { status: 403 });
  }

  const { id } = await params;
  const inv = await getInvoiceById(id);
  if (!inv) {
    return NextResponse.json({ ok: false, error: "Invoice not found." }, { status: 404 });
  }
  if (!inv.pago) {
    return NextResponse.json({ ok: false, error: "No payment link yet." }, { status: 404 });
  }

  const { stripe } = await readSettings();
  if (!stripe.secretKey) {
    return NextResponse.json({ ok: false, error: "Stripe is not configured." }, { status: 409 });
  }

  try {
    const session = await retrieveCheckoutSession(stripe.secretKey, inv.pago.sessionId);
    return NextResponse.json({
      ok: true,
      status: session.status,
      paymentStatus: session.payment_status,
      amountTotal: session.amount_total,
      currency: session.currency,
    });
  } catch (err) {
    const message = err instanceof StripeError ? err.message : "Could not reach Stripe.";
    return NextResponse.json({ ok: false, error: message }, { status: 502 });
  }
}
