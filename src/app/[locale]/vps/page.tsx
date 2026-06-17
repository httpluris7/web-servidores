import type { Metadata } from "next";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { Link } from "@/i18n/navigation";
import { vps, regions } from "@/data/products";
import { vpsFaq } from "@/data/faq";
import { site } from "@/data/site";
import { eur, jsonLdScript } from "@/lib/utils";
import { PageHero } from "@/components/ui/PageHero";
import { PlanGrid } from "@/components/product/PlanGrid";
import { FaqSection } from "@/components/ui/FaqSection";
import { CtaBand } from "@/components/ui/CtaBand";
import { Reveal } from "@/components/ui/Reveal";
import { SectionHeader } from "@/components/ui/SectionHeader";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>;
}): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "products" });
  return {
    title: t("vps.meta.title"),
    description: t("vps.meta.description", {
      price: eur(Math.min(...vps.plans.map((p) => p.price))),
    }),
  };
}

export default async function VpsPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);
  const t = await getTranslations("products");

  const productJsonLd = {
    "@context": "https://schema.org",
    "@type": "Product",
    name: `${site.brand} Cloud VPS`,
    description: t("vps.tagline"),
    brand: { "@type": "Brand", name: site.brand },
    offers: vps.plans.map((p) => ({
      "@type": "Offer",
      name: p.name,
      price: p.price,
      priceCurrency: "EUR",
      url: p.orderUrl,
      availability: "https://schema.org/InStock",
    })),
  };

  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: jsonLdScript(productJsonLd) }}
      />
      <PageHero
        index="/01"
        kicker={t("vps.kicker")}
        title={t.rich("vps.title", {
          accent: (chunks) => <span className="text-accent">{chunks}</span>,
        })}
        description={t("vps.tagline")}
      />

      <PlanGrid
        index="/02"
        kicker={t("vps.plansKicker")}
        title={t("vps.plansTitle")}
        description={t("vps.plansDescription")}
        plans={vps.plans}
      />

      {/* Regiones */}
      <section className="border-t border-[var(--color-line)] bg-[var(--color-bg-raised)]">
        <div className="container-edge py-14 md:py-24">
          <SectionHeader
            index="/03"
            kicker={t("vps.locationsKicker")}
            title={t("vps.locationsTitle")}
            description={t("vps.locationsDescription")}
          />
          <div className="mt-12 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {regions.map((r, i) => (
              <Reveal key={r.slug} delay={i % 3}>
                <Link
                  href={`/vps/${r.slug}`}
                  className="group flex items-center justify-between rounded-[var(--radius-lg)] border border-[var(--color-line)] bg-[var(--color-bg-base)] p-5 transition-colors hover:border-[var(--color-accent)]"
                >
                  <div>
                    <span className="flex items-center gap-2 text-lg font-medium">
                      <span aria-hidden="true">{r.flag}</span>
                      {t(`vps.regions.${r.slug}.name`)}
                    </span>
                    <span className="mt-1 block font-mono text-xs text-[var(--color-fg-muted)]">
                      {t(`vps.regions.${r.slug}.city`)} · {t(`vps.regions.${r.slug}.latencyNote`)}
                    </span>
                  </div>
                  <span className="text-right">
                    <span className="mono-label block text-[0.6rem]">{t("vps.from")}</span>
                    <span className="font-mono text-lg">{eur(r.priceFrom)}</span>
                  </span>
                </Link>
              </Reveal>
            ))}
          </div>
        </div>
      </section>

      <FaqSection items={vpsFaq} tKey="vpsFaq" index="/04" />
      <CtaBand />
    </>
  );
}
