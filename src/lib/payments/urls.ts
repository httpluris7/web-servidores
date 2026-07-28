import { site } from "@/data/site";
import { routing } from "@/i18n/routing";

/**
 * URLs de vuelta desde la pasarela.
 *
 * Stripe necesita URLs absolutas y las abre en el navegador del cliente, así
 * que deben respetar su idioma: `localePrefix: "as-needed"` significa que el
 * idioma por defecto va sin prefijo y los demás con él (ver `i18n/routing.ts`).
 */

/** Ruta absoluta del sitio en el idioma dado. */
export function localizedUrl(path: string, locale?: string): string {
  const known = routing.locales.includes((locale ?? "") as (typeof routing.locales)[number]);
  const prefix = known && locale !== routing.defaultLocale ? `/${locale}` : "";
  return `${site.url}${prefix}${path}`;
}

export type ReturnUrls = { successUrl: string; cancelUrl: string };

/**
 * A dónde vuelve el cliente tras pagar o tras desistir. El destino de éxito es
 * su área de cliente, donde ya tiene la factura; el de cancelación es la página
 * desde la que se inició el cobro, para que pueda reintentar sin perderse.
 */
export function returnUrls(locale: string | undefined, cancelPath = "/cuenta"): ReturnUrls {
  return {
    successUrl: `${localizedUrl("/cuenta", locale)}?pago=ok`,
    cancelUrl: `${localizedUrl(cancelPath, locale)}?pago=cancelado`,
  };
}
