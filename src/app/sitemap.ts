import type { MetadataRoute } from "next";
import { site } from "@/data/site";
import { regions, dedicatedTypes } from "@/data/products";

export default function sitemap(): MetadataRoute.Sitemap {
  const base = site.url;
  const staticRoutes = [
    "",
    "/vps",
    "/dedicados",
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
  ];

  const dynamicRoutes = [
    ...regions.map((r) => `/vps/${r.slug}`),
    ...dedicatedTypes.map((d) => `/dedicados/${d.slug}`),
  ];

  return [...staticRoutes, ...dynamicRoutes].map((path) => ({
    url: `${base}${path}`,
    changeFrequency: path === "" ? "weekly" : "monthly",
    priority: path === "" ? 1 : 0.7,
  }));
}
