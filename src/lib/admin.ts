import { getSession, type SessionData } from "./session";

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
 * Devuelve la sesión SOLO si es de un administrador; en cualquier otro caso
 * (anónimo o usuario normal) devuelve null. Es el único guard que necesitan
 * tanto las páginas `/admin` como las rutas `/api/admin`.
 */
export async function getAdminSession(): Promise<SessionData | null> {
  const session = await getSession();
  if (!session || !isAdminEmail(session.email)) return null;
  return session;
}
