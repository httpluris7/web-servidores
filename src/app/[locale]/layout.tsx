import type { Metadata, Viewport } from "next";
import { GeistSans } from "geist/font/sans";
import { GeistMono } from "geist/font/mono";
import { notFound } from "next/navigation";
import { hasLocale, NextIntlClientProvider } from "next-intl";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { routing, type Locale } from "@/i18n/routing";
import { site } from "@/data/site";
import { jsonLdScript } from "@/lib/utils";
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
    alternates: {
      canonical: locale === routing.defaultLocale ? "/" : `/${locale}`,
      languages: {
        en: "/",
        es: "/es",
        fr: "/fr",
        "x-default": "/",
      },
    },
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

  const organizationJsonLd = {
    "@context": "https://schema.org",
    "@type": "Organization",
    name: site.brand,
    legalName: site.legal.companyName,
    url: site.url,
    description: tMeta("description"),
    email: site.contact.support,
    sameAs: [site.social.x, site.social.github, site.social.linkedin],
    address: {
      "@type": "PostalAddress",
      streetAddress: site.legal.address,
      addressCountry: site.legal.addressCountry,
    },
  };

  return (
    <html lang={locale} className={`${GeistSans.variable} ${GeistMono.variable}`}>
      <body className="min-h-screen antialiased">
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: jsonLdScript(organizationJsonLd) }}
        />
        <a
          href="#contenido"
          className="sr-only focus:not-sr-only focus:fixed focus:left-4 focus:top-4 focus:z-[100] focus:rounded focus:bg-[var(--color-accent)] focus:px-4 focus:py-2 focus:text-sm focus:font-medium focus:text-black"
        >
          {t("skipToContent")}
        </a>
        <NextIntlClientProvider>
          <CartProvider>
            <Header />
            <main id="contenido">{children}</main>
            <Footer />
            <CookieBanner />
          </CartProvider>
        </NextIntlClientProvider>
      </body>
    </html>
  );
}
