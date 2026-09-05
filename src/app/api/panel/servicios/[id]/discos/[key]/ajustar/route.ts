import { NextResponse } from "next/server";
import { falloProvisioner, panelGuard } from "@/lib/panel/bff";
import { ProvisionerError, resizeVpsDiskToPlan } from "@/lib/provisioner/client";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const KEY = /^(scsi|virtio|sata)\d+$/;

/** Amplía el disco hasta el tamaño del plan contratado (solo crece). */
export async function POST(_req: Request, ctx: { params: Promise<{ id: string; key: string }> }) {
  const g = await panelGuard(ctx, "panel-discos-resize", 6);
  if (g.error) return g.error;
  const { key } = await ctx.params;
  if (!KEY.test(key)) return NextResponse.json({ ok: false, error: "Not found." }, { status: 404 });
  try {
    const r = await resizeVpsDiskToPlan(g.ficha!.remoteId, key);
    return NextResponse.json({ ok: true, sizeGb: r.size_gb, requiereReinicio: r.requiere_reinicio });
  } catch (err) {
    const status = err instanceof ProvisionerError ? err.status : undefined;
    if (status === 409) return NextResponse.json({ ok: false, error: "already_at_plan" }, { status: 409 });
    return falloProvisioner("ampliar disco", err);
  }
}
