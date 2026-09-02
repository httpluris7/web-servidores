import type { Metadata } from "next";
import { routing } from "@/i18n/routing";

/**
 * Construye `alternates` (canonical + hreflang) CORRECTOS para una ruta.
 *
 * El bug que corrige: el layout fijaba el canonical de TODAS las páginas al de
 * la home, así que buscadores y LLMs veían cada página de producto como un
 * duplicado de la portada. Aquí, cada página declara su propia ruta (sin prefijo
 * de idioma) y se derivan las URLs por idioma respetando `localePrefix: as-needed`
 * (el idioma por defecto —`en`— va en la raíz; `es`/`fr` con prefijo).
 *
 * `path` es la ruta lógica SIN idioma: "/", "/vps", "/vps/holanda", "/hosting"…
 * Devuelve rutas relativas; Next las resuelve contra `metadataBase`. Es puro
 * (sin cabeceras), así que no rompe el render estático (SSG) de las páginas.
 */
export function alternatesFor(locale: string, path: string): Metadata["alternates"] {
  // Normaliza: "" para la home; "/vps" sin barra final para el resto.
  const p = path === "/" ? "" : `/${path.replace(/^\/+|\/+$/g, "")}`;
  const url = (loc: string) => (loc === routing.defaultLocale ? p || "/" : `/${loc}${p}`);

  const languages: Record<string, string> = {};
  for (const loc of routing.locales) languages[loc] = url(loc);
  languages["x-default"] = url(routing.defaultLocale);

  return { canonical: url(locale), languages };
}
