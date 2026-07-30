import { NextResponse } from "next/server";
import { getSession } from "@/lib/session";
import { getPublicUserById } from "@/lib/auth";
import { clean } from "@/lib/leads";
import { rateLimit } from "@/lib/rate-limit";
import { listManagedByUser } from "@/lib/servidores/store";
import { localizedUrl } from "@/lib/payments/urls";
import { sendTicketMail } from "@/lib/mail";
import {
  createTicket,
  TICKET_CATEGORIES,
  type TicketCategory,
} from "@/lib/tickets";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Apertura de un ticket de soporte. Solo para clientes con sesión: el ticket
 * queda ligado a su `userId`, que es lo único por lo que se comprueba después
 * la pertenencia.
 */
export async function POST(req: Request) {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ ok: false, error: "Unauthorized." }, { status: 401 });
  }

  // Cada ticket dispara un correo a nuestro buzón: sin tope, un cliente podría
  // inundarlo. El límite va por usuario, no por IP (aquí siempre hay sesión).
  const limite = rateLimit(`ticket-nuevo:${session.uid}`, { limit: 5, windowMs: 60 * 60_000 });
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

  const asunto = clean(body.asunto, 120);
  const mensaje = clean(body.mensaje, 5000);
  const categoria = clean(body.categoria, 20) as TicketCategory;
  const servidorId = clean(body.servidorId, 60);

  const errors: Record<string, string> = {};
  if (asunto.length < 3) errors.asunto = "Enter a subject.";
  if (mensaje.length < 10) errors.mensaje = "Tell us a little more (min. 10 characters).";
  if (!TICKET_CATEGORIES.includes(categoria)) errors.categoria = "Invalid category.";
  if (Object.keys(errors).length > 0) {
    return NextResponse.json({ ok: false, errors }, { status: 422 });
  }

  const user = await getPublicUserById(session.uid);
  if (!user) {
    return NextResponse.json({ ok: false, error: "Unauthorized." }, { status: 401 });
  }

  // El servidor asociado tiene que ser suyo: si no, se ignora en vez de dar
  // error, para no convertir el formulario en un oráculo de qué ids existen.
  let servidorEtiqueta = "";
  let servidorElegido: string | null = null;
  if (servidorId) {
    const suyos = await listManagedByUser(session.uid);
    const encontrado = suyos.find((s) => s.id === servidorId);
    if (encontrado) {
      servidorElegido = encontrado.id;
      servidorEtiqueta = encontrado.etiqueta || `#${encontrado.remoteId}`;
    }
  }

  const clienteNombre = [user.nombre, user.apellidos].filter(Boolean).join(" ").trim() || user.email;

  let ticket;
  try {
    ticket = await createTicket({
      userId: user.id,
      clienteEmail: user.email,
      clienteNombre,
      asunto,
      categoria,
      servidorId: servidorElegido,
      servidorEtiqueta,
      mensaje,
    });
  } catch (err) {
    console.error("[tickets] no se pudo guardar el ticket de", user.email, err);
    return NextResponse.json(
      { ok: false, error: "The ticket could not be saved. Please try again." },
      { status: 500 }
    );
  }

  // Aviso al buzón de soporte, que es donde se atiende. Best-effort: el ticket
  // ya está guardado y visible en el panel, así que un fallo de envío no debe
  // devolver error al cliente.
  try {
    await sendTicketMail({
      numero: ticket.numero,
      asunto: ticket.asunto,
      categoria: ticket.categoria,
      clienteNombre: ticket.clienteNombre,
      clienteEmail: ticket.clienteEmail,
      servidor: ticket.servidorEtiqueta,
      cuerpo: mensaje,
      indice: 1,
      adminUrl: localizedUrl(`/admin/tickets/${ticket.id}`),
    });
  } catch (err) {
    console.error("[tickets] fallo al avisar por correo del ticket", ticket.numero, err);
  }

  return NextResponse.json({ ok: true, id: ticket.id, numero: ticket.numero });
}
