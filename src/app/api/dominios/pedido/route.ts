import { NextResponse } from "next/server";
import { clientIp, rateLimit } from "@/lib/rate-limit";
import { clean, saveLead } from "@/lib/leads";
import { getSession } from "@/lib/session";
import { getPublicUserById } from "@/lib/auth";
import { njallaHasCreds, readSettings } from "@/lib/ajustes";
import { checkoutOrder, type CheckoutMethod } from "@/lib/payments/checkout";
import { transferRef } from "@/lib/facturas";
import { checkDomain, NjallaError } from "@/lib/domains/njalla";
import { precioDominioEur } from "@/lib/domains/precio";
import { registrarDomainIntent } from "@/lib/domains/intents";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const DOMINIO_RE = /^[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?\.[a-z0-9.-]{2,}$/;

/**
 * Compra de un dominio: revalida el precio contra Njalla (NUNCA se fía del que
 * venga del cliente), emite la proforma con el motor de pago de siempre
 * (`checkoutOrder`, transferencia/tarjeta) y deja anotada la intención de
 * registro para cuando la factura pase a pagada (CP3). El registro real NO se
 * hace aquí (eso gasta del monedero y ocurre al cobrar).
 */
export async function POST(req: Request) {
  const limit = rateLimit(`dominios-pedido:${clientIp(req)}`, { limit: 10, windowMs: 10 * 60_000 });
  if (!limit.ok) {
    return NextResponse.json(
      { ok: false, error: "Too many attempts. Please try again in a few minutes." },
      { status: 429, headers: { "Retry-After": String(limit.retryAfter) } },
    );
  }

  // Contratar exige cuenta (igual que los VPS): sin sesión, 401 y la UI lleva al acceso.
  const session = await getSession();
  const user = session ? await getPublicUserById(session.uid) : null;
  if (!user) {
    return NextResponse.json(
      { ok: false, error: "You need to be logged in to complete the order." },
      { status: 401 },
    );
  }

  let body: Record<string, unknown>;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ ok: false, error: "Invalid JSON." }, { status: 400 });
  }

  // El nombre y el email salen de la cuenta, no del cliente: así el pedido no se
  // puede emitir a nombre de otro.
  const name = `${user.nombre} ${user.apellidos}`.trim() || user.nombre;
  const email = user.email;
  const domain = clean(body.domain, 80).toLowerCase();
  const years = Math.min(10, Math.max(1, Math.floor(Number(body.years) || 1)));
  const metodo: CheckoutMethod = body.metodo === "tarjeta" ? "tarjeta" : "transferencia";
  const locale = clean(body.locale, 5) || undefined;

  if (!DOMINIO_RE.test(domain)) {
    return NextResponse.json({ ok: false, errors: { domain: "Invalid domain." } }, { status: 422 });
  }

  const { njalla } = await readSettings();
  if (!njallaHasCreds(njalla)) {
    return NextResponse.json({ ok: false, error: "unconfigured" }, { status: 503 });
  }

  // Revalidación autoritativa: disponibilidad + precio actual desde Njalla.
  let precioAnual: number;
  try {
    const oferta = await checkDomain(domain);
    if (!oferta || oferta.status.toLowerCase() !== "available" || oferta.price == null) {
      return NextResponse.json({ ok: false, error: "unavailable" }, { status: 409 });
    }
    precioAnual = precioDominioEur(oferta.price, njalla.margenPct);
  } catch (err) {
    const reason = err instanceof NjallaError ? err.reason : "api";
    console.error("[dominios] fallo revalidando", domain, reason, err);
    return NextResponse.json({ ok: false, error: "provider" }, { status: 502 });
  }

  const idioma: "es" | "en" = locale?.startsWith("es") ? "es" : "en";

  const lineas = [
    {
      concepto: `Dominio ${domain}`,
      descripcion:
        idioma === "es"
          ? `${years} año${years > 1 ? "s" : ""} · privacidad WHOIS incluida`
          : `${years} year${years > 1 ? "s" : ""} · WHOIS privacy included`,
      cantidad: years,
      precioUnitario: precioAnual,
      productId: `domain:${domain}`,
    },
  ];

  // Lead best-effort (como en /api/pedidos): si no se puede guardar, se corta.
  try {
    await saveLead("dominio", { name, email, domain, years, precioAnual });
  } catch {
    return NextResponse.json(
      { ok: false, error: "The order could not be saved. Please try again." },
      { status: 500 },
    );
  }

  try {
    const { invoice, paymentUrl } = await checkoutOrder({
      userId: user.id,
      clienteNombre: name,
      clienteEmail: email,
      lineas,
      metodo,
      locale,
      cancelPath: "/dominios",
    });

    // Intención de registro: la ejecuta el pago (webhook/conciliador) al pagar.
    try {
      await registrarDomainIntent({
        invoiceId: invoice.id,
        domain,
        years,
        userId: user.id,
        email,
        idioma,
        renewal: false,
      });
    } catch (err) {
      console.error("[dominios] no se pudo registrar la intención de dominio", err);
    }

    return NextResponse.json({
      ok: true,
      numero: invoice.numero,
      refPago: transferRef(invoice),
      paymentUrl,
    });
  } catch (err) {
    console.error("[dominios] no se pudo emitir la proforma de", email, err);
    return NextResponse.json({ ok: true, numero: null, paymentUrl: null });
  }
}
