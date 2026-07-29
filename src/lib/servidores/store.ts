import { randomUUID } from "node:crypto";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";

/**
 * Vinculación entre los servidores del proveedor y NUESTROS clientes.
 *
 * La asignación vive aquí, no en el panel del proveedor, por dos razones:
 * un mismo cliente puede tener servidores de varios proveedores (y mañana de
 * nuestro propio Proxmox), y el área de cliente no debe depender de que el
 * proveedor tenga usuarios dados de alta.
 *
 * Almacén JSONL (`data/servidores.jsonl`) con la misma filosofía que
 * `lib/facturas.ts`: sin dependencias, reescribiendo el fichero en cada
 * mutación. Suficiente para este volumen.
 */

const DATA_DIR = path.join(process.cwd(), "data");
const FILE = path.join(DATA_DIR, "servidores.jsonl");

/** Proveedores soportados. Hoy solo uno; el campo existe para no migrar luego. */
export type ServerProvider = "v4vm";

export type ManagedServer = {
  id: string;
  proveedor: ServerProvider;
  /** Id del servidor en el proveedor: la clave con la que se le habla. */
  remoteId: number;
  /** UUID del proveedor, guardado para poder detectar un id reutilizado. */
  remoteUuid: string;
  /** Cliente propietario, o null si aún no está asignado. */
  userId: string | null;
  /** Nombre que ve el cliente. Por defecto, el que tiene en el proveedor. */
  etiqueta: string;
  /** Notas internas del admin; no se muestran al cliente. */
  notas: string;
  creadoAt: string;
  actualizadoAt: string;
};

/* ------------------------------- Persistencia ----------------------------- */

async function readAll(): Promise<ManagedServer[]> {
  let content: string;
  try {
    content = await readFile(FILE, "utf8");
  } catch {
    return [];
  }
  const out: ManagedServer[] = [];
  for (const line of content.split("\n")) {
    if (!line.trim()) continue;
    try {
      out.push(JSON.parse(line) as ManagedServer);
    } catch {
      // Línea corrupta: se ignora en vez de romper todo el inventario.
    }
  }
  return out;
}

async function writeAll(list: ManagedServer[]): Promise<void> {
  await mkdir(DATA_DIR, { recursive: true });
  const body = list.map((s) => JSON.stringify(s)).join("\n");
  await writeFile(FILE, body ? body + "\n" : "", "utf8");
}

/* --------------------------------- Lectura -------------------------------- */

export async function listManagedServers(): Promise<ManagedServer[]> {
  return readAll();
}

/** Ficha por su id interno (el que viaja en las URLs del área de cliente). */
export async function getManagedById(id: string): Promise<ManagedServer | null> {
  const list = await readAll();
  return list.find((s) => s.id === id) ?? null;
}

/** Fichas asignadas a un cliente. Sin `userId` no devuelve nada nunca. */
export async function listManagedByUser(userId: string): Promise<ManagedServer[]> {
  if (!userId) return [];
  const list = await readAll();
  return list.filter((s) => s.userId === userId);
}

/** Vinculación de un servidor del proveedor, o null si no está dado de alta. */
export async function getManagedByRemoteId(
  proveedor: ServerProvider,
  remoteId: number
): Promise<ManagedServer | null> {
  const list = await readAll();
  return list.find((s) => s.proveedor === proveedor && s.remoteId === remoteId) ?? null;
}

/* -------------------------------- Mutaciones ------------------------------ */

export type AssignInput = {
  proveedor: ServerProvider;
  remoteId: number;
  remoteUuid: string;
  /** null desasigna el servidor pero conserva la ficha (etiqueta, notas). */
  userId: string | null;
  etiqueta?: string;
  notas?: string;
};

/**
 * Crea o actualiza la vinculación de un servidor. Es idempotente: llamarla dos
 * veces con los mismos datos deja el mismo registro.
 */
export async function assignServer(input: AssignInput): Promise<ManagedServer> {
  const list = await readAll();
  const now = new Date().toISOString();
  const current = list.find(
    (s) => s.proveedor === input.proveedor && s.remoteId === input.remoteId
  );

  if (!current) {
    const created: ManagedServer = {
      id: randomUUID(),
      proveedor: input.proveedor,
      remoteId: input.remoteId,
      remoteUuid: input.remoteUuid,
      userId: input.userId,
      etiqueta: (input.etiqueta ?? "").trim(),
      notas: (input.notas ?? "").trim(),
      creadoAt: now,
      actualizadoAt: now,
    };
    list.push(created);
    await writeAll(list);
    return created;
  }

  const updated: ManagedServer = {
    ...current,
    // El UUID puede llegar vacío si quien llama no lo tiene a mano: en ese caso
    // conservamos el que ya había en vez de borrarlo.
    remoteUuid: input.remoteUuid || current.remoteUuid,
    userId: input.userId,
    etiqueta: input.etiqueta !== undefined ? input.etiqueta.trim() : current.etiqueta,
    notas: input.notas !== undefined ? input.notas.trim() : current.notas,
    actualizadoAt: now,
  };
  await writeAll(list.map((s) => (s.id === current.id ? updated : s)));
  return updated;
}

/** Borra la ficha entera de un servidor (no toca nada en el proveedor). */
export async function forgetServer(
  proveedor: ServerProvider,
  remoteId: number
): Promise<boolean> {
  const list = await readAll();
  const next = list.filter((s) => !(s.proveedor === proveedor && s.remoteId === remoteId));
  if (next.length === list.length) return false;
  await writeAll(next);
  return true;
}
