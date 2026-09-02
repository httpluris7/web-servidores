import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { alternatesFor, breadcrumbJsonLd } from "@/lib/seo";
import { JsonLd } from "@/components/seo/JsonLd";
import { getCatalog, getRegion, getRegions, vpsPlansForRegion } from "@/data/products";
import { vpsFaq } from "@/data/faq";
import { site } from "@/data/site";
import { eurPrecio, jsonLdScript } from "@/lib/utils";
import { Price } from "@/components/ui/Price";
import { PageHero } from "@/components/ui/PageHero";
import { PlanGrid } from "@/components/product/PlanGrid";
import { FaqSection } from "@/components/ui/FaqSection";
import { CtaBand } from "@/components/ui/CtaBand";

type Params = { locale: string; region: string };

/**
 * Sustituye la marca del procesador de un plan por la de la región, conservando
 * el "N vCore" inicial ("2 vCore AMD EPYC" → "2 vCore Xeon Gold 6150"). Si el
 * texto no tiene esa forma, se deja intacto para no inventar nada.
 */
function conMarcaCpu(cpu: string, marca: string): string {
  const m = cpu.match(/^(\d+\s*vCores?)\b/i);
  return m ? `${m[1]} ${marca}` : cpu;
}

export async function generateStaticParams(): Promise<{ region: string }[]> {
  return (await getRegions()).map((r) => ({ region: r.slug }));
}

export async function generateMetadata({
  params,
}: {
  params: Promise<Params>;
}): Promise<Metadata> {
  const { locale, region: slug } = await params;
  const region = await getRegion(slug, locale);
  if (!region) return {};
  const t = await getTranslations({ locale, namespace: "products" });
  return {
    alternates: alternatesFor(locale, `/vps/${slug}`),
    title: t("vpsRegion.meta.title", { name: region.name, city: region.city }),
    description: t("vpsRegion.meta.description", {
      name: region.name,
      city: region.city,
      latencyNote: region.latencyNote ?? "",
      price: eurPrecio(region.priceFrom),
    }),
  };
}

export default async function RegionPage({ params }: { params: Promise<Params> }) {
  const { locale, region: slug } = await params;
  setRequestLocale(locale);
  const catalog = await getCatalog(locale);
  const { regions } = catalog;
  const region = regions.find((r) => r.slug === slug);
  if (!region) notFound();

  const t = await getTranslations("products");
  const { name, city } = region;
  const latencyNote = region.latencyNote ?? "";

  // Gama de la región: la propia si la tiene (p. ej. Germany con EPYC y más RAM),
  // o los packs globales. Solo se reetiqueta la marca de CPU si la región la fija.
  const planesRegion = vpsPlansForRegion(catalog, slug);
  const plans = region.cpu
    ? planesRegion.map((p) => ({ ...p, cpu: conMarcaCpu(p.cpu, region.cpu as string) }))
    : planesRegion;

  const productJsonLd = {
    "@context": "https://schema.org",
    "@type": "Product",
    name: `${site.brand} VPS — ${region.name}`,
    description: `VPS in ${region.city}, ${region.name}.`,
    brand: { "@type": "Brand", name: site.brand },
    offers: plans.map((p) => ({
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
      <JsonLd
        data={breadcrumbJsonLd(locale, [
          { name: "Cloud VPS", path: "/vps" },
          { name: region.name, path: `/vps/${slug}` },
        ])}
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
            {/* El importe va como etiqueta rica para poder pintarlo en las dos divisas. */}
            {t.rich("vpsRegion.fromBadge", {
              price: () => <Price value={region.priceFrom} />,
            })}
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
        plans={plans}
      />

      <FaqSection items={vpsFaq} tKey="vpsFaq" index="/02" />
      <CtaBand title={t("vpsRegion.ctaTitle", { city })} />
    </>
  );
}
