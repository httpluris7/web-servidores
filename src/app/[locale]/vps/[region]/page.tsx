import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { regions, getRegion, vps } from "@/data/products";
import { vpsFaq } from "@/data/faq";
import { site } from "@/data/site";
import { eur, jsonLdScript } from "@/lib/utils";
import { PageHero } from "@/components/ui/PageHero";
import { PlanGrid } from "@/components/product/PlanGrid";
import { FaqSection } from "@/components/ui/FaqSection";
import { CtaBand } from "@/components/ui/CtaBand";

type Params = { locale: string; region: string };

export function generateStaticParams(): { region: string }[] {
  return regions.map((r) => ({ region: r.slug }));
}

export async function generateMetadata({
  params,
}: {
  params: Promise<Params>;
}): Promise<Metadata> {
  const { locale, region: slug } = await params;
  const region = getRegion(slug);
  if (!region) return {};
  const t = await getTranslations({ locale, namespace: "products" });
  return {
    title: t("vpsRegion.meta.title", {
      name: t(`vps.regions.${slug}.name`),
      city: t(`vps.regions.${slug}.city`),
    }),
    description: t("vpsRegion.meta.description", {
      name: t(`vps.regions.${slug}.name`),
      city: t(`vps.regions.${slug}.city`),
      latencyNote: t(`vps.regions.${slug}.latencyNote`),
      price: eur(region.priceFrom),
    }),
  };
}

export default async function RegionPage({ params }: { params: Promise<Params> }) {
  const { locale, region: slug } = await params;
  setRequestLocale(locale);
  const region = getRegion(slug);
  if (!region) notFound();

  const t = await getTranslations("products");
  const name = t(`vps.regions.${slug}.name`);
  const city = t(`vps.regions.${slug}.city`);
  const latencyNote = t(`vps.regions.${slug}.latencyNote`);

  const productJsonLd = {
    "@context": "https://schema.org",
    "@type": "Product",
    name: `${site.brand} VPS — ${region.name}`,
    description: `VPS in ${region.city}, ${region.name}.`,
    brand: { "@type": "Brand", name: site.brand },
    offers: vps.plans.map((p) => ({
      "@type": "Offer",
      name: `${p.name} · ${region.name}`,
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
        index="/ VPS"
        kicker={`${region.flag} ${name} · ${city}`}
        title={
          <>
            {t("vpsRegion.titleA")}
            <span className="text-accent">{city}</span>
            {t("vpsRegion.titleSuffix")}
          </>
        }
        description={t("vpsRegion.description", { latencyNote })}
      >
        <div className="flex flex-wrap gap-3 font-mono text-xs">
          <span className="rounded border border-[var(--color-line)] px-3 py-1.5 text-[var(--color-fg-muted)]">
            {site.network.asn}
          </span>
          <span className="rounded border border-[var(--color-line)] px-3 py-1.5 text-[var(--color-fg-muted)]">
            {t("vpsRegion.fromBadge", { price: eur(region.priceFrom) })}
          </span>
          <span className="rounded border border-[var(--color-line)] px-3 py-1.5 text-[var(--color-accent)]">
            {t("vpsRegion.online")}
          </span>
        </div>
      </PageHero>

      <PlanGrid
        index="/01"
        kicker={t("vpsRegion.plansKicker", { name })}
        title={t("vpsRegion.plansTitle")}
        description={t("vpsRegion.plansDescription")}
        plans={vps.plans}
      />

      <FaqSection items={vpsFaq} tKey="vpsFaq" index="/02" />
      <CtaBand title={t("vpsRegion.ctaTitle", { city })} />
    </>
  );
}
