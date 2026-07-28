/**
 * Divisa de visualización (EUR / USD).
 *
 * El catálogo, los pedidos y las facturas están SIEMPRE en euros: el dólar es
 * solo una vista de cortesía para el visitante internacional. Por eso la
 * conversión es unidireccional (EUR → USD) y nunca vuelve al servidor.
 *
 * Cómo se muestra sin parpadeo: cada importe se renderiza DOS veces en el HTML
 * (ver `components/ui/Price.tsx`) y el CSS oculta el que no toca según el
 * atributo `data-currency` del <html>. Así las páginas siguen siendo estáticas,
 * no hay mismatch de hidratación y el cambio de divisa es instantáneo (sin
 * navegación ni re-render del servidor).
 */

export const CURRENCIES = ["eur", "usd"] as const;
export type Currency = (typeof CURRENCIES)[number];

export const DEFAULT_CURRENCY: Currency = "eur";

/** Clave de localStorage y atributo del <html> que fijan la divisa activa. */
export const CURRENCY_STORAGE_KEY = "vh_currency";
export const CURRENCY_ATTR = "data-currency";

/**
 * Tipo de cambio EUR → USD aplicado a los precios mostrados.
 *
 * Es un valor FIJO y editable a propósito (no consultamos ninguna API): así el
 * precio en dólares es estable, reproducible en el build y nunca depende de un
 * servicio externo. Revísalo cuando el cambio se mueva de forma apreciable.
 * Se puede sobreescribir sin tocar código con `NEXT_PUBLIC_EUR_USD_RATE`.
 */
export const EUR_USD_RATE = ((): number => {
  const raw = Number(process.env.NEXT_PUBLIC_EUR_USD_RATE);
  return Number.isFinite(raw) && raw > 0 ? raw : 1.18;
})();

/**
 * Convierte euros a dólares redondeando SIEMPRE al alza a entero.
 *
 * El `toFixed(4)` previo evita que la aritmética en coma flotante dispare el
 * redondeo: 150 × 1.18 = 177.00000000000003, y sin él `Math.ceil` daría 178.
 */
export function toUsd(eurValue: number): number {
  return Math.ceil(Number((eurValue * EUR_USD_RATE).toFixed(4)));
}

const usdFormat = new Intl.NumberFormat("en-US", {
  style: "currency",
  currency: "USD",
  minimumFractionDigits: 0,
  maximumFractionDigits: 0,
});

/** Formatea un importe en dólares, sin decimales (p. ej. "$10"). */
export function usd(eurValue: number): string {
  return usdFormat.format(toUsd(eurValue));
}

/**
 * Total en dólares de varias líneas, sumando los importes YA redondeados.
 *
 * No es lo mismo que `usd(suma)`: al redondear al alza cada línea por separado,
 * convertir el total daría un número menor que la suma de lo que ve el cliente
 * (dos líneas de 8 € se muestran como $10 + $10, pero 16 € convertidos son $19).
 * Sumando los redondeos, el desglose siempre cuadra con el total.
 */
export function usdSum(eurValues: number[]): string {
  return usdFormat.format(eurValues.reduce((acc, v) => acc + toUsd(v), 0));
}

/** Normaliza un valor cualquiera a una divisa soportada. */
export function parseCurrency(value: unknown): Currency | null {
  return typeof value === "string" && (CURRENCIES as readonly string[]).includes(value)
    ? (value as Currency)
    : null;
}

/**
 * Script que fija la divisa en el <html> ANTES del primer pintado.
 *
 * Va inline como primer hijo del <body>: se ejecuta de forma síncrona mientras
 * el navegador aún está parseando el documento, así que quien tenga USD guardado
 * nunca llega a ver los precios en euros.
 */
export const CURRENCY_INIT_SCRIPT = `try{var c=localStorage.getItem(${JSON.stringify(
  CURRENCY_STORAGE_KEY
)});if(c==="usd"||c==="eur")document.documentElement.setAttribute(${JSON.stringify(
  CURRENCY_ATTR
)},c)}catch(e){}`;
