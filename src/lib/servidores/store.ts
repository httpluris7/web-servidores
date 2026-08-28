import { createHash, randomBytes, randomUUID } from "node:crypto";
import { chmod, mkdir, readFile, writeFile } from "node:fs/promises";
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

/**
 * Proveedores soportados.
 *
 * `externo` es la vía para máquinas de las que NO tenemos API —los VPS de
 * takehost, por ejemplo—: se dan de alta a mano y su única fuente de datos es
 * el agente instalado dentro. Todo lo que no sea leer métricas (encender,
 * reinstalar, consola) no existe para ellas, y las pantallas lo tienen en
 * cuenta en vez de fingir botones que no harían nada.
 */
export type ServerProvider = "v4vm" | "externo" | "proxmox";

export type ManagedServer = {
  id: string;
  proveedor: ServerProvider;
  /** Id del servidor en el proveedor: la clave con la que se le habla. 0 en los externos. */
  remoteId: number;
  /** UUID del proveedor, guardado para poder detectar un id reutilizado. */
  remoteUuid: string;
  /** Cliente propietario, o null si aún no está asignado. */
  userId: string | null;
  /** Nombre que ve el cliente. Por defecto, el que tiene en el proveedor. */
  etiqueta: string;
  /** IP o nombre de host. Informativo; en los externos es lo único que hay. */
  host: string;
  /** Notas internas del admin; no se muestran al cliente. */
  notas: string;
  /**
   * SHA-256 del token del agente, nunca el token en claro: si alguien lee este
   * fichero no puede suplantar al agente de nadie. El token se enseña una sola
   * vez, al generarlo, igual que una contraseña.
   */
  agenteTokenHash: string | null;
  /** Cuándo se generó el token vigente (para poder rotarlo con criterio). */
  agenteAltaAt: string | null;
  creadoAt: string;
  actualizadoAt: string;
};

/** Los ids internos los emitimos nosotros con `randomUUID`. */
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/**
 * ¿Tiene forma de id nuestro? Sirve para descartar en la puerta lo que no puede
 * existir, antes de usarlo como clave de nada (ver el límite de peticiones del
 * área de cliente, que se aplica antes de comprobar la pertenencia).
 */
export function esIdInterno(id: string): boolean {
  return UUID_RE.test(id);
}

/* ------------------------------- Persistencia ----------------------------- */

/**
 * Rellena los campos que las fichas antiguas no tienen.
 *
 * El fichero se escribió antes de que existieran los externos y el agente, así
 * que las líneas ya guardadas no traen `host` ni `agenteTokenHash`. Normalizar
 * aquí evita tener que comprobar `?? null` en cada pantalla y en cada ruta.
 */
function normalizar(raw: Partial<ManagedServer>): ManagedServer {
  return {
    id: String(raw.id ?? ""),
    proveedor:
      raw.proveedor === "externo"
        ? "externo"
        : raw.proveedor === "proxmox"
          ? "proxmox"
          : "v4vm",
    remoteId: typeof raw.remoteId === "number" ? raw.remoteId : 0,
    remoteUuid: raw.remoteUuid ?? "",
    userId: raw.userId ?? null,
    etiqueta: raw.etiqueta ?? "",
    host: raw.host ?? "",
    notas: raw.notas ?? "",
    agenteTokenHash: raw.agenteTokenHash ?? null,
    agenteAltaAt: raw.agenteAltaAt ?? null,
    creadoAt: raw.creadoAt ?? new Date(0).toISOString(),
    actualizadoAt: raw.actualizadoAt ?? new Date(0).toISOString(),
  };
}

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
      const ficha = normalizar(JSON.parse(line) as Partial<ManagedServer>);
      if (ficha.id) out.push(ficha);
    } catch {
      // Línea corrupta: se ignora en vez de romper todo el inventario.
    }
  }
  return out;
}

