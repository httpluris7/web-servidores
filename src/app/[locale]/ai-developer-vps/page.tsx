import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { getAiVpsLine } from "@/data/products";
import { site } from "@/data/site";
import { eurPrecio, jsonLdScript, precioDesde } from "@/lib/utils";
import { alternatesFor, breadcrumbJsonLd } from "@/lib/seo";
import { JsonLd } from "@/components/seo/JsonLd";
import { Price } from "@/components/ui/Price";
import { Cta } from "@/components/ui/Cta";
import { Reveal } from "@/components/ui/Reveal";
import { SectionHeader } from "@/components/ui/SectionHeader";
import { FaqSection } from "@/components/ui/FaqSection";
import { AiPlans } from "@/components/ai/AiPlans";
import {
  AiBadges,
  AiBenefits,
  AiCrossLinks,
  AiCta,
  AiDelivery,
  AiDisclaimer,
  AiInfra,
  AiStack,
  AiSteps,
  AiTerminal,
  AiUseCases,
} from "@/components/ai/AiSections";

/** El catálogo se edita en caliente desde el panel: nada de congelarlo en el build. */
export const dynamic = "force-dynamic";

const PATH = "/ai-developer-vps";
/** Las preguntas viven en `ai.main.faq`; aquí solo hace falta cuántas son. */
const FAQ = Array.from({ length: 8 }, () => ({ q: "", a: "" }));

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>;
}): Promise<Metadata> {
  const { locale } = await params;
  const line = await getAiVpsLine(locale);
  if (!line || line.plans.length === 0) return {};
  const t = await getTranslations({ locale, namespace: "ai.main" });
  return {
    alternates: alternatesFor(locale, PATH),
    title: t("metaTitle"),
    description: t("metaDescription", { price: eurPrecio(precioDesde(line.plans)) }),
    keywords: [
      "AI Developer VPS",
      "AI Coding VPS",
      "Claude Code VPS",
      "Codex VPS",
      "VPS programación IA",
      "servidor programación IA",
      "remote development VPS",
      "Claude Code 24/7",
      "Codex 24/7",
    ],
  };
}

export default async function AiDeveloperVpsPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);
  const line = await getAiVpsLine(locale);
  // Sin planes publicados no hay escaparate: 404 hasta que se publique la familia.
  if (!line || line.plans.length === 0) notFound();

  const t = await getTranslations("ai.main");
  const tc = await getTranslations("ai.common");
  const from = precioDesde(line.plans);

  const productJsonLd = {
    "@context": "https://schema.org",
    "@type": "Product",
    name: `${site.brand} ${line.title}`,
    description: line.tagline,
    category: "Virtual private server for AI-assisted software development",
    brand: { "@type": "Brand", name: site.brand },
    offers: line.plans.map((p) => ({
      "@type": "Offer",
      name: p.name,
      price: p.price,
      priceCurrency: "EUR",
      url: `${site.url}${p.orderUrl}`,
      availability: "https://schema.org/InStock",
      // Precio mensual real: sin promociones ligadas a contratos largos.
      priceSpecification: {
        "@type": "UnitPriceSpecification",
        price: p.price,
        priceCurrency: "EUR",
        billingDuration: "P1M",
        unitText: "MONTH",
      },
    })),
  };

  return (
    <>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: jsonLdScript(productJsonLd) }} />
      <JsonLd
        data={breadcrumbJsonLd(locale, [
          { name: "Cloud VPS", path: "/vps" },
          { name: line.title, path: PATH },
        ])}
      />

      {/* Hero: no vendemos RAM y CPU, vendemos el entorno siempre encendido. */}
      <section className="relative overflow-hidden border-b border-[var(--color-line)]">
        <div className="pointer-events-none absolute inset-0 grid-lines opacity-40" aria-hidden="true" />
        <div className="container-edge relative grid gap-12 py-14 md:py-24 lg:grid-cols-[1.1fr_0.9fr] lg:items-center">
          <Reveal>
            <div className="flex items-center gap-3">
              <span className="font-mono text-sm text-[var(--color-accent)]">/ VPS</span>
              <span className="mono-label">{t("kicker")}</span>
            </div>
            <h1 className="mt-6 text-balance text-4xl font-semibold leading-[1.02] tracking-tight sm:text-5xl md:text-6xl">
              {t("h1A")}
              <span className="text-accent">{t("h1B")}</span>
            </h1>
            <p className="mt-5 text-xl font-medium text-[var(--color-fg)]">{t("tagline")}</p>
            <p className="mt-4 max-w-xl text-lg text-[var(--color-fg-muted)]">{t("subtext")}</p>

            <div className="mt-8 flex flex-wrap items-center gap-x-6 gap-y-4">
              <Cta href="#planes">{t("cta")} →</Cta>
              <div>
                <span className="font-mono text-2xl font-semibold tracking-tight">
                  <span className="mr-1.5 text-sm font-normal text-[var(--color-fg-muted)]">{tc("from")}</span>
                  <Price value={from} />
                  <span className="text-sm font-normal text-[var(--color-fg-muted)]">{tc("perMonth")}</span>
                </span>
                <span className="mt-0.5 block font-mono text-xs text-[var(--color-fg-muted)]">
                  {tc("heroBilling")}
                </span>
              </div>
            </div>
            <AiBadges className="mt-8" />
          </Reveal>

          <Reveal delay={1}>
            <AiTerminal
              title="ssh developer@ai-developer"
              lines={[
                { prompt: "~$", text: "ai-session" },
                { text: "[tmux] main · ~/projects", tone: "dim" },
                { prompt: "~/projects/api$", text: "claude" },
                { text: "● Claude Code — refactoring auth module…", tone: "ok" },
                { text: "  ✓ 42 tests passing", tone: "out" },
                { prompt: "~/projects/web$", text: "codex" },
                { text: "● OpenAI Codex — building dashboard…", tone: "ok" },
                { text: "" },
                { text: "[detached] — laptop closed, agents still running 24/7", tone: "dim" },
              ]}
            />
          </Reveal>
        </div>
      </section>

      <section className="container-edge max-w-3xl py-12 md:py-16">
        <p className="mono-label">{t("introKicker")}</p>
        <h2 className="mt-3 text-2xl font-semibold tracking-tight sm:text-3xl">{t("introTitle")}</h2>
        <div className="mt-5 space-y-4 text-[var(--color-fg-muted)]">
          <p>{t("intro.p1")}</p>
          <p>{t("intro.p2")}</p>
          <p>{t("intro.p3")}</p>
        </div>
      </section>

      <AiPlans plans={line.plans} index="/01" />

      <section className="container-edge py-6 md:py-10">
        <Reveal>
          <div className="mx-auto max-w-4xl rounded-[var(--radius-lg)] border border-[var(--color-line)] bg-[var(--color-bg-raised)] p-6 md:p-8">
            <SectionHeader kicker={tc("billing.kicker")} title={tc("billing.title")} description={tc("billing.description")} />
            <p className="mt-4 text-sm text-[var(--color-fg-muted)]">{tc("billing.note")}</p>
          </div>
        </Reveal>
      </section>

      <AiSteps index="/02" />
      <AiBenefits index="/03" />
      <AiStack index="/04" />
      <AiUseCases index="/05" />
      <AiInfra index="/06" />
      <AiDelivery index="/07" />
      <AiDisclaimer />
      <FaqSection items={FAQ} tKey="faq" namespace="ai.main" index="/08" />
      <AiCrossLinks current="main" />
      <AiCta href="#planes" />
    </>
  );
}
