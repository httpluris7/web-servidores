import { NextResponse } from "next/server";
import { falloProvisioner, panelGuard } from "@/lib/panel/bff";
import { vpsTemplates, getVps } from "@/lib/provisioner/client";
import { OS_OPTIONS, osCumpleDisco } from "@/lib/provisioner/os";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Plantillas de SO para ESTE servidor: las que existen en su centro de datos
 * (provisioner) cruzadas con el catálogo de la web (nombre, familia, disco
 * mínimo) y con el disco del servidor, para saber cuáles se pueden instalar.
 */
export async function GET(_req: Request, ctx: { params: Promise<{ id: string }> }) {
  const g = await panelGuard(ctx, "panel-plantillas", 60);
  if (g.error) return g.error;
  try {
    const [r, info] = await Promise.all([vpsTemplates(g.ficha!.remoteId), getVps(g.ficha!.remoteId)]);
    const disponibles = new Set(r.templates.map((t) => t.os_slug));
    const plantillas = OS_OPTIONS.filter((o) => disponibles.has(o.slug)).map((o) => ({
      slug: o.slug,
      label: o.label,
      familia: o.familia,
      minDiscoGb: o.minDiscoGb,
      ofertable: o.disponible,
      cabe: osCumpleDisco(o, info.disco_gb),
      actual: r.actual === o.slug,
    }));
    return NextResponse.json({ ok: true, actual: r.actual, discoGb: info.disco_gb, plantillas });
  } catch (err) {
    return falloProvisioner("plantillas", err);
  }
}