async function writeAll(list: ManagedServer[]): Promise<void> {
  await mkdir(DATA_DIR, { recursive: true });
  const body = list.map((s) => JSON.stringify(s)).join("\n");
  // 0600: en `data/` viven datos de clientes; que no los pueda leer cualquier
  // usuario de la máquina. `mode` solo aplica al crear, así que además se fija.
  await writeFile(FILE, body ? body + "\n" : "", { encoding: "utf8", mode: 0o600 });
  await chmod(FILE, 0o600);
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
      host: "",
      notas: (input.notas ?? "").trim(),
      agenteTokenHash: null,
      agenteAltaAt: null,
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

/* ---------------------------- Servidores externos ------------------------- */

export type ExternalInput = {
  etiqueta: string;
  host: string;
  userId: string | null;
  notas?: string;
};

/**
 * Da de alta una máquina sin proveedor: solo existe para nosotros y sus datos
 * llegan del agente. `remoteId` se queda en 0 —no hay id remoto— y por eso
 * todas las búsquedas por proveedor filtran también por `proveedor`, que si no
 * los externos se pisarían entre sí en el 0.
 */
export async function createExternalServer(input: ExternalInput): Promise<ManagedServer> {
  const list = await readAll();
  const now = new Date().toISOString();
  const created: ManagedServer = {
    id: randomUUID(),
    proveedor: "externo",
    remoteId: 0,
    remoteUuid: "",
    userId: input.userId,
    etiqueta: input.etiqueta.trim(),
    host: input.host.trim(),
    notas: (input.notas ?? "").trim(),
    agenteTokenHash: null,
    agenteAltaAt: null,
    creadoAt: now,
    actualizadoAt: now,
  };
  list.push(created);
  await writeAll(list);
  return created;
}

/** Edita una ficha por su id interno. Vale para externos y para los del proveedor. */
export async function updateManaged(
  id: string,
  patch: Partial<Pick<ManagedServer, "etiqueta" | "host" | "userId" | "notas">>
): Promise<ManagedServer | null> {
  const list = await readAll();
  const current = list.find((s) => s.id === id);
  if (!current) return null;

  const updated: ManagedServer = {
    ...current,
    etiqueta: patch.etiqueta !== undefined ? patch.etiqueta.trim() : current.etiqueta,
    host: patch.host !== undefined ? patch.host.trim() : current.host,
    userId: patch.userId !== undefined ? patch.userId : current.userId,
    notas: patch.notas !== undefined ? patch.notas.trim() : current.notas,
    actualizadoAt: new Date().toISOString(),
  };
  await writeAll(list.map((s) => (s.id === id ? updated : s)));
  return updated;
}

/** Borra una ficha por su id interno. Quien llame debe borrar sus métricas. */
export async function deleteManaged(id: string): Promise<boolean> {
  const list = await readAll();
  const next = list.filter((s) => s.id !== id);
  if (next.length === list.length) return false;
  await writeAll(next);
  return true;
}

/* ----------------------------- Token del agente --------------------------- */

/** Prefijo reconocible: si alguien lo pega donde no debe, se sabe qué es. */
const TOKEN_PREFIJO = "vha_";

export function hashAgentToken(token: string): string {
  return createHash("sha256").update(token, "utf8").digest("hex");
}

/**
 * Genera un token nuevo para el agente y guarda solo su hash. Devuelve el token
 * en claro UNA vez: no hay forma de volver a verlo, hay que regenerarlo. Si ya
 * había uno, este lo sustituye y el agente antiguo deja de poder enviar.
 */
export async function issueAgentToken(id: string): Promise<string | null> {
  const list = await readAll();
  const current = list.find((s) => s.id === id);
  if (!current) return null;

  const token = TOKEN_PREFIJO + randomBytes(32).toString("base64url");
  const updated: ManagedServer = {
    ...current,
    agenteTokenHash: hashAgentToken(token),
    agenteAltaAt: new Date().toISOString(),
    actualizadoAt: new Date().toISOString(),
  };
  await writeAll(list.map((s) => (s.id === id ? updated : s)));
  return token;
}

/** Revoca el token: el agente instalado deja de poder enviar métricas. */
export async function revokeAgentToken(id: string): Promise<boolean> {
  const list = await readAll();
  const current = list.find((s) => s.id === id);
  if (!current || !current.agenteTokenHash) return false;
  const updated: ManagedServer = {
    ...current,
    agenteTokenHash: null,
    agenteAltaAt: null,
    actualizadoAt: new Date().toISOString(),
  };
  await writeAll(list.map((s) => (s.id === id ? updated : s)));
  return true;
}

/**
 * Ficha a la que pertenece un token de agente, o null.
 *
 * Se busca por el hash, no por el token: el fichero solo guarda hashes. Una
 * ficha sin token no puede casar nunca, ni siquiera con un hash de cadena vacía.
 */
export async function findByAgentToken(token: string): Promise<ManagedServer | null> {
  if (!token || !token.startsWith(TOKEN_PREFIJO)) return null;
  const hash = hashAgentToken(token);
  const list = await readAll();
  return list.find((s) => s.agenteTokenHash !== null && s.agenteTokenHash === hash) ?? null;
}
