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
});

export type Locale = (typeof routing.locales)[number];
