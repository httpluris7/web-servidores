import type { Metadata } from "next";
import { routing } from "@/i18n/routing";
import { site } from "@/data/site";

/** Ruta localizada (respeta `as-needed`): "/vps" → "/vps" (en) o "/es/vps" (es). */
function localizedPath(locale: string, path: string): string {
  if (path === "/") return locale === routing.defaultLocale ? "/" : `/${locale}`;
  return locale === routing.defaultLocale ? path : `/${locale}${path}`;
}

const HOME_LABEL: Record<string, string> = { es: "Inicio", fr: "Accueil", en: "Home" };

/**
 * Construye el JSON-LD de `BreadcrumbList`. Se antepone "Inicio" automáticamente;
 * `trail` son los niveles siguientes con su ruta LÓGICA (sin idioma): las URLs
 * finales se localizan al idioma activo.
 */
export function breadcrumbJsonLd(locale: string, trail: { name: string; path: string }[]) {
  const items = [{ name: HOME_LABEL[locale] ?? "Home", path: "/" }, ...trail];
  return {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: items.map((it, i) => ({
      "@type": "ListItem",
      position: i + 1,
      name: it.name,
      item: `${site.url}${localizedPath(locale, it.path)}`,
    })),
  };
}

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
