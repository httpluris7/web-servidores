import { NextResponse } from "next/server";
import { getSession } from "@/lib/session";
import { getServerForUser } from "@/lib/servidores/cliente";
import { listServerLimits, listSnapshots, ProviderError } from "@/lib/servidores/v4vm";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Estado actual de un servidor del cliente. La pantalla lo consulta en bucle
 * mientras hay una tarea en curso, porque la API del proveedor no tiene forma
 * de avisar cuando termina.
 */
export async function GET(req: Request, ctx: { params: Promise<{ id: string }> }) {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ ok: false, error: "Unauthorized." }, { status: 401 });
  }

  const { id } = await ctx.params;

  try {
    const found = await getServerForUser(id, session.uid);
    if (!found) {
      return NextResponse.json({ ok: false, error: "Not found." }, { status: 404 });
    }

    // Las instantáneas y los límites solo se piden si se piden: son dos
    // llamadas más al proveedor y el sondeo de estado no las necesita.
    const url = new URL(req.url);
    const withExtras = url.searchParams.get("extras") === "1";
    const [snapshots, limits] = withExtras
      ? await Promise.all([
          listSnapshots(found.cfg, found.managed.remoteId),
          listServerLimits(found.cfg, found.managed.remoteId),
        ])
      : [null, null];

    return NextResponse.json({
      ok: true,
      server: found.remote,
      etiqueta: found.managed.etiqueta,
      ...(snapshots ? { snapshots } : {}),
      ...(limits ? { limits } : {}),
    });
  } catch (err) {
    const message =
      err instanceof ProviderError ? err.message : "Could not reach the provider.";
    return NextResponse.json({ ok: false, error: message }, { status: 502 });
  }
}
