import "server-only";
import { njallaHasCreds, readSettings } from "@/lib/ajustes";
import { findDomains } from "./njalla";
import { precioDominioEur } from "./precio";

/**
 * Tarifas por TLD para la rejilla "Cuánto cuesta un dominio" de la página pública.
 *
 * Njalla no da precio de renovación aparte: su precio es PLANO (alta = renovación),
 * así que ambos coinciden. Se leen los precios de una tanda de `find-domains`
 * (una llamada trae todos los TLDs) y se les aplica el margen. Con caché en memoria
 * (los precios cambian poco) para no llamar a Njalla en cada carga.
 */

/** TLDs que se muestran en la rejilla, en orden. */
const TLDS = ["com", "es", "org", "net", "info", "eu", "io", "dev", "app", "online", "shop", "xyz"];

export type TarifaTld = {
  tld: string;
  /** Precio al cliente en EUR/año (alta = renovación en Njalla). */
  precioEur: number;
};

const CACHE_MS = 10 * 60_000;
let cache: { at: number; tarifas: TarifaTld[] } | null = null;

export async function tarifasPopulares(): Promise<TarifaTld[]> {
  const { njalla } = await readSettings();
  if (!njallaHasCreds(njalla)) return [];

  if (cache && Date.now() - cache.at < CACHE_MS) return cache.tarifas;

  try {
    // Un término cualquiera: find-domains devuelve el precio de cada TLD. Timeout
    // holgado (server-side y cacheado) para que no falle en arranque frío.
    const ofertas = await findDomains("viahost", 30_000);
    const precioPorTld = new Map<string, number>();
    for (const o of ofertas) {
      if (o.price == null) continue;
      const tld = o.name.includes(".") ? o.name.slice(o.name.indexOf(".") + 1) : "";
      if (tld && !precioPorTld.has(tld)) precioPorTld.set(tld, o.price);
    }

    const tarifas: TarifaTld[] = [];
    for (const tld of TLDS) {
      const coste = precioPorTld.get(tld);
      if (coste == null) continue;
      tarifas.push({ tld, precioEur: precioDominioEur(coste, njalla.margenPct) });
    }
    if (tarifas.length > 0) cache = { at: Date.now(), tarifas };
    return tarifas;
  } catch {
    // Best-effort: si Njalla no responde, la rejilla no se muestra (la búsqueda sí).
    return cache?.tarifas ?? [];
  }
}
