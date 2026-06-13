import type { NextConfig } from "next";

/**
 * Cabeceras de seguridad aplicadas a todas las respuestas.
 *
 * No se incluye una CSP completa de `script-src` porque Next inyecta scripts
 * inline (bootstrap de hidratación, JSON-LD) y una política estricta sin nonces
 * rompería la app. Sí fijamos `frame-ancestors` (anti-clickjacking, clave en
 * login/checkout) más el resto de cabeceras estándar de endurecimiento.
 */
const securityHeaders = [
  // Anti-clickjacking (doble: cabecera legacy + CSP moderna).
  { key: "X-Frame-Options", value: "DENY" },
  { key: "Content-Security-Policy", value: "frame-ancestors 'none'" },
  // Evita el MIME-sniffing.
  { key: "X-Content-Type-Options", value: "nosniff" },
  // No filtrar la URL completa como referer a otros orígenes.
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  // Desactiva APIs sensibles del navegador que la web no usa.
  { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=(), browsing-topics=()" },
  // Fuerza HTTPS en este host durante 1 año (sin includeSubDomains/preload para
  // no comprometer subdominios como panel./mail. que se gestionan aparte).
  { key: "Strict-Transport-Security", value: "max-age=31536000" },
];

const nextConfig: NextConfig = {
  reactStrictMode: true,
  poweredByHeader: false,
  images: {
    formats: ["image/avif", "image/webp"],
  },
  async headers() {
    return [{ source: "/:path*", headers: securityHeaders }];
  },
};

export default nextConfig;
