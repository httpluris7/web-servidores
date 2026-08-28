import { NextResponse } from "next/server";
import { getSession } from "@/lib/session";
import { rateLimit } from "@/lib/rate-limit";
import { esDespliegueDeUsuario } from "@/lib/provisioner/despliegues";
import { getOrder, ProvisionerError } from "@/lib/provisioner/client";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Estado del aprovisionamiento de un pedido, para el sondeo de la pantalla de
 * despliegue en vivo. Solo lo ve su dueño (comprobado contra el registro de
 * despliegues), nunca por adivinar el número de pedido.
 */
export async function GET(_req: Request, ctx: { params: Promise<{ orderId: string }> }) {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ ok: false, error: "Unauthorized." }, { status: 401 });
  }
  const { orderId: raw } = await ctx.params;
  const orderId = Number(raw);
  if (!Number.isInteger(orderId) || orderId <= 0) {
    return NextResponse.json({ ok: false, error: "Not found." }, { status: 404 });
  }

  // Tope de sondeo por usuario y pedido: la pantalla consulta cada 3 s.
  const limite = rateLimit(`despliegue:${session.uid}:${orderId}`, { limit: 60, windowMs: 60_000 });
  if (!limite.ok) {
    return NextResponse.json(
      { ok: false, error: "Too many requests.", retryAfter: limite.retryAfter },
      { status: 429, headers: { "Retry-After": String(limite.retryAfter) } },
    );
  }

  // Pertenencia: un pedido ajeno responde como inexistente.
  if (!(await esDespliegueDeUsuario(orderId, session.uid))) {
    return NextResponse.json({ ok: false, error: "Not found." }, { status: 404 });
  }

  try {
    const order = await getOrder(orderId);
    // Solo lo necesario para la pantalla; nada sensible.
    return NextResponse.json({
      ok: true,
      estado: order.estado,
      plan: order.plan,
      os: order.os,
      ubicacion: order.ubicacion,
      // El texto de error del provisioner es interno; la pantalla muestra su
      // propio mensaje. Solo señalamos que HAY error.
      fallo: order.estado === "failed",
    });
  } catch (err) {
    console.error(
      "[despliegue] no se pudo leer el pedido",
      orderId,
      err instanceof ProvisionerError ? `${err.status ?? ""} ${err.message}` : err,
    );
    return NextResponse.json(
      { ok: false, error: "Could not reach the provisioner." },
      { status: 502 },
    );
  }
}
