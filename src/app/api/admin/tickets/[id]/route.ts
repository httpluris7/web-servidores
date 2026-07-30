import { NextResponse } from "next/server";
import { getAdminSession } from "@/lib/admin";
import { clean } from "@/lib/leads";
import { localizedUrl } from "@/lib/payments/urls";
import { sendTicketReplyMail } from "@/lib/mail";
import {
  addTicketMessage,
  esIdTicket,
  getTicketById,
  setTicketStatus,
  TICKET_STATUSES,
  type TicketStatus,
} from "@/lib/tickets";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Respuesta de soporte desde el panel.
 *
 * Se puede atender un ticket de dos maneras: contestando al correo que llega a
 * soporte@viahost.top (rápido, pero la respuesta solo existe en el buzón del
 * cliente) o desde aquí, que además la deja en el hilo que el cliente ve en su
 * área. Esta ruta es la segunda: guarda el mensaje y avisa al cliente.
 */
export async function POST(req: Request, ctx: { params: Promise<{ id: string }> }) {
  const session = await getAdminSession();
  if (!session) {
    return NextResponse.json({ ok: false, error: "Unauthorized." }, { status: 401 });
  }

  const { id } = await ctx.params;
  if (!esIdTicket(id)) {
    return NextResponse.json({ ok: false, error: "Not found." }, { status: 404 });
  }

  let body: Record<string, unknown>;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ ok: false, error: "Invalid JSON." }, { status: 400 });
  }

  const ticket = await getTicketById(id);
  if (!ticket) {
    return NextResponse.json({ ok: false, error: "Not found." }, { status: 404 });
  }

  const accion = clean(body.accion, 20);

  if (accion === "estado") {
    const estado = clean(body.estado, 20) as TicketStatus;
    if (!TICKET_STATUSES.includes(estado)) {
      return NextResponse.json({ ok: false, error: "Invalid status." }, { status: 422 });
    }
    await setTicketStatus(ticket.id, estado);
    return NextResponse.json({ ok: true });
  }

  if (accion !== "responder") {
    return NextResponse.json({ ok: false, error: "Unknown action." }, { status: 422 });
  }

  const mensaje = clean(body.mensaje, 5000);
  if (mensaje.length < 2) {
    return NextResponse.json({ ok: false, error: "Write a message." }, { status: 422 });
  }

  // Se guarda quién respondió (queda en el JSONL para trazabilidad); al cliente
  // se le muestra solo la etiqueta "Soporte", no el correo del administrador.
  const actualizado = await addTicketMessage(ticket.id, {
    autor: "soporte",
    nombre: session.email,
    cuerpo: mensaje,
  });
  if (!actualizado) {
    return NextResponse.json({ ok: false, error: "Not found." }, { status: 404 });
  }

  // El aviso al cliente es best-effort: la respuesta ya está en su área.
  let avisado = true;
  try {
    await sendTicketReplyMail({
      to: actualizado.clienteEmail,
      clienteNombre: actualizado.clienteNombre,
      numero: actualizado.numero,
      asunto: actualizado.asunto,
      cuerpo: mensaje,
      indice: actualizado.mensajes.length,
      url: localizedUrl(`/cuenta/soporte/${actualizado.id}`),
    });
  } catch (err) {
    avisado = false;
    console.error("[tickets] fallo al avisar al cliente de", actualizado.numero, err);
  }

  return NextResponse.json({ ok: true, avisado });
}
