/**
 * Normaliza y valida el dominio que el cliente quiere alojar (hosting).
 *
 * No se comprueba propiedad ni registro: el cliente apunta su DNS a nuestro
 * servidor después. Solo validamos la SINTAXIS para no mandar basura a cPanel.
 * Se aceptan sin protocolo ni `www.`; devuelve el dominio en minúsculas o
 * `null` si está vacío o no es válido (en cuyo caso se usa el dominio temporal).
 *
 * Sin dependencias de servidor: se usa en el cliente (validación previa) y en
 * las rutas de API (validación autoritativa).
 */

// Etiquetas de 1–63 chars (alfanumérico + guion, sin empezar/terminar en guion),
// al menos dos niveles y TLD de ≥2 letras. Total ≤253.
const DOMINIO_RE =
  /^(?=.{1,253}$)([a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?\.)+[a-z]{2,}$/;

export function normalizarDominioHost(raw: unknown): string | null {
  if (typeof raw !== "string") return null;
  let d = raw.trim().toLowerCase();
  if (!d) return null;
  d = d.replace(/^https?:\/\//, "").replace(/^www\./, "").replace(/\/.*$/, "").trim();
  if (!DOMINIO_RE.test(d)) return null;
  return d;
}
