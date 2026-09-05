import { NextResponse } from "next/server";
import { panelGuard, falloProvisioner } from "@/lib/panel/bff";
import { getVps, ProvisionerError, restoreVpsBackup } from "@/lib/provisioner/client";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Restaurar una copia SOBRE el servidor. Destructivo: sustituye el disco y la
 * configuración actuales por los de la copia (y apaga el servidor si está
 * encendido), por eso exige teclear el nombre del servidor, como reinstalar.
 * Devuelve el UPID de la tarea de Proxmox para sondearla.
 */
export async function POST(req: Request, ctx: { params: Promise<{ id: string }> }) {
  const g = await panelGuard(ctx, "panel-backup-restore", 6);
  if (g.error) return g.error;
  let body: Record<string, unknown>;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ ok: false, error: "Invalid JSON." }, { status: 400 });
  }
  const volid = typeof body.volid === "string" ? body.volid : "";
  if (!volid) return NextResponse.json({ ok: false, error: "Missing volid." }, { status: 400 });
  try {
    const info = await getVps(g.ficha!.remoteId);
    const nombre = info.hostname || g.ficha!.etiqueta || `vps-${info.vmid}`;
    if (typeof body.confirmacion !== "string" || body.confirmacion.trim() !== nombre) {
      return NextResponse.json({ ok: false, error: "confirmation_mismatch" }, { status: 422 });
    }
    const r = await restoreVpsBackup(g.ficha!.remoteId, volid);
    return NextResponse.json({ ok: true, upid: r.upid });
  } catch (err) {
    const status = err instanceof ProvisionerError ? err.status : undefined;
    if (status === 400) return NextResponse.json({ ok: false, error: "bad_volid" }, { status: 400 });
    if (status === 404) return NextResponse.json({ ok: false, error: "not_found" }, { status: 404 });
    return falloProvisioner("restaurar copia", err);
  }
}
