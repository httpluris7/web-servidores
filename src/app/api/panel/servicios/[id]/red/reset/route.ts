import { NextResponse } from "next/server";
import { falloProvisioner, panelGuard } from "@/lib/panel/bff";
import { resetVpsNetwork } from "@/lib/provisioner/client";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Restablece la red tal y como se entregó (NIC virtio en el bridge del centro
 * de datos, IP y puerta de enlace asignadas, DNS por defecto). No borra datos,
 * pero hace falta reiniciar para que cloud-init la aplique.
 */
export async function POST(_req: Request, ctx: { params: Promise<{ id: string }> }) {
  const g = await panelGuard(ctx, "panel-red-reset", 6);
  if (g.error) return g.error;
  try {
    const r = await resetVpsNetwork(g.ficha!.remoteId);
    return NextResponse.json({ ok: true, requiereReinicio: r.requiere_reinicio });
  } catch (err) {
    return falloProvisioner("restablecer red", err);
  }
}
