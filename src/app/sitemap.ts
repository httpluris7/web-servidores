import type { MetadataRoute } from "next";
import { site } from "@/data/site";
import { getCatalog } from "@/data/products";
import { routing } from "@/i18n/routing";
import { allPosts } from "@/data/blog";

/**
 * Sitemap con las páginas indexables y sus variantes por idioma (hreflang).
 *
 * Incluye todas las familias de producto (VPS, Hosting, Dominios, Dedicados si
 * están publicados) y declara para cada URL sus alternativas `en`/`es`/`fr`
 * (`localePrefix: as-needed`: el idioma por defecto va en la raíz).
 */
export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const base = site.url;
  const { regions, dedicatedTypes, hosting } = await getCatalog();

  const paths = [
    "",
    "/vps",
    ...(hosting && hosting.plans.length ? ["/hosting"] : []),
    "/dominios",
    ...(dedicatedTypes.length > 0 ? ["/dedicados"] : []),
    "/comparativas/alternativa-hetzner",
    "/comparativas/alternativa-contabo",
    "/comparativas/mejor-hosting-cpanel",
    "/blog",
    ...allPosts().map((p) => `/blog/${p.slug}`),
    "/red",
    "/proteccion-ddos",
    "/casos-de-uso",
    "/desplegar",
    "/soporte",
    "/contacto",
    "/estado",
    "/sobre-nosotros",
    "/legal/privacidad",
    "/legal/terminos",
    "/legal/cookies",
    ...regions.map((r) => `/vps/${r.slug}`),
    ...dedicatedTypes.map((d) => `/dedicados/${d.slug}`),
  ];

  const loc = (locale: string, p: string) =>
    locale === routing.defaultLocale ? `${base}${p}` : `${base}/${locale}${p}`;

  const money = new Set(["/vps", "/hosting", "/dominios"]);
  const now = new Date();

  return paths.map((p) => ({
    url: loc(routing.defaultLocale, p),
    lastModified: now,
    changeFrequency: p === "" ? "weekly" : "monthly",
    priority: p === "" ? 1 : money.has(p) ? 0.9 : 0.7,
    alternates: {
      languages: {
        ...Object.fromEntries(routing.locales.map((l) => [l, loc(l, p)])),
        "x-default": loc(routing.defaultLocale, p),
      },
    },
  }));
}
