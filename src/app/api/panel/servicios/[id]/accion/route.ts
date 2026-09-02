import { NextResponse } from "next/server";
import { getSession } from "@/lib/session";
import { rateLimit } from "@/lib/rate-limit";
import { esIdInterno } from "@/lib/servidores/store";
import { getManagedForUser } from "@/lib/servidores/cliente";
import {
  getVps,
  ProvisionerError,
  resetVpsPassword,
  vpsActionAsync,
  type VpsAction,
} from "@/lib/provisioner/client";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Acciones de energía del panel (Fase 3), en modo ASÍNCRONO: se dispara la
 * acción en Proxmox y se devuelve el UPID sin esperar; el cliente sondea la
 * tarea. Un único punto de acción → la pertenencia (`getManagedForUser`) se
 * comprueba una sola vez, como en el resto del área de cliente.
 *
 * Lo que NO está aquí a propósito (pasa por soporte o por otras fases): borrar la
 * VM, redimensionar, IPs adicionales, reinstalar (Fase 6).
 */

// Vocabulario del panel → acción del provisioner. "apagar" = ACPI (ordenado),
// "parar" = corte de energía (duro, destructivo → confirmación por hostname).
const MAPA: Record<string, VpsAction> = {
  encender: "start",
  reiniciar: "reboot",
  apagar: "shutdown",
  parar: "stop",
};

export async function POST(req: Request, ctx: { params: Promise<{ id: string }> }) {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ ok: false, error: "Unauthorized." }, { status: 401 });
  }

  const { id } = await ctx.params;
  if (!esIdInterno(id)) {
    return NextResponse.json({ ok: false, error: "Not found." }, { status: 404 });
  }

  // Tope por usuario+servidor (no por IP): un cliente impaciente no debe dejar
  // sin cuota a los demás en la API de Proxmox.
  const limite = rateLimit(`panel-accion:${session.uid}:${id}`, { limit: 20, windowMs: 60_000 });
  if (!limite.ok) {
    return NextResponse.json(
      { ok: false, error: "Too many requests.", retryAfter: limite.retryAfter },
      { status: 429, headers: { "Retry-After": String(limite.retryAfter) } },
    );
  }

  const ficha = await getManagedForUser(id, session.uid);
  if (!ficha || ficha.proveedor !== "proxmox") {
    return NextResponse.json({ ok: false, error: "Not found." }, { status: 404 });
  }

  let body: Record<string, unknown>;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ ok: false, error: "Invalid JSON." }, { status: 400 });
  }
  const accion = typeof body.accion === "string" ? body.accion : "";
  const vpsId = ficha.remoteId;

  try {
    // Cambiar contraseña: no es una tarea de Proxmox; cambia en caliente por el
    // guest agent y entrega el nuevo secreto por un enlace de un solo uso.
    if (accion === "password") {
      await resetVpsPassword(vpsId);
      return NextResponse.json({ ok: true, emailed: true });
    }

    const mapped = MAPA[accion];
    if (!mapped) {
      return NextResponse.json({ ok: false, error: "unsupported" }, { status: 422 });
    }

    // "parar" es un corte de energía (puede perder datos sin guardar): se exige
    // teclear el nombre del servidor, igual que la reinstalación.
    if (accion === "parar") {
      const info = await getVps(vpsId);
      const nombre = info.hostname || ficha.etiqueta || `vps-${info.vmid}`;
      if (typeof body.confirmacion !== "string" || body.confirmacion.trim() !== nombre) {
        return NextResponse.json({ ok: false, error: "confirmation_mismatch" }, { status: 422 });
      }
    }

    const r = await vpsActionAsync(vpsId, mapped);
    return NextResponse.json({ ok: true, upid: r.upid, estado: r.estado });
  } catch (err) {
    const status = err instanceof ProvisionerError ? err.status : undefined;
    console.error(
      "[panel] fallo en acción",
      accion,
      id,
      err instanceof ProvisionerError ? `${status ?? ""} ${err.message}` : err,
    );
    if (status === 409) return NextResponse.json({ ok: false, error: "busy" }, { status: 409 });
    return NextResponse.json(
      { ok: false, error: "Could not reach the provisioner." },
      { status: 502 },
    );
  }
}
