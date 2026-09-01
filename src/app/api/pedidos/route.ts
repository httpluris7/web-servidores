import { NextResponse } from "next/server";
import { saveLead, clean, emailRe } from "@/lib/leads";
import { getCatalog, regionsForPlan } from "@/data/products";
import { clientIp, rateLimit } from "@/lib/rate-limit";
import { getSession } from "@/lib/session";
import { checkoutOrder, type CheckoutMethod } from "@/lib/payments/checkout";
import { findDuplicateOrder } from "@/lib/payments/duplicados";
import { registrarIntent } from "@/lib/provisioner/intents";
import { OS_DEFAULT, esOfertableParaDisco, discoGbDeTexto } from "@/lib/provisioner/os";

/** Hostname url/DNS-safe a partir de lo que teclee el cliente (o null si no da nada). */
function saneaHostname(raw: string): string | null {
  const h = raw
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9-]+/g, "-")
    .replace(/(^-+|-+$)/g, "")
    .slice(0, 60);
  return h || null;
}

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
  // SO y hostname del VPS. El SO se acota a la lista conocida (un slug raro se
  // reconduce al de por defecto en vez de tumbar el checkout); el hostname es
  // opcional (el provisioner genera uno si no llega).
  const osRaw = clean(body.os, 40);
  const hostname = saneaHostname(clean(body.hostname, 80));

  const errors: Record<string, string> = {};
  if (name.length < 2) errors.name = "Enter your name or company.";
  if (!emailRe.test(email)) errors.email = "Enter a valid email.";

  const catalog = await getCatalog();
  const { allPlans, regions } = catalog;
  const located = allPlans.find((p) => p.plan.id === planId);
  if (!located) errors.planId = "Invalid plan.";

  // La región debe ser una válida para el plan: los planes con gama por región
  // (p. ej. Germany) no se contratan en otra ubicación, y a la inversa. Así no se
  // emite una proforma que el aprovisionador rechazaría por disponibilidad.
  if (located && located.lineTipo === "vps") {
    const permitidas = regionsForPlan(catalog, planId).map((r) => r.slug);
    if (!permitidas.includes(region)) errors.region = "This plan is not available in that region.";
  }

  if (Object.keys(errors).length > 0) {
    return NextResponse.json({ ok: false, errors }, { status: 422 });
  }

  // SO acotado a los ofertables y que además quepan en el disco del plan (un
  // slug raro o incompatible cae al de por defecto en vez de tumbar el checkout).
  const planDisco = discoGbDeTexto(located!.plan.storage);
  const osSlug = esOfertableParaDisco(osRaw, planDisco) ? osRaw : OS_DEFAULT;

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

    // Money-path: si es un VPS en una región conectada a un Proxmox, dejamos
    // atada a la factura la intención de aprovisionar. El webhook (tarjeta) o el
    // panel (transferencia) la ejecutan cuando la proforma pase a pagada. La
    // ubicación de despliegue sale de la propia región (`provisionLocation`),
    // nunca del cliente. Best-effort: no romper el checkout por esto.
    const regionObj = regions.find((r) => r.slug === region);
    const locationSlug = regionObj?.provisionLocation;
    if (located!.lineTipo === "vps" && locationSlug) {
      try {
        await registrarIntent({
          invoiceId: invoice.id,
          planSlug: planId,
          userId: session?.uid ?? null,
          email,
          locationSlug,
          osSlug,
          hostname,
          idioma: locale?.startsWith("es") ? "es" : "en",
        });
      } catch (err) {
        console.error("[pedidos] no se pudo registrar la intención de aprovisionamiento", err);
      }
    }

    return NextResponse.json({
      ok: true,
      numero: invoice.numero,
      refPago: invoice.refPago,
      paymentUrl,
    });
  } catch (err) {
    // El pedido ya está guardado; la proforma se emitirá a mano si hace falta.
    console.error("[pedidos] no se pudo emitir la proforma de", email, err);
    return NextResponse.json({ ok: true, numero: null, paymentUrl: null });
  }
}
