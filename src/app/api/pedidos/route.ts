import { NextResponse } from "next/server";
import { saveLead, clean, emailRe } from "@/lib/leads";
import { getCatalog } from "@/data/products";
import { clientIp, rateLimit } from "@/lib/rate-limit";
import { getSession } from "@/lib/session";
import { checkoutOrder, type CheckoutMethod } from "@/lib/payments/checkout";
import { findDuplicateOrder } from "@/lib/payments/duplicados";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  // Anti-abuso: cada POST persiste un lead en disco. Tope por IP.
  const limit = rateLimit(`pedidos:${clientIp(req)}`, { limit: 10, windowMs: 10 * 60_000 });
  if (!limit.ok) {
    return NextResponse.json(
      { ok: false, error: "Too many attempts. Please try again in a few minutes." },
      { status: 429, headers: { "Retry-After": String(limit.retryAfter) } }
    );
  }

  let body: Record<string, unknown>;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ ok: false, error: "Invalid JSON." }, { status: 400 });
  }

  const name = clean(body.name, 120);
  const email = clean(body.email, 200);
  const planId = clean(body.planId, 60);
  const region = clean(body.region, 60);

  const errors: Record<string, string> = {};
  if (name.length < 2) errors.name = "Enter your name or company.";
  if (!emailRe.test(email)) errors.email = "Enter a valid email.";

  const { allPlans, regions } = await getCatalog();
  const located = allPlans.find((p) => p.plan.id === planId);
  if (!located) errors.planId = "Invalid plan.";

  if (Object.keys(errors).length > 0) {
    return NextResponse.json({ ok: false, errors }, { status: 422 });
  }

  const regionName = regions.find((r) => r.slug === region)?.name ?? region;
  const lineas = [
    {
      concepto: located!.plan.name,
      descripcion: [located!.lineTitle, regionName].filter(Boolean).join(" · "),
      cantidad: 1,
      precioUnitario: located!.plan.price,
      productId: planId,
    },
  ];

  // ¿Repite un pedido de hace un momento (doble clic, reenvío del formulario)?
  // Se mira antes de guardar para dejarlo anotado en el propio pedido.
  const duplicado = await findDuplicateOrder(email, lineas);

  try {
    await saveLead("pedido", {
      name,
      email,
      region,
      planId,
      planName: located!.plan.name,
      price: located!.plan.price,
      line: located!.lineTitle,
      duplicadoDe: duplicado?.numero ?? null,
    });
  } catch {
    return NextResponse.json(
      { ok: false, error: "The order could not be saved. Please try again." },
      { status: 500 }
    );
  }

  // Proforma del pedido (y cobro con tarjeta si lo eligió). Aquí puede no haber
  // sesión: si la hay, la factura queda ligada al cliente; si no, va suelta y el
  // panel la vinculará por email.
  const metodo: CheckoutMethod = body.metodo === "tarjeta" ? "tarjeta" : "transferencia";
  const locale = clean(body.locale, 5) || undefined;
  const session = await getSession();

  // Emitir la proforma manda un PDF con nuestra marca a una dirección que aquí
  // NO está verificada: sin sesión, este formulario es un pulsador para que
  // viahost.top escriba a quien sea, con el nombre que elija quien lo pulse.
  // El tope por IP no basta (las IPs rotan), así que se limita también por
  // destinatario y en conjunto. El pedido queda guardado igualmente: lo único
  // que se corta es el correo automático, y el panel lo ve.
  //
  // Un pedido repetido no gasta cupo: no emite proforma ni manda correo, solo
  // devuelve la que ya existe.
  if (!session && !duplicado) {
    const porDestinatario = rateLimit(`proforma-mail:${email.toLowerCase()}`, {
      limit: 3,
      windowMs: 60 * 60_000,
    });
    const enConjunto = rateLimit("proforma-anon", { limit: 30, windowMs: 60 * 60_000 });
    if (!porDestinatario.ok || !enConjunto.ok) {
      console.warn("[pedidos] proforma anónima limitada para", email);
      return NextResponse.json({ ok: true, numero: null, paymentUrl: null });
    }
  }

  try {
    const { invoice, paymentUrl } = await checkoutOrder({
      userId: session?.uid ?? null,
      clienteNombre: name,
      clienteEmail: email,
      lineas,
      metodo,
      locale,
      cancelPath: `/contratar/${planId}`,
      duplicado,
    });
    return NextResponse.json({
      ok: true,
      numero: invoice.numero,
      paymentUrl,
    });
  } catch (err) {
    // El pedido ya está guardado; la proforma se emitirá a mano si hace falta.
    console.error("[pedidos] no se pudo emitir la proforma de", email, err);
    return NextResponse.json({ ok: true, numero: null, paymentUrl: null });
  }
}
