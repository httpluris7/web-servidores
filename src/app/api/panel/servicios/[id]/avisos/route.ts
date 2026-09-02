import { NextResponse } from "next/server";
import { getSession } from "@/lib/session";
import { rateLimit } from "@/lib/rate-limit";
import { esIdInterno } from "@/lib/servidores/store";
import { getManagedForUser } from "@/lib/servidores/cliente";
import { avisosActivos } from "@/lib/servidores/avisos";
import { readSettings } from "@/lib/ajustes";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * "Notificaciones de recursos" (Fase 6), informativo. Reutiliza el sistema de
 * avisos por umbral existente: devuelve las alertas ACTIVAS de ESTE servidor
 * (CPU/memoria/disco sostenidos, o agente caído) y los umbrales configurados.
 * Requiere agente instalado; sin él no hay métricas que vigilar.
 */
export async function GET(_req: Request, ctx: { params: Promise<{ id: string }> }) {
  const session = await getSession();
  if (!session) return NextResponse.json({ ok: false, error: "Unauthorized." }, { status: 401 });

  const { id } = await ctx.params;
  if (!esIdInterno(id)) return NextResponse.json({ ok: false, error: "Not found." }, { status: 404 });

  const limite = rateLimit(`panel-avisos:${session.uid}:${id}`, { limit: 40, windowMs: 60_000 });
  if (!limite.ok) {
    return NextResponse.json(
      { ok: false, error: "Too many requests." },
      { status: 429, headers: { "Retry-After": String(limite.retryAfter) } },
    );
  }

  const ficha = await getManagedForUser(id, session.uid);
  if (!ficha || ficha.proveedor !== "proxmox") {
    return NextResponse.json({ ok: false, error: "Not found." }, { status: 404 });
  }

  try {
    const [{ alerts }, todos] = await Promise.all([readSettings(), avisosActivos()]);
    const activos = todos
      .filter((a) => a.servidorId === ficha.id)
      .map((a) => ({ regla: a.regla, valor: a.valor, umbral: a.umbral, desde: a.desde }));
    return NextResponse.json({
      ok: true,
      agenteActivo: ficha.agenteTokenHash !== null,
      umbrales: { cpu: alerts.cpu, memoria: alerts.memoria, disco: alerts.disco },
      activos,
    });
  } catch (err) {
    console.error("[panel] fallo leyendo avisos", id, err);
    return NextResponse.json({ ok: false, error: "internal" }, { status: 502 });
  }
}
