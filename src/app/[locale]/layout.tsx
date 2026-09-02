import type { Metadata, Viewport } from "next";
import { GeistSans } from "geist/font/sans";
import { GeistMono } from "geist/font/mono";
import { notFound } from "next/navigation";
import { hasLocale, NextIntlClientProvider } from "next-intl";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { routing, type Locale } from "@/i18n/routing";
import { site } from "@/data/site";
import { getCartCatalog, getNavCatalog } from "@/data/products";
import { jsonLdScript } from "@/lib/utils";
import { CURRENCY_INIT_SCRIPT } from "@/lib/currency";
import { Header } from "@/components/layout/Header";
import { Footer } from "@/components/layout/Footer";
import { CookieBanner } from "@/components/layout/CookieBanner";
import { CartProvider } from "@/lib/cart";

type LayoutProps = {
  children: React.ReactNode;
  params: Promise<{ locale: string }>;
};

/** Prerenderiza una variante por idioma (en, es, fr). */
export function generateStaticParams() {
  return routing.locales.map((locale) => ({ locale }));
}

export const viewport: Viewport = {
  themeColor: "#05070d",
  colorScheme: "dark",
};

export async function generateMetadata({ params }: { params: Promise<{ locale: string }> }): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "meta" });
  const tagline = t("tagline");
  const description = t("description");

  return {
    metadataBase: new URL(site.url),
    title: {
      default: `${site.brand} — ${tagline}`,
      template: `%s · ${site.brand}`,
    },
    description,
    applicationName: site.brand,
    authors: [{ name: site.brand }],
    // OJO: el canonical/hreflang NO se fija aquí. Si se pusiera en el layout se
    // heredaría en TODAS las páginas apuntando a la home (era el bug). Cada
    // página declara su propia ruta con `alternatesFor(locale, path)` (ver
    // `src/lib/seo.ts`); la home lo hace en su propio `generateMetadata`.
    openGraph: {
      type: "website",
      locale: locale === "es" ? "es_ES" : locale === "fr" ? "fr_FR" : "en_US",
      url: site.url,
      siteName: site.brand,
      title: `${site.brand} — ${tagline}`,
      description,
      images: [{ url: "/og.svg", width: 1200, height: 630, alt: site.brand }],
    },
    twitter: {
      card: "summary_large_image",
      title: `${site.brand} — ${tagline}`,
      description,
      images: ["/og.svg"],
    },
    robots: { index: true, follow: true },
    icons: { icon: "/favicon.svg" },
  };
}

export default async function LocaleLayout({ children, params }: LayoutProps) {
  const { locale } = await params;
  if (!hasLocale(routing.locales, locale)) notFound();

  // Habilita el render estático con el idioma activo.
  setRequestLocale(locale as Locale);

  const t = await getTranslations({ locale, namespace: "common" });
  const tMeta = await getTranslations({ locale, namespace: "meta" });

  // El catálogo se edita en caliente desde /admin/catalogo y vive en disco, así
  // que se lee aquí y baja como prop a lo que se pinta en cliente.
  const nav = await getNavCatalog(locale);
  const cartCatalog = await getCartCatalog(locale);

  // Grafo de entidad: Organization + WebSite enlazados por @id. Sin `sameAs`
  // (los perfiles sociales aún no son reales: enlazarlos sería una señal de
  // entidad falsa) y sin SearchAction (no hay buscador general del sitio; el
  // buscador de /dominios es específico de producto). Añadir cuando existan.
  const orgId = `${site.url}/#organization`;
  const jsonLdGraph = {
    "@context": "https://schema.org",
    "@graph": [
      {
        "@type": "Organization",
        "@id": orgId,
        name: site.brand,
        legalName: site.legal.companyName,
        url: site.url,
        description: tMeta("description"),
        email: site.contact.support,
        logo: `${site.url}/favicon.svg`,
        areaServed: "Europe",
        contactPoint: {
          "@type": "ContactPoint",
          contactType: "customer support",
          email: site.contact.support,
          availableLanguage: ["es", "en", "fr"],
        },
        address: {
          "@type": "PostalAddress",
          streetAddress: site.legal.address,
          addressCountry: site.legal.addressCountry,
        },
      },
      {
        "@type": "WebSite",
        "@id": `${site.url}/#website`,
        name: site.brand,
        url: site.url,
        inLanguage: locale,
        publisher: { "@id": orgId },
      },
    ],
  };

  return (
    <html lang={locale} className={`${GeistSans.variable} ${GeistMono.variable}`}>
      <body className="min-h-screen antialiased">
        {/* Fija la divisa elegida antes del primer pintado (sin parpadeo de precios). */}
        <script dangerouslySetInnerHTML={{ __html: CURRENCY_INIT_SCRIPT }} />
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: jsonLdScript(jsonLdGraph) }}
        />
        <a
          href="#contenido"
          className="sr-only focus:not-sr-only focus:fixed focus:left-4 focus:top-4 focus:z-[100] focus:rounded focus:bg-[var(--color-accent)] focus:px-4 focus:py-2 focus:text-sm focus:font-medium focus:text-black"
        >
          {t("skipToContent")}
        </a>
        <NextIntlClientProvider>
          <CartProvider catalog={cartCatalog}>
            <Header nav={nav} />
            <main id="contenido">{children}</main>
            <Footer nav={nav} />
            <CookieBanner />
          </CartProvider>
        </NextIntlClientProvider>
      </body>
    </html>
  );
}
