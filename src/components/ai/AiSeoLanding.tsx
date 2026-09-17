import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { getTranslations } from "next-intl/server";
import { getAiVpsLine } from "@/data/products";
import { site } from "@/data/site";
import { eurPrecio, precioDesde } from "@/lib/utils";
import { alternatesFor, breadcrumbJsonLd } from "@/lib/seo";
import { JsonLd } from "@/components/seo/JsonLd";
import { PageHero } from "@/components/ui/PageHero";
import { Price } from "@/components/ui/Price";
import { Cta } from "@/components/ui/Cta";
import { FaqSection } from "@/components/ui/FaqSection";
import { AiPlans } from "./AiPlans";
import { AiBadges, AiCrossLinks, AiCta, AiDisclaimer, AiHow, AiWhich, AiWhy } from "./AiSections";

/**
 * Landings SEO de la familia AI Developer VPS: `/claude-code-vps` y `/codex-vps`.
 *
 * Venden los MISMOS planes que `/ai-developer-vps`, pero cada una responde a una
 * búsqueda distinta ("VPS para Claude Code" / "VPS para Codex") con su propio
 * hero, argumentos, pasos de inicio de sesión y FAQ (`ai.claude` / `ai.codex`).
 * Lo común (planes, aviso de suscripciones, CTA) se comparte; el grueso de la
 * landing principal (beneficios, software, infraestructura, entrega) NO se
 * repite aquí: se enlaza. Así las tres se refuerzan sin ser contenido duplicado.
 */

export type AiSeoNs = "claude" | "codex";

const CONFIG: Record<AiSeoNs, { path: string; keywords: string[]; faq: number }> = {
  claude: {
    path: "/claude-code-vps",
    faq: 7,
    keywords: [
      "Claude Code VPS",
      "Claude VPS",
      "VPS for Claude Code",
      "Claude Code Hosting",
      "servidor Claude Code",
      "VPS para Claude Code",
      "Claude Code 24/7",
    ],
  },
  codex: {
    path: "/codex-vps",
    faq: 7,
    keywords: [
      "Codex VPS",
      "OpenAI Codex VPS",
      "Codex CLI Hosting",
      "VPS for Codex",
      "servidor para Codex",
      "VPS para Codex",
      "Codex 24/7",
    ],
  },
};

export async function aiSeoMetadata(ns: AiSeoNs, locale: string): Promise<Metadata> {
  const line = await getAiVpsLine(locale);
  if (!line || line.plans.length === 0) return {};
  const t = await getTranslations({ locale, namespace: `ai.${ns}` });
  return {
    alternates: alternatesFor(locale, CONFIG[ns].path),
    title: t("metaTitle"),
    description: t("metaDescription", { price: eurPrecio(precioDesde(line.plans)) }),
    keywords: CONFIG[ns].keywords,
  };
}

export async function AiSeoLanding({ ns, locale }: { ns: AiSeoNs; locale: string }) {
  const line = await getAiVpsLine(locale);
  if (!line || line.plans.length === 0) notFound();

  const t = await getTranslations(`ai.${ns}`);
  const tc = await getTranslations("ai.common");
  const { path, faq } = CONFIG[ns];
  const from = precioDesde(line.plans);

  // Servicio (no un segundo `Product` con las mismas ofertas que la landing
  // principal): describe el caso de uso y remite a la familia para los precios.
  const serviceJsonLd = {
    "@context": "https://schema.org",
    "@type": "Service",
    name: t("metaTitle"),
    description: t("metaDescription", { price: eurPrecio(from) }),
    serviceType: t("kicker"),
    provider: { "@type": "Organization", name: site.brand, url: site.url },
    areaServed: "Worldwide",
    offers: {
      "@type": "AggregateOffer",
      priceCurrency: "EUR",
      lowPrice: from,
      highPrice: Math.max(...line.plans.map((p) => p.price)),
      offerCount: line.plans.length,
      url: `${site.url}/ai-developer-vps`,
    },
  };

  return (
    <>
      <JsonLd data={serviceJsonLd} />
      <JsonLd
        data={breadcrumbJsonLd(locale, [
          { name: line.title, path: "/ai-developer-vps" },
          { name: t("kicker"), path },
        ])}
      />

      <PageHero
        index="/ AI VPS"
        kicker={t("kicker")}
        title={
          <>
            {t("titleA")}
            <span className="text-accent">{t("titleB")}</span>
          </>
        }
        description={t("description")}
      >
        <div className="flex flex-wrap items-center gap-x-6 gap-y-4">
          <Cta href="#planes">{t("cta")} →</Cta>
          <div>
            <span className="font-mono text-2xl font-semibold tracking-tight">
              <span className="mr-1.5 text-sm font-normal text-[var(--color-fg-muted)]">{tc("from")}</span>
              <Price value={from} />
              <span className="text-sm font-normal text-[var(--color-fg-muted)]">{tc("perMonth")}</span>
            </span>
            <span className="mt-0.5 block font-mono text-xs text-[var(--color-fg-muted)]">{tc("heroBilling")}</span>
          </div>
        </div>
        <AiBadges className="mt-8" />
      </PageHero>

      <AiWhy ns={ns} index="/01" />
      <AiHow ns={ns} index="/02" />
      <AiPlans plans={line.plans} index="/03" />
      <AiWhich ns={ns} />
      <AiDisclaimer />
      <FaqSection
        items={Array.from({ length: faq }, () => ({ q: "", a: "" }))}
        tKey="faq"
        namespace={`ai.${ns}`}
        index="/04"
      />
      <AiCrossLinks current={ns} />
      <AiCta href="#planes" />
    </>
  );
}
