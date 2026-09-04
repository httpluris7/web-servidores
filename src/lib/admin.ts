import { getSession, type SessionData } from "./session";
import { isMfaEnabled } from "./mfa";

/**
 * Autorización de administrador.
 *
 * No añadimos un campo `role` al usuario para no migrar el JSONL existente:
 * el conjunto de administradores se define por email en la variable de entorno
 * `ADMIN_EMAILS` (lista separada por comas). Así, marcar a alguien como admin
 * es cambiar una línea del `.env` y reiniciar — sin tocar datos.
 *
 *   ADMIN_EMAILS=administrador@cosmosdata.es,otro@ejemplo.com
 */

/** Conjunto de emails admin (normalizados a minúsculas) desde el entorno. */
function adminEmails(): Set<string> {
  return new Set(
    (process.env.ADMIN_EMAILS || "")
      .split(",")
      .map((s) => s.trim().toLowerCase())
      .filter(Boolean)
  );
}

/** ¿El email pertenece a un administrador? (case-insensitive) */
export function isAdminEmail(email: string): boolean {
  return adminEmails().has(email.trim().toLowerCase());
}

/**
 * Devuelve la sesión SOLO si es de un administrador CON el segundo factor
 * superado; en cualquier otro caso (anónimo, usuario normal, admin sin 2FA
 * dado de alta o con sesión sin código) devuelve null. Es el único guard que
 * necesitan tanto las páginas `/admin` como las rutas `/api/admin`.
 *
 * El 2FA es obligatorio para admins: un admin sin darlo de alta no puede usar
 * el panel ni su API hasta activarlo en /cuenta (el layout le redirige allí).
 */
export async function getAdminSession(): Promise<SessionData | null> {
  const session = await getSession();
  if (!session || !isAdminEmail(session.email)) return null;
  if (session.mfa !== true || !(await isMfaEnabled(session.uid))) return null;
  return session;
}

/** Estado del segundo factor de un admin, para que el layout decida a dónde mandarlo. */
export async function adminMfaOk(session: SessionData): Promise<boolean> {
  return session.mfa === true && (await isMfaEnabled(session.uid));
}
