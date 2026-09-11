import { createHash, randomBytes, timingSafeEqual } from "node:crypto";
import { mkdir, readFile, rename, writeFile } from "node:fs/promises";
import path from "node:path";

/**
 * Tokens de confirmación de cambio de email.
 *
 * El usuario pide cambiar su correo desde /cuenta (con su contraseña) y el
 * enlace de confirmación se envía a la dirección NUEVA: así se demuestra que
 * ese buzón es suyo antes de que pase a ser la clave de la cuenta.
 *
 * Mismo tratamiento que los tokens de recuperación (ver reset-tokens.ts):
 *  - En disco solo se guarda el hash SHA-256.
 *  - Caduca a la hora y es de UN SOLO USO.
 *  - Pedir uno nuevo invalida los anteriores de esa cuenta.
 *
 * Persistencia en JSONL (`data/email-change-tokens.jsonl`).
 */

const DATA_DIR = path.join(process.cwd(), "data");
const FILE = path.join(DATA_DIR, "email-change-tokens.jsonl");

export const TOKEN_TTL_MS = 60 * 60 * 1000;

type TokenRecord = {
  tokenHash: string;
  userId: string;
  /** Dirección que pasará a ser el email de la cuenta al confirmar. */
  newEmail: string;
  createdAt: string;
  expiresAt: string;
  usedAt: string | null;
};

const hashToken = (raw: string) => createHash("sha256").update(raw).digest("hex");

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
      // Línea corrupta: se ignora.
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

function purge(list: TokenRecord[], now: number): TokenRecord[] {
  return list.filter((r) => !r.usedAt && Date.parse(r.expiresAt) > now);
}

/** Emite un token y devuelve el valor EN CLARO (solo va por correo). */
export async function createEmailChangeToken(
  userId: string,
  newEmail: string
): Promise<{ token: string; expiresAt: string }> {
  const now = Date.now();
  const token = randomBytes(32).toString("base64url");
  const expiresAt = new Date(now + TOKEN_TTL_MS).toISOString();

  const list = purge(await readAll(), now).filter((r) => r.userId !== userId);
  list.push({
    tokenHash: hashToken(token),
    userId,
    newEmail: newEmail.trim().toLowerCase(),
    createdAt: new Date(now).toISOString(),
    expiresAt,
    usedAt: null,
  });
  await writeAll(list);
  return { token, expiresAt };
}

function findRecord(list: TokenRecord[], raw: string): TokenRecord | undefined {
  const wanted = Buffer.from(hashToken(raw), "hex");
  return list.find((r) => {
    const stored = Buffer.from(r.tokenHash, "hex");
    return stored.length === wanted.length && timingSafeEqual(stored, wanted);
  });
}

export type PeekResult = { ok: true; userId: string; newEmail: string } | { ok: false };

/** Comprueba el token sin consumirlo (para pintar la página de confirmación). */
export async function peekEmailChangeToken(raw: string): Promise<PeekResult> {
  if (!raw || raw.length < 20) return { ok: false };
  const record = findRecord(await readAll(), raw);
  if (!record || record.usedAt || Date.parse(record.expiresAt) <= Date.now()) return { ok: false };
  return { ok: true, userId: record.userId, newEmail: record.newEmail };
}

export type ConsumeResult =
  | { ok: true; userId: string; newEmail: string }
  | { ok: false; reason: "invalid" | "expired" };

/** Canjea el token y lo marca como usado en la misma operación. */
export async function consumeEmailChangeToken(raw: string): Promise<ConsumeResult> {
  if (!raw || raw.length < 20) return { ok: false, reason: "invalid" };
  const now = Date.now();
  const list = await readAll();
  const record = findRecord(list, raw);
  if (!record || record.usedAt) return { ok: false, reason: "invalid" };
  if (Date.parse(record.expiresAt) <= now) return { ok: false, reason: "expired" };
  record.usedAt = new Date(now).toISOString();
  await writeAll(purge(list, now));
  return { ok: true, userId: record.userId, newEmail: record.newEmail };
}
