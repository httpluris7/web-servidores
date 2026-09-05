import { NextResponse } from "next/server";
import { falloProvisioner, panelGuard } from "@/lib/panel/bff";
import { setVpsDiskOptions } from "@/lib/provisioner/client";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const KEY = /^(scsi|virtio|sata)\d+$/;

/** Opciones de un disco: discard (TRIM), emulación SSD e IO thread. */
export async function PUT(req: Request, ctx: { params: Promise<{ id: string; key: string }> }) {
  const g = await panelGuard(ctx, "panel-discos", 20);
  if (g.error) return g.error;
  const { key } = await ctx.params;
  if (!KEY.test(key)) return NextResponse.json({ ok: false, error: "Not found." }, { status: 404 });
  let body: Record<string, unknown>;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ ok: false, error: "Invalid JSON." }, { status: 400 });
  }
  const opts: { discard?: boolean; ssd?: boolean; iothread?: boolean } = {};
  for (const k of ["discard", "ssd", "iothread"] as const) if (typeof body[k] === "boolean") opts[k] = body[k] as boolean;
  if (Object.keys(opts).length === 0) return NextResponse.json({ ok: false, error: "unsupported" }, { status: 422 });
  try {
    const r = await setVpsDiskOptions(g.ficha!.remoteId, key, opts);
    return NextResponse.json({ ok: true, requiereReinicio: r.requiere_reinicio });
  } catch (err) {
    return falloProvisioner("opciones de disco", err);
  }
}
