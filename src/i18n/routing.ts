import { defineRouting } from "next-intl/routing";

/**
 * Configuración de idiomas del sitio.
 *
 * - `en` es el idioma por defecto y vive en la raíz (viahost.top/...).
 * - `es` y `fr` viven bajo prefijo (viahost.top/es/..., viahost.top/fr/...).
 *
 * `localePrefix: "as-needed"` => el idioma por defecto NO lleva prefijo, los
 * demás sí. Así la web en inglés queda igual que antes (sin romper enlaces).
 */
export const routing = defineRouting({
  locales: ["en", "es", "fr"],
  defaultLocale: "en",
  localePrefix: "as-needed",
  // La cookie de idioma solo viaja por HTTPS. No puede ser HttpOnly: next-intl
  // la sincroniza desde el navegador al cambiar de idioma con <Link>, y una
  // cookie HttpOnly no se puede reescribir desde JS. No guarda nada sensible.
  localeCookie: { secure: true, sameSite: "lax" },
});

export type Locale = (typeof routing.locales)[number];
