import { NextResponse } from "next/server";
import { getSession } from "@/lib/session";
import { rateLimit } from "@/lib/rate-limit";
import { esIdInterno } from "@/lib/servidores/store";
import { getManagedForUser } from "@/lib/servidores/cliente";
import {
  createVpsSnapshot,
  deleteVpsSnapshot,
  getVps,
  listVpsSnapshots,
  ProvisionerError,
  rollbackVpsSnapshot,
} from "@/lib/provisioner/client";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Instantáneas (snapshots) del panel. GET lista; POST crea, revierte o borra.
 * Revertir es destructivo (vuelve el disco a un punto anterior): exige teclear el
 * nombre del servidor, como "Parar" y la reinstalación. Las operaciones esperan a
 * que Proxmox termine la tarea (el provisioner hace `waitForTask`).
 */
export async function GET(_req: Request, ctx: { params: Promise<{ id: string }> }) {
  const { session, ficha, error } = await guard(ctx, 60);
  if (error) return error;
  try {
    const { snapshots } = await listVpsSnapshots(ficha!.remoteId);
    return NextResponse.json({ ok: true, snapshots });
  } catch (err) {
    return falloProvisioner("listar snapshots", session!.uid, err);
  }
}

export async function POST(req: Request, ctx: { params: Promise<{ id: string }> }) {
  const { session, ficha, error } = await guard(ctx, 20);
  if (error) return error;

  let body: Record<string, unknown>;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ ok: false, error: "Invalid JSON." }, { status: 400 });
  }
  const op = typeof body.op === "string" ? body.op : "";
  const nombre = typeof body.nombre === "string" ? body.nombre.trim() : "";
  const vpsId = ficha!.remoteId;

  try {
    switch (op) {
      case "crear": {
        const r = await createVpsSnapshot(vpsId, nombre || undefined);
        return NextResponse.json({ ok: true, name: r.name });
      }
      case "revertir": {
        if (!nombre) return NextResponse.json({ ok: false, error: "Invalid snapshot." }, { status: 422 });
        // Confirmación por hostname (operación destructiva).
        const info = await getVps(vpsId);
        const host = info.hostname || ficha!.etiqueta || `vps-${info.vmid}`;
        if (typeof body.confirmacion !== "string" || body.confirmacion.trim() !== host) {
          return NextResponse.json({ ok: false, error: "confirmation_mismatch" }, { status: 422 });
        }
        await rollbackVpsSnapshot(vpsId, nombre);
        return NextResponse.json({ ok: true });
      }
      case "borrar": {
        if (!nombre) return NextResponse.json({ ok: false, error: "Invalid snapshot." }, { status: 422 });
        await deleteVpsSnapshot(vpsId, nombre);
        return NextResponse.json({ ok: true });
      }
      default:
        return NextResponse.json({ ok: false, error: "unsupported" }, { status: 422 });
    }
  } catch (err) {
    return falloProvisioner(`snapshot ${op}`, session!.uid, err);
  }
}

/* -------------------------------- Helpers --------------------------------- */

async function guard(
  ctx: { params: Promise<{ id: string }> },
  limit: number,
): Promise<{
  session: { uid: string } | null;
  ficha: Awaited<ReturnType<typeof getManagedForUser>> | null;
  error: NextResponse | null;
}> {
  const session = await getSession();
  if (!session) return { session: null, ficha: null, error: NextResponse.json({ ok: false, error: "Unauthorized." }, { status: 401 }) };
  const { id } = await ctx.params;
  if (!esIdInterno(id)) return { session, ficha: null, error: NextResponse.json({ ok: false, error: "Not found." }, { status: 404 }) };
  const limite = rateLimit(`panel-snap:${session.uid}:${id}`, { limit, windowMs: 60_000 });
  if (!limite.ok) {
    return {
      session,
      ficha: null,
      error: NextResponse.json(
        { ok: false, error: "Too many requests." },
        { status: 429, headers: { "Retry-After": String(limite.retryAfter) } },
      ),
    };
  }
  const ficha = await getManagedForUser(id, session.uid);
  if (!ficha || ficha.proveedor !== "proxmox") {
    return { session, ficha: null, error: NextResponse.json({ ok: false, error: "Not found." }, { status: 404 }) };
  }
  return { session, ficha, error: null };
}

function falloProvisioner(contexto: string, uid: string, err: unknown): NextResponse {
  const status = err instanceof ProvisionerError ? err.status : undefined;
  console.error(
    "[panel] fallo en",
    contexto,
    err instanceof ProvisionerError ? `${status ?? ""} ${err.message}` : err,
  );
  if (status === 409) return NextResponse.json({ ok: false, error: "busy" }, { status: 409 });
  return NextResponse.json({ ok: false, error: "Could not reach the provisioner." }, { status: 502 });
}
