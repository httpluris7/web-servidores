import { NextResponse } from "next/server";
import { getSession } from "@/lib/session";
import { rateLimit } from "@/lib/rate-limit";
import { esIdInterno } from "@/lib/servidores/store";
import { getManagedForUser } from "@/lib/servidores/cliente";
import { ProvisionerError, vpsVncProxy } from "@/lib/provisioner/client";
import { signConsoleToken } from "@/lib/provisioner/console-token";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Abre una consola noVNC para un VPS de nuestro Proxmox.
 *
 * Ruta propia (no la de acciones) porque el flujo es distinto: pide a Proxmox un
 * `vncproxy` de un solo uso y firma un token corto que autoriza al proxy
 * websocket `/console-ws` del provisioner. El navegador recibe:
 *  - `token`: viaja en la query del websocket; el provisioner lo verifica.
 *  - `ticket`: la contraseña VNC de un solo uso que noVNC usa en el handshake RFB.
 *
 * Ambos caducan en segundos y solo sirven para esta VM: la pertenencia se
 * comprueba aquí antes de firmar nada.
 */
export async function POST(_req: Request, ctx: { params: Promise<{ id: string }> }) {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ ok: false, error: "Unauthorized." }, { status: 401 });
  }

  const { id } = await ctx.params;
  if (!esIdInterno(id)) {
    return NextResponse.json({ ok: false, error: "Not found." }, { status: 404 });
  }

  // Abrir consolas cuesta un ticket en Proxmox: mismo tope por usuario+servidor.
  const limite = rateLimit(`console:${session.uid}:${id}`, { limit: 10, windowMs: 60_000 });
  if (!limite.ok) {
    return NextResponse.json(
      { ok: false, error: "Too many requests.", retryAfter: limite.retryAfter },
      { status: 429, headers: { "Retry-After": String(limite.retryAfter) } },
    );
  }

  // Un servidor ajeno o externo responde igual que uno inexistente.
  const ficha = await getManagedForUser(id, session.uid);
  if (!ficha || ficha.proveedor !== "proxmox") {
    return NextResponse.json({ ok: false, error: "Not found." }, { status: 404 });
  }

  const vpsId = ficha.remoteId;
  try {
    const vnc = await vpsVncProxy(vpsId);
    const token = signConsoleToken({ vpsId, port: vnc.port, ticket: vnc.ticket });
    // La URL del websocket la arma el navegador con su propio host (wss://…).
    return NextResponse.json({ ok: true, token, ticket: vnc.ticket, path: "/console-ws" });
  } catch (err) {
    const status = err instanceof ProvisionerError ? err.status : undefined;
    console.error(
      "[servidores] fallo al abrir consola proxmox",
      id,
      err instanceof ProvisionerError ? `${status ?? ""} ${err.message}` : err,
    );
    return NextResponse.json(
      { ok: false, error: "Could not open the console." },
      { status: 502 },
    );
  }
}
