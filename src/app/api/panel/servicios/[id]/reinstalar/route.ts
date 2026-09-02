import { NextResponse } from "next/server";
import { getSession } from "@/lib/session";
import { rateLimit } from "@/lib/rate-limit";
import { esIdInterno } from "@/lib/servidores/store";
import { getManagedForUser } from "@/lib/servidores/cliente";
import { getVps, ProvisionerError, reinstallVps } from "@/lib/provisioner/client";
import { esOfertableParaDisco } from "@/lib/provisioner/os";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Reinstalación del SO (Fase 6). Destructivo: borra TODO el disco. Por eso exige
 * teclear el nombre del servidor. El SO debe estar ofertable y caber en el disco
 * de ESTE servidor (p. ej. Win 11 exige 64 GB). El aprovisionador la encola y
 * responde al instante; el progreso se ve en el historial de tareas.
 */
export async function POST(req: Request, ctx: { params: Promise<{ id: string }> }) {
  const session = await getSession();
  if (!session) return NextResponse.json({ ok: false, error: "Unauthorized." }, { status: 401 });

  const { id } = await ctx.params;
  if (!esIdInterno(id)) return NextResponse.json({ ok: false, error: "Not found." }, { status: 404 });

  const limite = rateLimit(`panel-reinstalar:${session.uid}:${id}`, { limit: 6, windowMs: 60_000 });
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

  let body: Record<string, unknown>;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ ok: false, error: "Invalid JSON." }, { status: 400 });
  }
  const os = typeof body.os === "string" ? body.os : "";

  try {
    const info = await getVps(ficha.remoteId);
    if (!esOfertableParaDisco(os, info.disco_gb)) {
      return NextResponse.json({ ok: false, error: "invalid_os" }, { status: 422 });
    }
    const nombre = info.hostname || ficha.etiqueta || `vps-${info.vmid}`;
    if (typeof body.confirmacion !== "string" || body.confirmacion.trim() !== nombre) {
      return NextResponse.json({ ok: false, error: "confirmation_mismatch" }, { status: 422 });
    }
    await reinstallVps(ficha.remoteId, os);
    return NextResponse.json({ ok: true });
  } catch (err) {
    const status = err instanceof ProvisionerError ? err.status : undefined;
    console.error(
      "[panel] fallo en reinstalación",
      id,
      err instanceof ProvisionerError ? `${status ?? ""} ${err.message}` : err,
    );
    if (status === 409) return NextResponse.json({ ok: false, error: "busy" }, { status: 409 });
    if (status === 422) return NextResponse.json({ ok: false, error: "invalid_os" }, { status: 422 });
    return NextResponse.json({ ok: false, error: "Could not reach the provisioner." }, { status: 502 });
  }
}
