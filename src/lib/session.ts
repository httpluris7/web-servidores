import { createHmac, timingSafeEqual } from "node:crypto";
import { cookies } from "next/headers";
import { getUserAuthVersion } from "./auth";
import { isMfaEnabled } from "./mfa";

/**
 * Sesión semi-stateless mediante cookie firmada (HMAC-SHA256).
 *
 * La cookie es `httpOnly` y guarda `{ uid, email, pv, exp }` firmado con
 * `AUTH_SECRET`. `pv` es la "versión de autenticación" del usuario (huella
 * derivada del hash de su contraseña). Al validar, se recalcula esa huella
 * contra el usuario almacenado: si la contraseña ha cambiado desde que se emitió
 * la cookie, `pv` ya no coincide y la sesión se considera inválida. Así, cambiar
 * la contraseña invalida automáticamente todas las cookies anteriores.
 *
 * Esto añade una lectura del almacén de usuarios por petición autenticada
 * (asumible a esta escala, como el resto del módulo). Para invalidar TODAS las
 * sesiones de golpe sigue bastando con rotar `AUTH_SECRET`.
 *
 * Segundo factor (TOTP): la cookie lleva `mfa: true` solo si la sesión superó
 * el código. Invariante: si el usuario tiene 2FA activo, SOLO valen sesiones
 * con `mfa: true` (las emitidas antes de activarlo caducan solas). Entre la
 * contraseña y el código vive una cookie aparte, `vh_mfa` (5 min), que no da
 * acceso a nada: solo identifica a quién se le está pidiendo el código.
 */

const COOKIE_NAME = "vh_session";
const MFA_COOKIE_NAME = "vh_mfa";
const MAX_AGE_SECONDS = 60 * 60 * 24 * 7; // 7 días
const MFA_CHALLENGE_SECONDS = 5 * 60;

function secret(): string {
  const configured = process.env.AUTH_SECRET;
  // En producción exigimos un secreto fuerte. Si falta (o es demasiado corto),
  // fallamos en cerrado: preferimos un 500 ruidoso a firmar sesiones con un
  // secreto público —lo que permitiría falsificar cookies y suplantar al admin—.
  if (process.env.NODE_ENV === "production") {
    if (!configured || configured.length < 16) {
      throw new Error(
        "AUTH_SECRET no está definido (o es demasiado corto) en producción. " +
          "Se rechaza arrancar con un secreto de sesión inseguro."
      );
    }
    return configured;
  }
  // El fallback solo evita que reviente en desarrollo si alguien lo olvida.
  return configured || "dev-insecure-secret-cambia-esto";
}

function sign(data: string): string {
  return createHmac("sha256", secret()).update(data).digest("base64url");
}

function safeEqual(a: string, b: string): boolean {
  const ab = Buffer.from(a);
  const bb = Buffer.from(b);
  return ab.length === bb.length && timingSafeEqual(ab, bb);
}

export type SessionData = { uid: string; email: string; pv: string; exp: number; mfa?: boolean };

/**
 * Crea la cookie de sesión para un usuario autenticado. Incrusta la huella de
 * autenticación vigente del usuario (`pv`), de modo que la cookie quede ligada a
 * su contraseña actual. Llamar de nuevo a `createSession` tras un cambio de
 * contraseña re-emite la cookie del dispositivo actual con la nueva huella.
 */
export async function createSession(
  user: { id: string; email: string },
  { mfa = false }: { mfa?: boolean } = {}
): Promise<void> {
  const payload: SessionData = {
    uid: user.id,
    email: user.email,
    pv: (await getUserAuthVersion(user.id)) ?? "",
    exp: Date.now() + MAX_AGE_SECONDS * 1000,
    mfa,
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

    // Liga la sesión a la contraseña vigente: si cambió (o el usuario ya no
    // existe), la huella deja de coincidir y la sesión queda invalidada.
    const currentPv = await getUserAuthVersion(payload.uid);
    if (!currentPv || currentPv !== payload.pv) return null;

    // Con 2FA activo solo vale una sesión que pasó el código.
    if (payload.mfa !== true && (await isMfaEnabled(payload.uid))) return null;

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

/* --------------------------- Reto de segundo paso -------------------------- */

type MfaChallenge = { uid: string; email: string; exp: number };

/** Tras validar la contraseña de un usuario con 2FA: cookie corta que solo sirve para pedirle el código. */
export async function createMfaChallenge(user: { id: string; email: string }): Promise<void> {
  const payload: MfaChallenge = { uid: user.id, email: user.email, exp: Date.now() + MFA_CHALLENGE_SECONDS * 1000 };
  const data = Buffer.from(JSON.stringify(payload)).toString("base64url");
  // Dominio de firma distinto ("mfa.") para que un reto nunca cuele como sesión ni al revés.
  const token = `${data}.${sign(`mfa.${data}`)}`;
  const store = await cookies();
  store.set(MFA_COOKIE_NAME, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: MFA_CHALLENGE_SECONDS,
  });
}

export async function getMfaChallenge(): Promise<MfaChallenge | null> {
  const store = await cookies();
  const token = store.get(MFA_COOKIE_NAME)?.value;
  if (!token) return null;
  const [data, sig] = token.split(".");
  if (!data || !sig || !safeEqual(sig, sign(`mfa.${data}`))) return null;
  try {
    const payload = JSON.parse(Buffer.from(data, "base64url").toString("utf8")) as MfaChallenge;
    if (typeof payload.exp !== "number" || payload.exp < Date.now()) return null;
    return payload;
  } catch {
    return null;
  }
}

export async function destroyMfaChallenge(): Promise<void> {
  const store = await cookies();
  store.delete(MFA_COOKIE_NAME);
}
