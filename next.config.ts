import type { NextConfig } from "next";
import createNextIntlPlugin from "next-intl/plugin";

const withNextIntl = createNextIntlPlugin();

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
  // Fuerza HTTPS durante 1 año en el dominio y TODOS sus subdominios (mail.,
  // panel., web01., *.cp. sirven ya HTTPS; nginx manda la misma cabecera en
  // mail. y panel.). `preload` deja el dominio listo para hstspreload.org
  // (la inclusión en la lista es un paso aparte y voluntario). Auditoría 3-02.
  { key: "Strict-Transport-Security", value: "max-age=31536000; includeSubDomains; preload" },
  // CSP estricta en modo SOLO-REPORTE: no bloquea, registra violaciones en la
  // consola del navegador. Contempla Stripe. Tras validarla (y añadir lo que
  // reporte Cloudflare/Bot Fight), promoverla a "Content-Security-Policy".
  {
    key: "Content-Security-Policy-Report-Only",
    value: [
      "default-src 'self'",
      "base-uri 'self'",
      "object-src 'none'",
      "frame-ancestors 'none'",
      "img-src 'self' data: https:",
      "font-src 'self' data:",
      "style-src 'self' 'unsafe-inline'",
      "script-src 'self' 'unsafe-inline' https://js.stripe.com",
      "connect-src 'self' https://api.stripe.com",
      "frame-src https://js.stripe.com https://hooks.stripe.com",
      "form-action 'self'",
    ].join("; "),
  },
];

const nextConfig: NextConfig = {
  reactStrictMode: true,
  poweredByHeader: false,
  // pdfkit carga sus fuentes .afm desde node_modules en runtime; marcándolo como
  // externo evitamos que el bundler lo empaquete y rompa esas rutas de datos.
  serverExternalPackages: ["pdfkit"],
  // noVNC se distribuye como ESM sin transpilar; Next debe procesarlo para el
  // bundle del cliente (consola del panel).
  transpilePackages: ["@novnc/novnc"],
  images: {
    formats: ["image/avif", "image/webp"],
  },
  async headers() {
    return [{ source: "/:path*", headers: securityHeaders }];
  },
};

export default withNextIntl(nextConfig);
