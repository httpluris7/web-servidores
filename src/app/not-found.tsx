import Link from "next/link";
import { GeistSans } from "geist/font/sans";
import { GeistMono } from "geist/font/mono";

/**
 * 404 global (fuera del segmento [locale]). Solo se alcanza para rutas que no
 * encajan en ningún idioma; el 404 localizado y con chrome vive en
 * `app/[locale]/not-found.tsx`. Como el layout raíz es passthrough, aquí
 * aportamos nuestro propio <html>/<body>.
 */
export default function GlobalNotFound() {
  return (
    <html lang="en" className={`${GeistSans.variable} ${GeistMono.variable}`}>
      <body className="grid min-h-screen place-items-center bg-[var(--color-bg-base)] antialiased">
        <main className="px-6 text-center">
          <p className="font-mono text-sm text-[var(--color-accent)]">404</p>
          <h1 className="mt-3 text-2xl font-semibold tracking-tight text-[var(--color-fg)]">
            Page not found
          </h1>
          <p className="mt-2 text-sm text-[var(--color-fg-muted)]">
            The page you are looking for does not exist.
          </p>
          <Link
            href="/"
            className="mt-6 inline-flex rounded-[var(--radius-md)] bg-[var(--color-accent)] px-4 py-2 text-sm font-medium text-black"
          >
            Back to home
          </Link>
        </main>
      </body>
    </html>
  );
}
