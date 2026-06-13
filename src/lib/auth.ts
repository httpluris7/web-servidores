import { createHash, randomBytes, randomUUID, scryptSync, timingSafeEqual } from "node:crypto";
import { appendFile, mkdir, readFile, rename, writeFile } from "node:fs/promises";
import path from "node:path";

/**
 * Capa de autenticación sin dependencias externas.
 *
 * - Las contraseñas se almacenan hasheadas con scrypt (sal por usuario).
 * - Los usuarios se persisten como JSONL en `data/usuarios.jsonl`, igual que
 *   los leads (ver lib/leads.ts). Sirve para una escala pequeña; si el cliente
 *   necesita más, este es el único módulo a sustituir por una BD real.
 */

const DATA_DIR = path.join(process.cwd(), "data");
const USERS_FILE = path.join(DATA_DIR, "usuarios.jsonl");

export type StoredUser = {
  id: string;
  email: string;
  passwordHash: string;
  nombre: string;
  apellidos: string;
  direccion: string;
  ciudad: string;
  estado: string;
  pais: string;
  telefono: string;
  codigoPostal: string;
  createdAt: string;
};

export type PublicUser = Omit<StoredUser, "passwordHash">;

export type NewUserInput = Omit<StoredUser, "id" | "passwordHash" | "createdAt"> & {
  password: string;
};

/* --------------------------------- Hashing -------------------------------- */

/** Hashea una contraseña con scrypt. Formato: `scrypt$<salt hex>$<hash hex>`. */
export function hashPassword(password: string): string {
  const salt = randomBytes(16);
  const derived = scryptSync(password, salt, 64);
  return `scrypt$${salt.toString("hex")}$${derived.toString("hex")}`;
}

/**
 * "Versión de autenticación" de un usuario: huella corta y estable derivada del
 * hash de su contraseña. Se incrusta en la cookie de sesión; cuando la
 * contraseña cambia, el hash cambia y con él esta huella, de modo que toda
 * cookie emitida con la huella anterior queda invalidada. Es un derivado
 * unidireccional: no expone el hash.
 */
export function authVersionFromHash(passwordHash: string): string {
  return createHash("sha256").update(passwordHash).digest("base64url").slice(0, 22);
}

/** Huella de autenticación del usuario indicado (por id), o null si no existe. */
export async function getUserAuthVersion(id: string): Promise<string | null> {
  const users = await readAllUsers();
  const user = users.find((u) => u.id === id);
  return user ? authVersionFromHash(user.passwordHash) : null;
}

/**
 * Quema el mismo tiempo de cómputo que una verificación real, sin comparar
 * contra ningún usuario. Se usa en login cuando el email no existe: así el
 * coste de scrypt es equivalente exista o no la cuenta, y el tiempo de
 * respuesta deja de revelar qué emails están registrados (enumeración).
 */
let dummyHash: string | null = null;
export function burnPasswordTime(password: string): void {
  if (!dummyHash) dummyHash = hashPassword("timing-equalizer-not-a-real-password");
  // El resultado se descarta a propósito; solo nos interesa el coste constante.
  verifyPassword(password, dummyHash);
}

/** Verifica una contraseña contra el hash almacenado (comparación timing-safe). */
export function verifyPassword(password: string, stored: string): boolean {
  const [scheme, saltHex, hashHex] = stored.split("$");
  if (scheme !== "scrypt" || !saltHex || !hashHex) return false;
  const salt = Buffer.from(saltHex, "hex");
  const expected = Buffer.from(hashHex, "hex");
  const derived = scryptSync(password, salt, expected.length);
  return derived.length === expected.length && timingSafeEqual(derived, expected);
}

/* ------------------------------- Persistencia ----------------------------- */

function toPublic(user: StoredUser): PublicUser {
  // Descarta el hash antes de exponer el usuario fuera del servidor.
  const { passwordHash: _omit, ...pub } = user;
  void _omit;
  return pub;
}

async function readAllUsers(): Promise<StoredUser[]> {
  let content: string;
  try {
    content = await readFile(USERS_FILE, "utf8");
  } catch {
    return [];
  }
  const users: StoredUser[] = [];
  for (const line of content.split("\n")) {
    if (!line.trim()) continue;
    try {
      users.push(JSON.parse(line) as StoredUser);
    } catch {
      // Línea corrupta: la ignoramos en lugar de romper todo el listado.
    }
  }
  return users;
}

/** Busca un usuario por email (case-insensitive). Devuelve el registro completo. */
export async function findUserByEmail(email: string): Promise<StoredUser | null> {
  const target = email.trim().toLowerCase();
  const users = await readAllUsers();
  return users.find((u) => u.email.toLowerCase() === target) ?? null;
}

/** Busca un usuario por id y lo devuelve sin el hash. */
export async function getPublicUserById(id: string): Promise<PublicUser | null> {
  const users = await readAllUsers();
  const user = users.find((u) => u.id === id);
  return user ? toPublic(user) : null;
}

/**
 * Lista todos los usuarios registrados (sin hash), del más reciente al más
 * antiguo. Pensado para el panel de administración; protégelo siempre con un
 * guard de admin antes de exponerlo.
 */
export async function listUsers(): Promise<PublicUser[]> {
  const users = await readAllUsers();
  return users.map(toPublic).sort((a, b) => b.createdAt.localeCompare(a.createdAt));
}

/**
 * Crea y persiste un usuario nuevo. Lanza `EMAIL_TAKEN` si el email ya existe.
 * Nota: el control de duplicados es best-effort (sin lock de fichero), suficiente
 * para esta escala; una BD real aportaría unicidad transaccional.
 */
export async function createUser(input: NewUserInput): Promise<PublicUser> {
  if (await findUserByEmail(input.email)) {
    throw new Error("EMAIL_TAKEN");
  }
  const { password, ...rest } = input;
  const user: StoredUser = {
    id: randomUUID(),
    ...rest,
    email: input.email.trim().toLowerCase(),
    passwordHash: hashPassword(password),
    createdAt: new Date().toISOString(),
  };
  await mkdir(DATA_DIR, { recursive: true });
  await appendFile(USERS_FILE, JSON.stringify(user) + "\n", "utf8");
  return toPublic(user);
}

/**
 * Cambia la contraseña de un usuario (identificado por id) y reescribe el
 * fichero completo de forma atómica (escribe a un temporal y hace rename).
 *
 * Devuelve `true` si el usuario existía y se actualizó; `false` si no se
 * encontró. Como el resto del módulo, el control de concurrencia es best-effort
 * (sin lock): suficiente a esta escala. Reescribir entero es necesario porque el
 * almacén es JSONL append-only y no soporta updates in-place.
 */
export async function updateUserPassword(id: string, newPassword: string): Promise<boolean> {
  const users = await readAllUsers();
  const target = users.find((u) => u.id === id);
  if (!target) return false;

  target.passwordHash = hashPassword(newPassword);
  const content = users.map((u) => JSON.stringify(u)).join("\n") + "\n";

  await mkdir(DATA_DIR, { recursive: true });
  const tmp = `${USERS_FILE}.${randomUUID()}.tmp`;
  await writeFile(tmp, content, "utf8");
  await rename(tmp, USERS_FILE);
  return true;
}
