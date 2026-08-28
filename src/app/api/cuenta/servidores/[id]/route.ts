import { NextResponse } from "next/server";
import { getSession } from "@/lib/session";
import { rateLimit } from "@/lib/rate-limit";
import { esIdInterno } from "@/lib/servidores/store";
import { getManagedForUser, getProxmoxServerForUser, getServerForUser } from "@/lib/servidores/cliente";
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
  if (!esIdInterno(id)) {
    return NextResponse.json({ ok: false, error: "Not found." }, { status: 404 });
  }

  // Cada lectura son 1-3 llamadas a la API del proveedor, que limita el ritmo
  // para TODA la cuenta: sin tope aquí, un cliente sondeando en bucle deja sin
  // cuota a los demás y al panel de administración. La pantalla consulta cada
  // 5 s mientras hay una tarea en curso (12/min por pestaña abierta).
  const limite = rateLimit(`srv-ver:${session.uid}:${id}`, { limit: 60, windowMs: 60_000 });
  if (!limite.ok) {
    return NextResponse.json(
      { ok: false, error: "Too many requests.", retryAfter: limite.retryAfter },
      { status: 429, headers: { "Retry-After": String(limite.retryAfter) } }
    );
  }

  // VPS de nuestro Proxmox: estado leído del provisioner (sin snapshots/límites).
  const ficha = await getManagedForUser(id, session.uid);
  if (ficha?.proveedor === "proxmox") {
    const found = await getProxmoxServerForUser(id, session.uid);
    if (!found) {
      return NextResponse.json({ ok: false, error: "Not found." }, { status: 404 });
    }
    return NextResponse.json({ ok: true, server: found.remote, etiqueta: found.managed.etiqueta });
  }

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
    // El detalle del proveedor es interno —puede hablar de nuestro token o de
    // su infraestructura—: se registra y al cliente se le da un mensaje llano.
    console.error(
      "[servidores] fallo leyendo el servidor",
      id,
      err instanceof ProviderError ? `${err.status} ${err.message}` : err
    );
    return NextResponse.json(
      { ok: false, error: "Could not reach the provider." },
      { status: 502 }
    );
  }
}
