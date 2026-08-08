import { NextResponse } from "next/server";
import { rateLimit } from "@/lib/rate-limit";
import { getSession } from "@/lib/session";
import { getManagedForUser } from "@/lib/servidores/cliente";
import { esRango, leerMetricas } from "@/lib/servidores/metricas";
import { esIdInterno } from "@/lib/servidores/store";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Serie de métricas de un servidor del cliente.
 *
 * La pertenencia se comprueba con `getManagedForUser`, el mismo punto único que
 * el resto del área de cliente: un servidor ajeno responde 404, igual que uno
 * inexistente, para no revelar qué hay en el sistema.
 */
export async function GET(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ ok: false, error: "Unauthorized." }, { status: 401 });
  }

  const { id } = await params;
  // Se descarta lo que no puede existir ANTES de usarlo como clave del límite
  // de ritmo, para que nadie lo llene inventando ids.
  if (!esIdInterno(id)) {
    return NextResponse.json({ ok: false, error: "Not found." }, { status: 404 });
  }

  const limite = rateLimit(`metricas:${session.uid}:${id}`, { limit: 60, windowMs: 60_000 });
  if (!limite.ok) {
    return NextResponse.json(
      { ok: false, error: "Too many requests." },
      { status: 429, headers: { "Retry-After": String(limite.retryAfter) } }
    );
  }

  const ficha = await getManagedForUser(id, session.uid);
  if (!ficha) return NextResponse.json({ ok: false, error: "Not found." }, { status: 404 });

  const pedido = new URL(req.url).searchParams.get("rango");
  const rango = esRango(pedido) ? pedido : "24h";

  const serie = await leerMetricas(id, rango);
  return NextResponse.json({
    ok: true,
    rango,
    agenteActivo: ficha.agenteTokenHash !== null,
    ...serie,
  });
}
