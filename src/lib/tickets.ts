import { randomUUID } from "node:crypto";
import { chmod, mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";

/**
 * Tickets de soporte de los clientes registrados.
 *
 * Almacén JSONL (`data/tickets.jsonl`) con la misma filosofía que
 * `lib/facturas.ts` y `lib/servidores/store.ts`: sin dependencias, reescribiendo
 * el fichero entero en cada mutación. Suficiente para este volumen.
 *
 * El correo es el canal real de trabajo: cada mensaje del cliente se envía a
 * soporte@viahost.top, de donde se contesta con el cliente en el `Reply-To`. El
 * ticket guardado aquí es el historial que el cliente ve en su área y el que le
 * permite escribir sin depender de su correo. Ver `lib/mail.ts`.
 *
 * La pertenencia se comprueba SOLO por `userId`, nunca por email: solo hay
 * tickets de usuarios con sesión, así que siempre lo tienen, y el registro no
 * verifica la dirección (ver la auditoría de 2026-07-30 sobre `getInvoiceForUser`).
 */

const DATA_DIR = path.join(process.cwd(), "data");
const FILE = path.join(DATA_DIR, "tickets.jsonl");

/** Estado del ticket. Lo mueve quien escribe: el cliente reabre, soporte responde. */
export type TicketStatus = "abierto" | "respondido" | "cerrado";
export const TICKET_STATUSES: TicketStatus[] = ["abierto", "respondido", "cerrado"];

/** Categorías del formulario. Todas van al mismo buzón; sirven para triar. */
export type TicketCategory = "tecnico" | "facturacion" | "otro";
export const TICKET_CATEGORIES: TicketCategory[] = ["tecnico", "facturacion", "otro"];

export type TicketAuthor = "cliente" | "soporte";

export type TicketMessage = {
  id: string;
  autor: TicketAuthor;
  /** Nombre a mostrar en el hilo (el del cliente, o el del admin que responde). */
  nombre: string;
  cuerpo: string;
  creadoAt: string; // ISO
};

export type Ticket = {
  id: string;
  /** Número legible (TCK-AAAA-NNN). Es lo que viaja en el asunto del correo. */
  numero: string;
  userId: string;
  clienteEmail: string;
  clienteNombre: string;
  asunto: string;
  categoria: TicketCategory;
  /** Id interno del servidor al que se refiere, si el cliente eligió uno. */
  servidorId: string | null;
  /** Etiqueta del servidor congelada al crear: el correo no debe releer nada. */
  servidorEtiqueta: string;
  estado: TicketStatus;
  mensajes: TicketMessage[];
  creadoAt: string; // ISO
  actualizadoAt: string; // ISO
};

/** Los ids los emitimos nosotros con `randomUUID`. */
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/**
 * ¿Tiene forma de id nuestro? Se comprueba en la puerta de las rutas, antes de
 * usar el id como clave del límite de peticiones: si se admitiera cualquier
 * cadena, bastaría con inventar ids para fabricar claves sin fin.
 */
export function esIdTicket(id: string): boolean {
  return UUID_RE.test(id);
}

/* ------------------------------- Persistencia ----------------------------- */

async function readAll(): Promise<Ticket[]> {
  let content: string;
  try {
    content = await readFile(FILE, "utf8");
  } catch {
    return [];
  }
  const out: Ticket[] = [];
  for (const line of content.split("\n")) {
    if (!line.trim()) continue;
    try {
      out.push(JSON.parse(line) as Ticket);
    } catch {
      // Línea corrupta: se ignora en vez de romper todo el listado.
    }
  }
  return out;
}

async function writeAll(list: Ticket[]): Promise<void> {
  await mkdir(DATA_DIR, { recursive: true });
  const body = list.map((t) => JSON.stringify(t)).join("\n");
  // 0600: los tickets llevan datos del cliente y detalles de sus servicios.
  // `mode` solo aplica al crear el fichero, así que además se fija.
  await writeFile(FILE, body ? body + "\n" : "", { encoding: "utf8", mode: 0o600 });
  await chmod(FILE, 0o600);
}

/** Siguiente número de la serie del año (TCK-AAAA-NNN), sin huecos. */
function nextNumero(list: Ticket[], year: number): string {
  const prefix = `TCK-${year}-`;
  const max = list.reduce((acc, t) => {
    if (!t.numero.startsWith(prefix)) return acc;
    const n = Number.parseInt(t.numero.slice(prefix.length), 10);
    return Number.isFinite(n) && n > acc ? n : acc;
  }, 0);
  return `${prefix}${String(max + 1).padStart(3, "0")}`;
}

/* --------------------------------- Lectura -------------------------------- */

/** Todos los tickets, del último movido al más antiguo (para el panel). */
export async function listTickets(): Promise<Ticket[]> {
  const list = await readAll();
  return list.sort((a, b) => b.actualizadoAt.localeCompare(a.actualizadoAt));
}

/** Tickets de un cliente. Sin `userId` no devuelve nada nunca. */
export async function listTicketsByUser(userId: string): Promise<Ticket[]> {
  if (!userId) return [];
  const list = await listTickets();
  return list.filter((t) => t.userId === userId);
}

export async function getTicketById(id: string): Promise<Ticket | null> {
  const list = await readAll();
  return list.find((t) => t.id === id) ?? null;
}

/**
 * Ticket de un cliente concreto, o null si no existe o no es suyo. Único punto
 * por el que el área de cliente accede a un ticket, para que la comprobación no
 * se pueda olvidar en una pantalla nueva.
 */
export async function getTicketForUser(id: string, userId: string): Promise<Ticket | null> {
  if (!userId) return null;
  const ticket = await getTicketById(id);
  if (!ticket || ticket.userId !== userId) return null;
  return ticket;
}

/** ¿Cuántos tickets suyos siguen esperando respuesta nuestra? */
export function ticketsAbiertos(list: Ticket[]): number {
  return list.filter((t) => t.estado !== "cerrado").length;
}

/* -------------------------------- Mutaciones ------------------------------ */

export type NewTicketInput = {
  userId: string;
  clienteEmail: string;
  clienteNombre: string;
  asunto: string;
  categoria: TicketCategory;
  servidorId?: string | null;
  servidorEtiqueta?: string;
  mensaje: string;
};

export async function createTicket(input: NewTicketInput): Promise<Ticket> {
  const list = await readAll();
  const now = new Date();
  const iso = now.toISOString();

  const ticket: Ticket = {
    id: randomUUID(),
    numero: nextNumero(list, now.getFullYear()),
    userId: input.userId,
    clienteEmail: input.clienteEmail.trim().toLowerCase(),
    clienteNombre: input.clienteNombre.trim(),
    asunto: input.asunto.trim(),
    categoria: input.categoria,
    servidorId: input.servidorId ?? null,
    servidorEtiqueta: (input.servidorEtiqueta ?? "").trim(),
    estado: "abierto",
    mensajes: [
      {
        id: randomUUID(),
        autor: "cliente",
        nombre: input.clienteNombre.trim(),
        cuerpo: input.mensaje.trim(),
        creadoAt: iso,
      },
    ],
    creadoAt: iso,
    actualizadoAt: iso,
  };

  list.push(ticket);
  await writeAll(list);
  return ticket;
}

/**
 * Añade un mensaje al hilo y mueve el estado en consecuencia: si escribe el
 * cliente el ticket vuelve a estar abierto (aunque estuviera cerrado: responder
 * es reabrir), y si escribimos nosotros queda como respondido.
 */
export async function addTicketMessage(
  id: string,
  msg: { autor: TicketAuthor; nombre: string; cuerpo: string }
): Promise<Ticket | null> {
  const list = await readAll();
  const current = list.find((t) => t.id === id);
  if (!current) return null;

  const iso = new Date().toISOString();
  const updated: Ticket = {
    ...current,
    estado: msg.autor === "cliente" ? "abierto" : "respondido",
    mensajes: [
      ...current.mensajes,
      {
        id: randomUUID(),
        autor: msg.autor,
        nombre: msg.nombre.trim(),
        cuerpo: msg.cuerpo.trim(),
        creadoAt: iso,
      },
    ],
    actualizadoAt: iso,
  };
  await writeAll(list.map((t) => (t.id === id ? updated : t)));
  return updated;
}

export async function setTicketStatus(id: string, estado: TicketStatus): Promise<Ticket | null> {
  const list = await readAll();
  const current = list.find((t) => t.id === id);
  if (!current) return null;
  const updated: Ticket = { ...current, estado, actualizadoAt: new Date().toISOString() };
  await writeAll(list.map((t) => (t.id === id ? updated : t)));
  return updated;
}
