import { createHash, randomBytes, timingSafeEqual } from "node:crypto";
import { mkdir, readFile, rename, writeFile } from "node:fs/promises";
import path from "node:path";

/**
 * Tokens de recuperación de contraseña.
 *
 * Quien tiene el token puede cambiar la contraseña de una cuenta, así que se
 * trata como una credencial:
 *
 *  - En disco se guarda SOLO el hash (SHA-256). Si alguien leyera el fichero no
 *    podría restablecer nada, igual que pasa con las contraseñas.
 *  - Caduca a la hora y es de UN SOLO USO.
 *  - Pedir uno nuevo invalida los anteriores de esa cuenta: si el usuario pide
 *    dos por error, el enlace viejo deja de servir.
 *
 * Persistencia en JSONL (`data/reset-tokens.jsonl`), como el resto del proyecto.
 * La escritura es atómica (temporal + rename) porque el fichero se reescribe
 * entero en cada mutación.
 */

const DATA_DIR = path.join(process.cwd(), "data");
const FILE = path.join(DATA_DIR, "reset-tokens.jsonl");

/** Validez del enlace. Corta a propósito: es una credencial que viaja por correo. */
export const TOKEN_TTL_MS = 60 * 60 * 1000;

type TokenRecord = {
  tokenHash: string;
  userId: string;
  email: string;
  createdAt: string;
  expiresAt: string;
  usedAt: string | null;
};

const hashToken = (raw: string) => createHash("sha256").update(raw).digest("hex");

/* ------------------------------- Persistencia ----------------------------- */

async function readAll(): Promise<TokenRecord[]> {
  let content: string;
  try {
    content = await readFile(FILE, "utf8");
  } catch {
    return [];
  }
  const out: TokenRecord[] = [];
  for (const line of content.split("\n")) {
    if (!line.trim()) continue;
    try {
      out.push(JSON.parse(line) as TokenRecord);
    } catch {
      // Línea corrupta: se ignora en lugar de romper la recuperación entera.
    }
  }
  return out;
}

async function writeAll(list: TokenRecord[]): Promise<void> {
  await mkdir(DATA_DIR, { recursive: true });
  const body = list.map((r) => JSON.stringify(r)).join("\n");
  const tmp = `${FILE}.${randomBytes(8).toString("hex")}.tmp`;
  await writeFile(tmp, body ? body + "\n" : "", { mode: 0o600 });
  await rename(tmp, FILE);
}

/** Descarta lo caducado y lo ya usado: el fichero no debe crecer sin fin. */
function purge(list: TokenRecord[], now: number): TokenRecord[] {
  return list.filter((r) => !r.usedAt && Date.parse(r.expiresAt) > now);
}

/* -------------------------------- Operaciones ----------------------------- */

/**
 * Emite un token para el usuario y devuelve el valor EN CLARO, que es lo único
 * que se envía por correo y no vuelve a estar disponible: en disco queda su hash.
 */
export async function createResetToken(user: {
  id: string;
  email: string;
}): Promise<{ token: string; expiresAt: string }> {
  const now = Date.now();
  const token = randomBytes(32).toString("base64url");
  const expiresAt = new Date(now + TOKEN_TTL_MS).toISOString();

  const list = purge(await readAll(), now)
    // Un enlace vivo por cuenta: pedir otro anula el anterior.
    .filter((r) => r.userId !== user.id);

  list.push({
    tokenHash: hashToken(token),
    userId: user.id,
    email: user.email,
    createdAt: new Date(now).toISOString(),
    expiresAt,
    usedAt: null,
  });
  await writeAll(list);
  return { token, expiresAt };
}

export type ConsumeResult =
  | { ok: true; userId: string; email: string }
  /** No existe, ya se usó o caducó: para el usuario es el mismo mensaje. */
  | { ok: false; reason: "invalid" | "expired" };

/**
 * Canjea un token: comprueba que sirve y lo marca como usado en la misma
 * operación, de modo que un segundo intento con el mismo enlace ya no valga.
 */
export async function consumeResetToken(raw: string): Promise<ConsumeResult> {
  if (!raw || raw.length < 20) return { ok: false, reason: "invalid" };

  const now = Date.now();
  const list = await readAll();
  const wanted = Buffer.from(hashToken(raw), "hex");

  // Comparación en tiempo constante: el hash del token es un secreto.
  const record = list.find((r) => {
    const stored = Buffer.from(r.tokenHash, "hex");
    return stored.length === wanted.length && timingSafeEqual(stored, wanted);
  });

  if (!record || record.usedAt) return { ok: false, reason: "invalid" };
  if (Date.parse(record.expiresAt) <= now) return { ok: false, reason: "expired" };

  record.usedAt = new Date(now).toISOString();
  await writeAll(purge(list, now));
  return { ok: true, userId: record.userId, email: record.email };
}

/** ¿El token sigue siendo canjeable? No lo consume: es para pintar el formulario. */
export async function resetTokenIsUsable(raw: string): Promise<boolean> {
  if (!raw || raw.length < 20) return false;
  const now = Date.now();
  const list = await readAll();
  const target = hashToken(raw);
  return list.some((r) => r.tokenHash === target && !r.usedAt && Date.parse(r.expiresAt) > now);
}
