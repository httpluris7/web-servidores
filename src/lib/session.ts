import { createHmac, timingSafeEqual } from "node:crypto";
import { cookies } from "next/headers";
import { getUserAuthVersion } from "./auth";

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
 */

const COOKIE_NAME = "vh_session";
const MAX_AGE_SECONDS = 60 * 60 * 24 * 7; // 7 días

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

export type SessionData = { uid: string; email: string; pv: string; exp: number };

/**
 * Crea la cookie de sesión para un usuario autenticado. Incrusta la huella de
 * autenticación vigente del usuario (`pv`), de modo que la cookie quede ligada a
 * su contraseña actual. Llamar de nuevo a `createSession` tras un cambio de
 * contraseña re-emite la cookie del dispositivo actual con la nueva huella.
 */
export async function createSession(user: { id: string; email: string }): Promise<void> {
  const payload: SessionData = {
    uid: user.id,
    email: user.email,
    pv: (await getUserAuthVersion(user.id)) ?? "",
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

    // Liga la sesión a la contraseña vigente: si cambió (o el usuario ya no
    // existe), la huella deja de coincidir y la sesión queda invalidada.
    const currentPv = await getUserAuthVersion(payload.uid);
    if (!currentPv || currentPv !== payload.pv) return null;

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
