import { createHmac, timingSafeEqual } from "node:crypto";
import { cookies } from "next/headers";

/**
 * Sesión stateless mediante cookie firmada (HMAC-SHA256).
 *
 * La cookie es `httpOnly` y guarda `{ uid, email, exp }` firmado con
 * `AUTH_SECRET`. No requiere almacén de sesiones: si la firma es válida y no ha
 * expirado, la sesión es buena. Para invalidar todas las sesiones basta con
 * rotar `AUTH_SECRET`.
 */

const COOKIE_NAME = "vh_session";
const MAX_AGE_SECONDS = 60 * 60 * 24 * 7; // 7 días

function secret(): string {
  // En producción debe definirse AUTH_SECRET (ver .env). El fallback solo evita
  // que reviente en desarrollo si alguien olvida configurarlo.
  return process.env.AUTH_SECRET || "dev-insecure-secret-cambia-esto";
}

function sign(data: string): string {
  return createHmac("sha256", secret()).update(data).digest("base64url");
}

function safeEqual(a: string, b: string): boolean {
  const ab = Buffer.from(a);
  const bb = Buffer.from(b);
  return ab.length === bb.length && timingSafeEqual(ab, bb);
}

export type SessionData = { uid: string; email: string; exp: number };

/** Crea la cookie de sesión para un usuario autenticado. */
export async function createSession(user: { id: string; email: string }): Promise<void> {
  const payload: SessionData = {
    uid: user.id,
    email: user.email,
    exp: Date.now() + MAX_AGE_SECONDS * 1000,
  };
  const data = Buffer.from(JSON.stringify(payload)).toString("base64url");
  const token = `${data}.${sign(data)}`;

  const store = await cookies();
  store.set(COOKIE_NAME, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: MAX_AGE_SECONDS,
  });
}

/** Lee y verifica la sesión actual. Devuelve null si no hay/está inválida/expirada. */
export async function getSession(): Promise<SessionData | null> {
  const store = await cookies();
  const token = store.get(COOKIE_NAME)?.value;
  if (!token) return null;

  const [data, sig] = token.split(".");
  if (!data || !sig || !safeEqual(sig, sign(data))) return null;

  try {
    const payload = JSON.parse(Buffer.from(data, "base64url").toString("utf8")) as SessionData;
    if (typeof payload.exp !== "number" || payload.exp < Date.now()) return null;
    return payload;
  } catch {
    return null;
  }
}

/** Elimina la cookie de sesión (logout). */
export async function destroySession(): Promise<void> {
  const store = await cookies();
  store.delete(COOKIE_NAME);
}
