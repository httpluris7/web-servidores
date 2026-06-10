import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { regions, getRegion, vps } from "@/data/products";
import { vpsFaq } from "@/data/faq";
import { site } from "@/data/site";
import { eur } from "@/lib/utils";
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
    title: `VPS en ${region.name} (${region.city})`,
    description: `VPS NVMe Gen4 en ${region.city}, ${region.name}. ${region.latencyNote}. Desde ${eur(region.priceFrom)}/mes con red de 10 Gbps y DDoS incluido.`,
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
    description: `VPS en ${region.city}, ${region.name}.`,
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
        dangerouslySetInnerHTML={{ __html: JSON.stringify(productJsonLd) }}
      />
      <PageHero
        index="/ VPS"
        kicker={`${region.flag} ${region.name} · ${region.city}`}
        title={
          <>
            VPS en <span className="text-accent">{region.city}</span>.
          </>
        }
        description={`${region.latencyNote ?? ""}. NVMe Gen4, red de 10 Gbps y protección DDoS incluida. Provisioning en 60 segundos.`}
      >
        <div className="flex flex-wrap gap-3 font-mono text-xs">
          <span className="rounded border border-[var(--color-line)] px-3 py-1.5 text-[var(--color-fg-muted)]">
            {site.network.asn}
          </span>
          <span className="rounded border border-[var(--color-line)] px-3 py-1.5 text-[var(--color-fg-muted)]">
            desde {eur(region.priceFrom)}/mes
          </span>
          <span className="rounded border border-[var(--color-line)] px-3 py-1.5 text-[var(--color-accent)]">
            ● online
          </span>
        </div>
      </PageHero>

      <PlanGrid
        index="/01"
        kicker={`Planes · ${region.name}`}
        title="Planes disponibles en esta región."
        description="Precios mensuales sin permanencia. El plan se despliega automáticamente en esta ubicación."
        plans={vps.plans}
      />

      <FaqSection items={vpsFaq} index="/02" />
      <CtaBand title={`Despliega tu VPS en ${region.city}`} />
    </>
  );
}
