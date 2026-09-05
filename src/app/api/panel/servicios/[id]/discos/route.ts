import { NextResponse } from "next/server";
import { falloProvisioner, panelGuard } from "@/lib/panel/bff";
import { vpsDisks } from "@/lib/provisioner/client";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** Discos del servicio (tamaño, almacenamiento, opciones) y el disco del plan. */
export async function GET(_req: Request, ctx: { params: Promise<{ id: string }> }) {
  const g = await panelGuard(ctx, "panel-discos", 60);
  if (g.error) return g.error;
  try {
    const r = await vpsDisks(g.ficha!.remoteId);
    return NextResponse.json({ ok: true, disks: r.disks, planDiscoGb: r.plan_disco_gb, storage: r.storage });
  } catch (err) {
    return falloProvisioner("discos", err);
  }
}
