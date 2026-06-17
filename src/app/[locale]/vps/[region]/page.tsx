import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { regions, getRegion, vps } from "@/data/products";
import { vpsFaq } from "@/data/faq";
import { site } from "@/data/site";
import { eur, jsonLdScript } from "@/lib/utils";
import { PageHero } from "@/components/ui/PageHero";
import { PlanGrid } from "@/components/product/PlanGrid";
import { FaqSection } from "@/components/ui/FaqSection";
import { CtaBand } from "@/components/ui/CtaBand";

type Params = { region: string };

export function generateStaticParams(): Params[] {
  return regions.map((r) => ({ region: r.slug }));
}

export async function generateMetadata({
  params,
}: {
  params: Promise<Params>;
}): Promise<Metadata> {
  const { region: slug } = await params;
  const region = getRegion(slug);
  if (!region) return {};
  return {
    title: `VPS in ${region.name} (${region.city})`,
    description: `NVMe Gen4 VPS in ${region.city}, ${region.name}. ${region.latencyNote}. From ${eur(region.priceFrom)}/mo with 10 Gbps networking and DDoS included.`,
    alternates: { canonical: `/vps/${region.slug}` },
  };
}

export default async function RegionPage({ params }: { params: Promise<Params> }) {
  const { region: slug } = await params;
  const region = getRegion(slug);
  if (!region) notFound();

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
        kicker={`${region.flag} ${region.name} · ${region.city}`}
        title={
          <>
            VPS in <span className="text-accent">{region.city}</span>.
          </>
        }
        description={`${region.latencyNote ?? ""}. NVMe Gen4, 10 Gbps networking and DDoS protection included. Provisioning in 60 seconds.`}
      >
        <div className="flex flex-wrap gap-3 font-mono text-xs">
          <span className="rounded border border-[var(--color-line)] px-3 py-1.5 text-[var(--color-fg-muted)]">
            {site.network.asn}
          </span>
          <span className="rounded border border-[var(--color-line)] px-3 py-1.5 text-[var(--color-fg-muted)]">
            from {eur(region.priceFrom)}/mo
          </span>
          <span className="rounded border border-[var(--color-line)] px-3 py-1.5 text-[var(--color-accent)]">
            ● online
          </span>
        </div>
      </PageHero>

      <PlanGrid
        index="/01"
        kicker={`Plans · ${region.name}`}
        title="Plans available in this region."
        description="Monthly pricing with no lock-in. The plan is deployed automatically in this location."
        plans={vps.plans}
      />

      <FaqSection items={vpsFaq} index="/02" />
      <CtaBand title={`Deploy your VPS in ${region.city}`} />
    </>
  );
}
