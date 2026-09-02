import { randomUUID } from "node:crypto";
import { NextResponse } from "next/server";
import { saveLead, clean } from "@/lib/leads";
import { getCatalog, regionsForPlan } from "@/data/products";
import { defaultVpsRegionSlug } from "@/lib/regions";
import { getSession } from "@/lib/session";
import { getPublicUserById } from "@/lib/auth";
import { checkoutOrder, type CheckoutMethod } from "@/lib/payments/checkout";
import { findDuplicateOrder } from "@/lib/payments/duplicados";
import { registrarIntent } from "@/lib/provisioner/intents";
import { registrarHostingIntent } from "@/lib/hosting/intents";
import { paqueteDePlan } from "@/lib/hosting/paquetes";
import { normalizarDominioHost } from "@/lib/hosting/dominio";
import { OS_DEFAULT, discoGbDeTexto, esOfertableParaDisco } from "@/lib/provisioner/os";
import { transferRef } from "@/lib/facturas";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const MAX_QTY = 99;
const MAX_ITEMS = 50;

type IncomingItem = {
  planId?: unknown;
  qty?: unknown;
  region?: unknown;
  os?: unknown;
  domain?: unknown;
};

function clampQty(raw: unknown): number {
  const n = typeof raw === "number" ? raw : Number(raw);
  if (!Number.isFinite(n)) return 1;
  return Math.min(MAX_QTY, Math.max(1, Math.floor(n)));
}

