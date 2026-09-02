import { NextResponse } from "next/server";
import { getSession } from "@/lib/session";
import { rateLimit } from "@/lib/rate-limit";
import { esIdInterno } from "@/lib/servidores/store";
import { getManagedForUser } from "@/lib/servidores/cliente";
import { ProvisionerError, vpsTasks } from "@/lib/provisioner/client";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Historial reciente de tareas de la VM (para la sección "Historial de tareas").
 * El panel lo relee cada pocos segundos mientras hay una tarea en curso.
 */
export async function GET(_req: Request, ctx: { params: Promise<{ id: string }> }) {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ ok: false, error: "Unauthorized." }, { status: 401 });
  }

  const { id } = await ctx.params;
  if (!esIdInterno(id)) {
    return NextResponse.json({ ok: false, error: "Not found." }, { status: 404 });
  }

  const limite = rateLimit(`panel-tareas:${session.uid}:${id}`, { limit: 60, windowMs: 60_000 });
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
    const r = await vpsTasks(ficha.remoteId);
    return NextResponse.json({ ok: true, tasks: r.tasks });
  } catch (err) {
    console.error(
      "[panel] fallo leyendo el historial de tareas",
      id,
      err instanceof ProvisionerError ? `${err.status ?? ""} ${err.message}` : err,
    );
    return NextResponse.json(
      { ok: false, error: "Could not reach the provisioner." },
      { status: 502 },
    );
  }
}
