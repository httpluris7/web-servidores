import type { NextConfig } from "next";
import createNextIntlPlugin from "next-intl/plugin";
import { execSync } from "node:child_process";
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";

const withNextIntl = createNextIntlPlugin();

/**
 * Identificador del despliegue (protección contra desfase de versiones).
 *
 * Next lo añade a las URLs de los assets (`?dpl=`) y lo manda en cada petición
 * RSC / server action. Si un navegador tiene abierta una pestaña con el bundle
 * de un deploy anterior, el servidor detecta el desfase y el cliente recarga la
 * página entera en vez de fallar ("Failed to find Server Action", botones que
 * "desaparecen"). Incidente 2026-09-04 con el alta del 2FA en /cuenta.
 *
 * DEBE ser idéntico en `next build` y en `next start`: por eso se lee de un
 * fichero (`.deployment-id`, lo escribe scripts/deploy.sh antes del build) y
 * no de la hora. Sin fichero se usa el commit de git; sin git, un valor fijo.
 */
function deploymentId(): string {
  const f = join(process.cwd(), ".deployment-id");
  if (existsSync(f)) {
    const v = readFileSync(f, "utf8").trim();
    if (v) return v;
  }
  try {
    return execSync("git rev-parse --short HEAD", { stdio: ["ignore", "pipe", "ignore"] }).toString().trim();
  } catch {
    return "local";
  }
}

/**
 * Cabeceras de seguridad aplicadas a todas las respuestas, incluida una CSP
 * bloqueante (ver más abajo). `script-src` lleva 'unsafe-inline' porque Next
 * inyecta scripts inline (bootstrap de hidratación, JSON-LD) sin nonces; una
 * política con nonces exigiría middleware por petición y es un paso posterior.
 */
const securityHeaders = [
  // Anti-clickjacking legacy (la CSP de abajo lleva además frame-ancestors 'none').
  { key: "X-Frame-Options", value: "DENY" },
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
  // CSP estricta BLOQUEANTE (promovida de Report-Only el 2026-09-05 tras un
  // rastreo con Chromium de todas las rutas públicas, del área de cliente y del
  // admin sin una sola violación reportada). Contempla:
  //  - Stripe Checkout (js/api/hooks.stripe.com) por si se embebe en el futuro;
  //    hoy el pago redirige a la página alojada de Stripe (no lo afecta la CSP).
  //  - Cloudflare: Bot Fight Mode / Managed Challenge / Turnstile inyectan
  //    scripts e iframes desde challenges.cloudflare.com (los de /cdn-cgi/ son
  //    del mismo origen y ya entran por 'self').
  //  - La consola noVNC del panel abre un websocket contra el propio host
  //    (`/console-ws`); Safari no siempre cubre wss: con 'self', por eso va explícito.
  //  - En desarrollo (`next dev`) React Refresh necesita 'unsafe-eval'.
  // 'unsafe-inline' sigue siendo necesario: Next inyecta scripts inline sin nonce.
  {
    key: "Content-Security-Policy",
    value: [
      "default-src 'self'",
      "base-uri 'self'",
      "object-src 'none'",
      "frame-ancestors 'none'",
      "img-src 'self' data: https:",
      "font-src 'self' data:",
      "style-src 'self' 'unsafe-inline'",
      `script-src 'self' 'unsafe-inline'${process.env.NODE_ENV === "production" ? "" : " 'unsafe-eval'"} https://js.stripe.com https://challenges.cloudflare.com`,
      "connect-src 'self' wss://viahost.top wss://*.viahost.top https://api.stripe.com https://challenges.cloudflare.com",
      "frame-src https://js.stripe.com https://hooks.stripe.com https://challenges.cloudflare.com",
      "form-action 'self'",
    ].join("; "),
  },
];

const nextConfig: NextConfig = {
  reactStrictMode: true,
  poweredByHeader: false,
  deploymentId: deploymentId(),
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
