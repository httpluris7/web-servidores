import { NextResponse } from "next/server";
import { getSession } from "@/lib/session";
import { clean } from "@/lib/leads";
import { rateLimit } from "@/lib/rate-limit";
import { localizedUrl } from "@/lib/payments/urls";
import { sendTicketMail } from "@/lib/mail";
import {
  addTicketMessage,
  esIdTicket,
  getTicketForUser,
  setTicketStatus,
} from "@/lib/tickets";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Acciones del cliente sobre su ticket: responder o cerrarlo.
 *
 * Una sola ruta para las dos, como en el panel de servidores: así la
 * comprobación de pertenencia (`getTicketForUser`) se hace en un único sitio y
 * no hay forma de añadir una acción y olvidarse de comprobarlo.
 */
export async function POST(req: Request, ctx: { params: Promise<{ id: string }> }) {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ ok: false, error: "Unauthorized." }, { status: 401 });
  }

  const { id } = await ctx.params;
  // El id entra en la clave del límite de peticiones, que se aplica antes de
  // comprobar la pertenencia: solo pasan los ids que emitimos nosotros.
  if (!esIdTicket(id)) {
    return NextResponse.json({ ok: false, error: "Not found." }, { status: 404 });
  }

  const limite = rateLimit(`ticket:${session.uid}:${id}`, { limit: 10, windowMs: 10 * 60_000 });
  if (!limite.ok) {
    return NextResponse.json(
      { ok: false, error: "Too many requests.", retryAfter: limite.retryAfter },
      { status: 429, headers: { "Retry-After": String(limite.retryAfter) } }
    );
  }

  let body: Record<string, unknown>;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ ok: false, error: "Invalid JSON." }, { status: 400 });
  }

  const ticket = await getTicketForUser(id, session.uid);
  if (!ticket) {
    return NextResponse.json({ ok: false, error: "Not found." }, { status: 404 });
  }

  const accion = clean(body.accion, 20);

  if (accion === "cerrar") {
    await setTicketStatus(ticket.id, "cerrado");
    return NextResponse.json({ ok: true });
  }

  if (accion !== "responder") {
    return NextResponse.json({ ok: false, error: "Unknown action." }, { status: 422 });
  }

  const mensaje = clean(body.mensaje, 5000);
  if (mensaje.length < 2) {
    return NextResponse.json({ ok: false, errors: { mensaje: "Write a message." } }, { status: 422 });
  }

  const actualizado = await addTicketMessage(ticket.id, {
    autor: "cliente",
    nombre: ticket.clienteNombre,
    cuerpo: mensaje,
  });
  if (!actualizado) {
    return NextResponse.json({ ok: false, error: "Not found." }, { status: 404 });
  }

  // Best-effort, como al abrirlo: la respuesta ya está en el hilo.
  try {
    await sendTicketMail({
      numero: actualizado.numero,
      asunto: actualizado.asunto,
      categoria: actualizado.categoria,
      clienteNombre: actualizado.clienteNombre,
      clienteEmail: actualizado.clienteEmail,
      servidor: actualizado.servidorEtiqueta,
      cuerpo: mensaje,
      indice: actualizado.mensajes.length,
      adminUrl: localizedUrl(`/admin/tickets/${actualizado.id}`),
    });
  } catch (err) {
    console.error("[tickets] fallo al avisar por correo de la respuesta a", actualizado.numero, err);
  }

  return NextResponse.json({ ok: true });
}
