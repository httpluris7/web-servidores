import { NextResponse } from "next/server";
import { getSession } from "@/lib/session";
import { rateLimit } from "@/lib/rate-limit";
import { esIdInterno } from "@/lib/servidores/store";
import { getManagedForUser } from "@/lib/servidores/cliente";
import {
  createVpsBackup,
  deleteVpsBackup,
  ProvisionerError,
  vpsBackups,
} from "@/lib/provisioner/client";
import type { ManagedServer } from "@/lib/servidores/store";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Copias de seguridad del panel (Fase 4). GET lista (y descubre si el nodo tiene
 * almacén de backup); POST lanza una copia (vzdump → UPID, se sondea como las
 * demás tareas); DELETE borra un fichero de copia. Restaurar (destructivo) no se
 * ofrece aún: pasa por soporte.
 */
export async function GET(_req: Request, ctx: Ctx) {
  const g = await guard(ctx, 60);
  if (g.error) return g.error;
  try {
    const r = await vpsBackups(g.ficha!.remoteId);
    return NextResponse.json({ ok: true, storage: r.storage, backups: r.backups });
  } catch (err) {
    return fallo(err);
  }
}

export async function POST(_req: Request, ctx: Ctx) {
  const g = await guard(ctx, 10);
  if (g.error) return g.error;
  try {
    const r = await createVpsBackup(g.ficha!.remoteId);
    return NextResponse.json({ ok: true, upid: r.upid });
  } catch (err) {
    const status = err instanceof ProvisionerError ? err.status : undefined;
    // El provisioner responde 409 no_storage si el nodo no tiene almacén de backup.
    if (status === 409) return NextResponse.json({ ok: false, error: "no_storage" }, { status: 409 });
    return fallo(err);
  }
}

export async function DELETE(req: Request, ctx: Ctx) {
  const g = await guard(ctx, 20);
  if (g.error) return g.error;
  const volid = new URL(req.url).searchParams.get("volid") ?? "";
  if (!volid) return NextResponse.json({ ok: false, error: "Missing volid." }, { status: 400 });
  try {
    await deleteVpsBackup(g.ficha!.remoteId, volid);
    return NextResponse.json({ ok: true });
  } catch (err) {
    const status = err instanceof ProvisionerError ? err.status : undefined;
    // volid ajeno a la VM → el provisioner devuelve 400.
    if (status === 400) return NextResponse.json({ ok: false, error: "bad_volid" }, { status: 400 });
    return fallo(err);
  }
}

/* -------------------------------- Helpers --------------------------------- */

type Ctx = { params: Promise<{ id: string }> };

async function guard(
  ctx: Ctx,
  limit: number,
): Promise<{ ficha: ManagedServer | null; error: NextResponse | null }> {
  const session = await getSession();
  if (!session) return { ficha: null, error: NextResponse.json({ ok: false, error: "Unauthorized." }, { status: 401 }) };
  const { id } = await ctx.params;
  if (!esIdInterno(id)) return { ficha: null, error: NextResponse.json({ ok: false, error: "Not found." }, { status: 404 }) };
  const limite = rateLimit(`panel-backup:${session.uid}:${id}`, { limit, windowMs: 60_000 });
  if (!limite.ok) {
    return {
      ficha: null,
      error: NextResponse.json(
        { ok: false, error: "Too many requests." },
        { status: 429, headers: { "Retry-After": String(limite.retryAfter) } },
      ),
    };
  }
  const ficha = await getManagedForUser(id, session.uid);
  if (!ficha || ficha.proveedor !== "proxmox") {
    return { ficha: null, error: NextResponse.json({ ok: false, error: "Not found." }, { status: 404 }) };
  }
  return { ficha, error: null };
}

function fallo(err: unknown): NextResponse {
  console.error(
    "[panel] fallo en backups",
    err instanceof ProvisionerError ? `${err.status ?? ""} ${err.message}` : err,
  );
  return NextResponse.json({ ok: false, error: "Could not reach the provisioner." }, { status: 502 });
}