export async function POST(req: Request) {
  // 1) El checkout exige sesión: sin usuario registrado no se completa el pedido.
  const session = await getSession();
  if (!session) {
    return NextResponse.json(
      { ok: false, error: "You need to be logged in to complete the order." },
      { status: 401 }
    );
  }
  const user = await getPublicUserById(session.uid);
  if (!user) {
    return NextResponse.json(
      { ok: false, error: "You need to be logged in to complete the order." },
      { status: 401 }
    );
  }

  // 2) Cuerpo de la petición.
  let body: { items?: unknown; metodo?: unknown; locale?: unknown };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ ok: false, error: "Invalid JSON." }, { status: 400 });
  }

  const rawItems = Array.isArray(body.items) ? (body.items as IncomingItem[]) : [];
  if (rawItems.length === 0) {
    return NextResponse.json({ ok: false, error: "Your cart is empty." }, { status: 400 });
  }
  if (rawItems.length > MAX_ITEMS) {
    return NextResponse.json({ ok: false, error: "Too many items in the cart." }, { status: 400 });
  }

  // 3) Validar y normalizar cada línea contra el catálogo (fuente de verdad de
  //    precios; ignoramos cualquier precio que pudiera venir del cliente).
  const validated: {
    planId: string;
    planName: string;
    price: number;
    qty: number;
    lineTotal: number;
    region: string;
    osSlug: string;
    /** Dominio a alojar (solo hosting; null = temporal). */
    domain: string | null;
    line: string;
  }[] = [];

  const catalog = await getCatalog();
  const { allPlans, regions } = catalog;

  for (const item of rawItems) {
    const planId = clean(item.planId, 60);
    const located = allPlans.find((p) => p.plan.id === planId);
    if (!located) {
      return NextResponse.json(
        { ok: false, error: `Invalid plan: ${planId || "unknown"}.` },
        { status: 422 }
      );
    }
    const qty = clampQty(item.qty);
    const isVps = located.lineTipo === "vps";
    // La región debe ser válida para el plan (los planes con gama por región solo
    // en la suya). Si la del carrito no lo es, se reconduce a una válida —prefiere
    // provisionable— en vez de crear un pedido que no se podría aprovisionar.
    const permitidas = isVps ? regionsForPlan(catalog, planId) : [];
    const regionSlug = clean(item.region, 60);
    const region = !isVps
      ? ""
      : permitidas.some((r) => r.slug === regionSlug)
        ? regionSlug
        : permitidas.length
          ? defaultVpsRegionSlug(permitidas)
          : "";

    // SO elegido en el carrito: se acota a los ofertables que caben en el disco
    // del plan (un slug raro o que no cabe cae al de por defecto, como en /api/pedidos).
    const osRaw = clean(item.os, 40);
    const osSlug = isVps && esOfertableParaDisco(osRaw, discoGbDeTexto(located.plan.storage))
      ? osRaw
      : OS_DEFAULT;

    // Dominio a alojar (solo hosting): se normaliza/valida; inválido o vacío → temporal.
    const domain = located.lineTipo === "hosting" ? normalizarDominioHost(item.domain) : null;

    validated.push({
      planId,
      planName: located.plan.name,
      price: located.plan.price,
      qty,
      lineTotal: located.plan.price * qty,
      region,
      osSlug,
      domain,
      line: located.lineTitle,
    });
  }

  // 4) Persistir. Un lead "pedido" por línea, agrupadas por un orderId común y
  //    ligadas al usuario autenticado, para que el panel de admin las liste.
  const orderId = randomUUID();
  const total = validated.reduce((sum, v) => sum + v.lineTotal, 0);
  const clienteNombre = `${user.nombre} ${user.apellidos}`.trim();

  const lineas = validated.map((v) => ({
    concepto: v.planName,
    descripcion: [v.line, v.region].filter(Boolean).join(" · "),
    cantidad: v.qty,
    precioUnitario: v.price,
    productId: v.planId,
  }));

  // ¿El mismo carrito confirmado hace un momento (doble clic, vuelta atrás y
  // reenvío)? Se mira antes de guardar para anotarlo en las líneas del pedido.
  const duplicado = await findDuplicateOrder(user.email, lineas);

  try {
    for (const v of validated) {
      await saveLead("pedido", {
        orderId,
        userId: user.id,
        name: clienteNombre,
        email: user.email,
        planId: v.planId,
        planName: v.planName,
        price: v.price,
        qty: v.qty,
        lineTotal: v.lineTotal,
        region: v.region,
        line: v.line,
        duplicadoDe: duplicado?.numero ?? null,
      });
    }
  } catch {
    return NextResponse.json(
      { ok: false, error: "The order could not be saved. Please try again." },
      { status: 500 }
    );
  }

  // 5) Emitir la proforma del pedido y, si pidió tarjeta, abrir el cobro. El
  //    cliente necesita el número de proforma pague como pague: es la
  //    referencia de la transferencia y el identificador de su pedido.
  const metodo: CheckoutMethod = body.metodo === "tarjeta" ? "tarjeta" : "transferencia";
  const locale = typeof body.locale === "string" ? body.locale : undefined;

  try {
    const { invoice, paymentUrl } = await checkoutOrder({
      userId: user.id,
      clienteNombre,
      clienteEmail: user.email,
      lineas,
      metodo,
      locale,
      cancelPath: "/carrito",
      notas: `Order ${orderId}`,
      duplicado,
    });

    // Money-path (igual que /api/pedidos): por cada línea VPS en una región
    // conectada a un Proxmox dejamos atada a la factura la intención de
    // aprovisionar; el webhook (tarjeta) o el panel (transferencia) la ejecutan
    // al pasar a pagada. El SO es el elegido en el carrito; el hostname lo genera
    // el provisioner. Best-effort: no romper el checkout.
    for (const v of validated) {
      const located = allPlans.find((p) => p.plan.id === v.planId);
      if (located?.lineTipo !== "vps" || !v.region) continue;
      const locationSlug = regions.find((r) => r.slug === v.region)?.provisionLocation;
      if (!locationSlug) continue;
      if (v.qty > 1) {
        // El modelo de intención es 1 máquina por (factura, plan): un qty>1 solo
        // aprovisiona una automáticamente. La red de seguridad lo marca en la
        // factura para atender las extra a mano.
        console.warn(`[checkout] VPS con qty=${v.qty}; solo se aprovisiona 1 automáticamente:`, v.planId, "factura", invoice.id);
      }
      try {
        await registrarIntent({
          invoiceId: invoice.id,
          planSlug: v.planId,
          userId: user.id,
          email: user.email,
          locationSlug,
          osSlug: v.osSlug,
          hostname: null,
          idioma: locale?.startsWith("es") ? "es" : "en",
        });
      } catch (err) {
        console.error("[checkout] no se pudo registrar la intención de aprovisionamiento", v.planId, err);
      }
    }

    // Money-path del hosting: por cada línea de hosting dejamos atada a la
    // factura la intención de alta en cPanel; al pasar a pagada se crea la
    // cuenta (`aprovisionarHostingFacturaPagada`). Una cuenta por (factura,
    // plan): un qty>1 solo crea una automáticamente. Best-effort.
    for (const v of validated) {
      const located = allPlans.find((p) => p.plan.id === v.planId);
      if (located?.lineTipo !== "hosting") continue;
      const pkg = paqueteDePlan(v.planId);
      if (!pkg) continue; // plan de hosting sin paquete cPanel: alta manual
      try {
        await registrarHostingIntent({
          invoiceId: invoice.id,
          planId: v.planId,
          cpanelPackage: pkg,
          userId: user.id,
          email: user.email,
          nombre: clienteNombre,
          idioma: locale?.startsWith("es") ? "es" : "en",
          requestedDomain: v.domain,
        });
      } catch (err) {
        console.error("[checkout] no se pudo registrar la intención de hosting", v.planId, err);
      }
    }

    return NextResponse.json({
      ok: true,
      orderId,
      total,
      numero: invoice.numero,
      refPago: transferRef(invoice),
      paymentUrl,
    });
  } catch (err) {
    // El pedido ya está guardado; solo falló la facturación. No lo perdemos:
    // se responde bien y queda registrado para emitir la proforma a mano.
    console.error("[checkout] no se pudo emitir la proforma del pedido", orderId, err);
    return NextResponse.json({ ok: true, orderId, total, numero: null, paymentUrl: null });
  }
}
