/**
 * Cálculo del tráfico de un servidor en las últimas 24 h a partir de los
 * contadores acumulados del proveedor. Módulo puro (sin ficheros) para poder
 * probarlo.
 */

export type Lectura = { at: string; bytes: number };

/** Ventana que se conserva por servidor: 24 h más un margen para el barrido. */
export const VENTANA_MS = 26 * 3600_000;
/** Horas de historial mínimas antes de juzgar: con menos, el dato engaña. */
export const MINIMO_H = 12;

/** Añade una lectura y descarta las que ya no caben en la ventana. */
export function añadirLectura(lecturas: Lectura[], nueva: Lectura): Lectura[] {
  const limite = new Date(nueva.at).getTime() - VENTANA_MS;
  const vivas = lecturas.filter((l) => new Date(l.at).getTime() >= limite);
  // Un contador que baja es un reinicio del proveedor (reinstalación, migración):
  // lo anterior ya no es comparable y se tira.
  const ultima = vivas[vivas.length - 1];
  if (ultima && nueva.bytes < ultima.bytes) return [nueva];
  return [...vivas, nueva];
}

/**
 * Bytes transferidos en las últimas 24 h (o en todo el historial si es más
 * corto). `null` mientras no haya al menos {@link MINIMO_H} horas de datos.
 */
export function trafico24h(lecturas: Lectura[], ahora: Date): number | null {
  if (lecturas.length < 2) return null;
  const ultima = lecturas[lecturas.length - 1]!;
  const desde = ahora.getTime() - 24 * 3600_000;
  // La primera lectura dentro de la ventana de 24 h, o la anterior a ella si existe
  // (así el tramo cubre las 24 h completas en vez de quedarse corto).
  let base = lecturas[0]!;
  for (const l of lecturas) {
    if (new Date(l.at).getTime() <= desde) base = l;
    else break;
  }
  const horas = (new Date(ultima.at).getTime() - new Date(base.at).getTime()) / 3600_000;
  if (horas < MINIMO_H) return null;
  return Math.max(0, ultima.bytes - base.bytes);
}

export const GB = 1024 ** 3;
