import { createHash, randomBytes, timingSafeEqual } from "node:crypto";
import { mkdir, readFile, rename, writeFile } from "node:fs/promises";
import path from "node:path";

/**
 * Tokens de verificación de email al registrarse (vuln-0006).
 *
 * La cuenta nace "pendiente" y solo pasa a activa cuando el dueño del buzón
 * abre el enlace. Quien tiene el token activa la cuenta, así que se trata como
 * una credencial, igual que los tokens de recuperación (reset-tokens.ts):
 *
 *  - En disco se guarda SOLO el hash SHA-256 del token.
 *  - Caduca a las 24 h y es de UN SOLO USO.
 *  - Emitir uno nuevo (reenvío) invalida los anteriores de esa cuenta.
 *
 * Persistencia en JSONL (`data/verify-tokens.jsonl`), escritura atómica.
 */

const DATA_DIR = path.join(process.cwd(), "data");
const FILE = path.join(DATA_DIR, "verify-tokens.jsonl");

/** Validez del enlace de verificación. */
export const VERIFY_TOKEN_TTL_MS = 24 * 60 * 60 * 1000;

type TokenRecord = {
  tokenHash: string;
  userId: string;
  email: string;
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

/** Descarta lo caducado y lo ya usado: el fichero no debe crecer sin fin. */
function purge(list: TokenRecord[], now: number): TokenRecord[] {
  return list.filter((r) => !r.usedAt && Date.parse(r.expiresAt) > now);
}

function findRecord(list: TokenRecord[], raw: string): TokenRecord | undefined {
  const wanted = Buffer.from(hashToken(raw), "hex");
  // Comparación en tiempo constante: el hash del token es un secreto.
  return list.find((r) => {
    const stored = Buffer.from(r.tokenHash, "hex");
    return stored.length === wanted.length && timingSafeEqual(stored, wanted);
  });
}

/** Emite un token y devuelve el valor EN CLARO (solo viaja en el correo). */
export async function createVerifyToken(user: {
  id: string;
  email: string;
}): Promise<{ token: string; expiresAt: string }> {
  const now = Date.now();
  const token = randomBytes(32).toString("base64url");
  const expiresAt = new Date(now + VERIFY_TOKEN_TTL_MS).toISOString();

  // Un enlace vivo por cuenta: reenviar anula el anterior.
  const list = purge(await readAll(), now).filter((r) => r.userId !== user.id);
  list.push({
    tokenHash: hashToken(token),
    userId: user.id,
    email: user.email.trim().toLowerCase(),
    createdAt: new Date(now).toISOString(),
    expiresAt,
    usedAt: null,
  });
  await writeAll(list);
  return { token, expiresAt };
}

export type PeekResult = { ok: true; userId: string; email: string } | { ok: false };

/** Comprueba el token sin consumirlo (para pintar la página de verificación). */
export async function peekVerifyToken(raw: string): Promise<PeekResult> {
  if (!raw || raw.length < 20 || raw.length > 200) return { ok: false };
  const record = findRecord(await readAll(), raw);
  if (!record || record.usedAt || Date.parse(record.expiresAt) <= Date.now()) return { ok: false };
  return { ok: true, userId: record.userId, email: record.email };
}

export type ConsumeResult =
  | { ok: true; userId: string; email: string }
  | { ok: false; reason: "invalid" | "expired" };

/** Canjea el token y lo marca como usado en la misma operación (un solo uso). */
export async function consumeVerifyToken(raw: string): Promise<ConsumeResult> {
  if (!raw || raw.length < 20 || raw.length > 200) return { ok: false, reason: "invalid" };
  const now = Date.now();
  const list = await readAll();
  const record = findRecord(list, raw);
  if (!record || record.usedAt) return { ok: false, reason: "invalid" };
  if (Date.parse(record.expiresAt) <= now) return { ok: false, reason: "expired" };
  record.usedAt = new Date(now).toISOString();
  await writeAll(purge(list, now));
  return { ok: true, userId: record.userId, email: record.email };
}
