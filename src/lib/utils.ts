/** Une clases condicionalmente sin dependencias externas. */
export function cn(...classes: Array<string | false | null | undefined>): string {
  return classes.filter(Boolean).join(" ");
}

/** Formatea un precio en euros con el estilo es-ES (sin decimales por defecto). */
export function eur(value: number, decimals = 0): string {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "EUR",
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  }).format(value);
}

/**
 * Devuelve `next` si es una ruta interna segura (empieza por "/" pero no por
 * "//", que sería protocol-relative hacia otro host). En caso contrario, null.
 * Evita open-redirects al usar `?next=` para volver tras registro/login.
 */
export function safeInternalPath(next: unknown): string | null {
  if (typeof next !== "string") return null;
  if (!next.startsWith("/") || next.startsWith("//")) return null;
  return next;
}

/** Formatea una fecha ISO al estilo es-ES (dd/mm/aaaa). Devuelve "—" si no es válida. */
export function fmtDate(iso: string | null | undefined, withTime = false): string {
  if (!iso) return "—";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "—";
  return d.toLocaleDateString("en-US", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    ...(withTime ? { hour: "2-digit", minute: "2-digit" } : {}),
  });
}
