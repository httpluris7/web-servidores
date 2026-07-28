import { NextResponse } from "next/server";
import { getSession } from "@/lib/session";
import { readSettings } from "@/lib/ajustes";
import { getInvoiceForUser, setInvoicePayment } from "@/lib/facturas";
import { createCheckoutSession, StripeError } from "@/lib/payments/stripe";
import { returnUrls } from "@/lib/payments/urls";
import { clientIp, rateLimit } from "@/lib/rate-limit";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Enlace de pago con tarjeta de UNA FACTURA PROPIA.
 *
 * Es la versión para el cliente de lo que el panel hace desde la factura. La
 * diferencia está en el control de acceso: aquí no basta con estar autenticado,
 * la factura tiene que ser suya (`getInvoiceForUser`), y solo se puede pagar lo
 * que está pendiente. Un id ajeno responde igual que uno inexistente, para no
 * revelar qué facturas existen.
 */
export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ ok: false, error: "Not authenticated." }, { status: 401 });
  }

  const limit = rateLimit(`pago-cliente:${clientIp(req)}`, { limit: 20, windowMs: 10 * 60_000 });
  if (!limit.ok) {
    return NextResponse.json(
      { ok: false, error: "Too many attempts. Please try again in a few minutes." },
      { status: 429, headers: { "Retry-After": String(limit.retryAfter) } }
    );
  }

  const { id } = await params;
  const inv = await getInvoiceForUser(id, session.uid, session.email);
  if (!inv) {
    return NextResponse.json({ ok: false, error: "Invoice not found." }, { status: 404 });
  }
  if (inv.estado !== "pendiente" || inv.total <= 0) {
    return NextResponse.json({ ok: false, error: "This invoice cannot be paid." }, { status: 409 });
  }

  const { stripe } = await readSettings();
  if (!stripe.enabled || !stripe.secretKey) {
    return NextResponse.json({ ok: false, error: "card_unavailable" }, { status: 409 });
  }

  const body = (await req.json().catch(() => ({}))) as { locale?: unknown };
  const locale = typeof body.locale === "string" ? body.locale : undefined;

  // Si ya hay un enlace vivo se reutiliza: es el mismo cobro, y crear sesiones
  // nuevas en cada clic llenaría la cuenta de Stripe de intentos abandonados.
  if (inv.pago) {
    return NextResponse.json({ ok: true, url: inv.pago.url, reused: true });
  }

  try {
    const session_ = await createCheckoutSession(stripe.secretKey, inv, {
      ...returnUrls(locale, `/cuenta/facturas/${inv.id}`),
      locale,
      attempt: 1,
    });
    if (!session_.url) {
      return NextResponse.json({ ok: false, error: "card_unavailable" }, { status: 502 });
    }
    await setInvoicePayment(inv.id, {
      provider: "stripe",
      sessionId: session_.id,
      url: session_.url,
      createdAt: new Date().toISOString(),
      intentos: 1,
    });
    return NextResponse.json({ ok: true, url: session_.url, reused: false });
  } catch (err) {
    // El detalle de la pasarela es interno: al cliente solo le decimos que la
    // tarjeta no está disponible, y queda registrado para revisarlo.
    const detalle = err instanceof StripeError ? err.message : String(err);
    console.error("[payments] cobro de cliente fallido:", inv.numero, detalle);
    return NextResponse.json({ ok: false, error: "card_unavailable" }, { status: 502 });
  }
}
