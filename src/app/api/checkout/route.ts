import { randomUUID } from "node:crypto";
import { NextResponse } from "next/server";
import { saveLead, clean } from "@/lib/leads";
import { getPlanById, regions, vps } from "@/data/products";
import { getSession } from "@/lib/session";
import { getPublicUserById } from "@/lib/auth";
import { checkoutOrder, type CheckoutMethod } from "@/lib/payments/checkout";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const MAX_QTY = 99;
const MAX_ITEMS = 50;

type IncomingItem = { planId?: unknown; qty?: unknown; region?: unknown };

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
    line: string;
  }[] = [];

  for (const item of rawItems) {
    const planId = clean(item.planId, 60);
    const located = getPlanById(planId);
    if (!located) {
      return NextResponse.json(
        { ok: false, error: `Invalid plan: ${planId || "unknown"}.` },
        { status: 422 }
      );
    }
    const qty = clampQty(item.qty);
    const isVps = located.lineSlug === vps.slug;
    const regionSlug = clean(item.region, 60);
    const region = isVps && regions.some((r) => r.slug === regionSlug) ? regionSlug : "";

    validated.push({
      planId,
      planName: located.plan.name,
      price: located.plan.price,
      qty,
      lineTotal: located.plan.price * qty,
      region,
      line: located.lineTitle,
    });
  }

  // 4) Persistir. Un lead "pedido" por línea, agrupadas por un orderId común y
  //    ligadas al usuario autenticado, para que el panel de admin las liste.
  const orderId = randomUUID();
  const total = validated.reduce((sum, v) => sum + v.lineTotal, 0);
  const clienteNombre = `${user.nombre} ${user.apellidos}`.trim();

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
      lineas: validated.map((v) => ({
        concepto: v.planName,
        descripcion: [v.line, v.region].filter(Boolean).join(" · "),
        cantidad: v.qty,
        precioUnitario: v.price,
        productId: v.planId,
      })),
      metodo,
      locale,
      cancelPath: "/carrito",
      notas: `Order ${orderId}`,
    });

    return NextResponse.json({
      ok: true,
      orderId,
      total,
      numero: invoice.numero,
      paymentUrl,
    });
  } catch (err) {
    // El pedido ya está guardado; solo falló la facturación. No lo perdemos:
    // se responde bien y queda registrado para emitir la proforma a mano.
    console.error("[checkout] no se pudo emitir la proforma del pedido", orderId, err);
    return NextResponse.json({ ok: true, orderId, total, numero: null, paymentUrl: null });
  }
}
