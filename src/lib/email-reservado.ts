/**
 * Direcciones que NUNCA pueden usarse para registrarse como cliente (vuln-0006).
 *
 * Nadie ajeno a ViaHost tiene buzón en viahost.top, así que cualquier alta con
 * ese dominio —o un subdominio (cp., mail., panel.…)— es un intento de hacerse
 * pasar por el equipo: admin@, soporte@, billing@, abuse@, postmaster@… Se
 * bloquea el dominio entero, con cualquier parte local, caja o etiqueta `+x`.
 *
 * En dominios ajenos, `admin@empresa-cliente.com` es un correo de empresa
 * legítimo y NO se toca.
 *
 * Sin dependencias de Node: se puede usar desde el cliente y desde las rutas.
 */

const DOMINIOS_RESERVADOS = ["viahost.top"];

/** ¿El dominio es el propio o un subdominio suyo? */
export function esDominioReservado(dominio: string): boolean {
  const d = dominio.trim().toLowerCase().replace(/\.$/, "");
  return DOMINIOS_RESERVADOS.some((r) => d === r || d.endsWith(`.${r}`));
}

/** true si el email no puede registrarse (buzón del dominio propio). */
export function esEmailReservado(email: string): boolean {
  const e = email.trim().toLowerCase();
  const at = e.lastIndexOf("@");
  if (at <= 0 || at === e.length - 1) return false;
  return esDominioReservado(e.slice(at + 1));
}
