import type { MetadataRoute } from "next";
import { site } from "@/data/site";

/**
 * robots.txt
 *
 * - Permite el rastreo general y **explícitamente** a los bots de buscadores
 *   generativos (GEO): que ChatGPT, Gemini, Perplexity, Claude, etc. puedan
 *   leer y citar el sitio.
 * - Bloquea las áreas privadas/transaccionales (aunque ya son `noindex`) para
 *   no gastar crawl-budget ni exponer rutas de cuenta/panel/API.
 */

// Áreas que ningún bot debe rastrear (privadas o sin valor de indexación).
const DISALLOW = [
  "/admin",
  "/cuenta",
  "/carrito",
  "/acceder",
  "/registro",
  "/recuperar",
  "/restablecer",
  "/entrega",
  "/panel",
  "/api/",
];

// Bots de IA/búsqueda generativa que queremos que nos lean y citen.
const AI_BOTS = [
  "GPTBot",
  "OAI-SearchBot",
  "ChatGPT-User",
  "Google-Extended",
  "PerplexityBot",
  "ClaudeBot",
  "Claude-Web",
  "Applebot-Extended",
  "Bingbot",
  "Amazonbot",
  "CCBot",
];

export default function robots(): MetadataRoute.Robots {
  return {
    rules: [
      { userAgent: "*", allow: "/", disallow: DISALLOW },
      ...AI_BOTS.map((userAgent) => ({ userAgent, allow: "/", disallow: DISALLOW })),
    ],
    sitemap: `${site.url}/sitemap.xml`,
    host: site.url,
  };
}
