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
 * Serializa un objeto para incrustarlo como JSON-LD dentro de un <script>.
 * Escapa los caracteres que permitirían romper la etiqueta (`</script>`) o
 * inyectar HTML, además de los separadores de línea U+2028/U+2029 (válidos en
 * JSON pero ilegales en JS). Hoy los datos son estáticos, pero esto evita un
 * XSS si en el futuro entra contenido dinámico en el structured data.
 */
export function jsonLdScript(data: unknown): string {
  return JSON.stringify(data)
    .replace(/</g, "\\u003c")
    .replace(/>/g, "\\u003e")
    .replace(/&/g, "\\u0026")
    .replace(/\u2028/g, "\\u2028")
    .replace(/\u2029/g, "\\u2029");
}

/**
 * Devuelve `next` si es una ruta interna segura (empieza por "/" pero no por
 * "//", que sería protocol-relative hacia otro host). En caso contrario, null.
 * Evita open-redirects al usar `?next=` para volver tras registro/login.
 */
export function safeInternalPath(next: unknown): string | null {
  if (typeof next !== "string" || next.length === 0 || next.length > 2048) return null;
  // Solo rutas relativas al propio origen: deben empezar por "/" y no por "//"
  // (protocol-relative) ni "/\" (los navegadores normalizan "\" a "/", así
  // que "/\evil.com" acabaría en "//evil.com"). Fuera también cualquier "\",
  // caracteres de control o espacios en blanco, y esquemas incrustados.
  if (!next.startsWith("/") || next.startsWith("//") || next.startsWith("/\\")) return null;
  if (/[\\\u0000-\u001f\u007f\s]/.test(next)) return null;
  if (/^\/+[a-z][a-z0-9+.-]*:/i.test(next)) return null;
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

/**
 * Precio "desde" de una lista de planes. El catálogo es editable desde el
 * panel, así que una línea puede quedarse sin planes visibles: `Math.min()` de
 * un array vacío devuelve `Infinity` y pintaría "€∞" en el escaparate.
 */
export function precioDesde(planes: { price: number }[]): number {
  if (planes.length === 0) return 0;
  return Math.min(...planes.map((p) => p.price));
}

/**
 * Importe de escaparate: entero cuando el precio es redondo —que es lo normal
 * en el catálogo— y con céntimos cuando los tiene. El panel permite guardar
 * 9,99 y pintar "€10" en la tarjeta del plan sería mentir sobre el precio.
 */
export function eurPrecio(value: number): string {
  return eur(value, Number.isInteger(value) ? 0 : 2);
}
