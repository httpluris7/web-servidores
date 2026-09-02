import { NextResponse } from "next/server";
import { getSession } from "@/lib/session";
import { rateLimit } from "@/lib/rate-limit";
import { esIdInterno } from "@/lib/servidores/store";
import { getManagedForUser } from "@/lib/servidores/cliente";
import { ProvisionerError, vpsTaskStatus } from "@/lib/provisioner/client";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Estado de UNA tarea de Proxmox (para el polling del panel). El UPID viaja en la
 * query; el provisioner comprueba además que sea de esta VM. Aquí solo validamos
 * pertenencia del servicio y limitamos el ritmo (el panel sondea cada 2 s).
 */
export async function GET(req: Request, ctx: { params: Promise<{ id: string }> }) {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ ok: false, error: "Unauthorized." }, { status: 401 });
  }

  const { id } = await ctx.params;
  if (!esIdInterno(id)) {
    return NextResponse.json({ ok: false, error: "Not found." }, { status: 404 });
  }

  const limite = rateLimit(`panel-tarea:${session.uid}:${id}`, { limit: 90, windowMs: 60_000 });
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

  const upid = new URL(req.url).searchParams.get("upid") ?? "";
  if (!upid) return NextResponse.json({ ok: false, error: "Missing upid." }, { status: 400 });

  try {
    const r = await vpsTaskStatus(ficha.remoteId, upid);
    return NextResponse.json({ ok: true, status: r.status, done: r.done, okResult: r.okResult });
  } catch (err) {
    const status = err instanceof ProvisionerError ? err.status : undefined;
    // Un UPID ajeno a la VM lo rechaza el provisioner con 400: no es un fallo nuestro.
    if (status === 400) return NextResponse.json({ ok: false, error: "bad_upid" }, { status: 400 });
    return NextResponse.json(
      { ok: false, error: "Could not reach the provisioner." },
      { status: 502 },
    );
  }
}
