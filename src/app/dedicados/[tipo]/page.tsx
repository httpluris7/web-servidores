import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { dedicatedTypes, getDedicatedType } from "@/data/products";
import { dedicatedFaq } from "@/data/faq";
import { site } from "@/data/site";
import { jsonLdScript } from "@/lib/utils";
import { PageHero } from "@/components/ui/PageHero";
import { PlanGrid } from "@/components/product/PlanGrid";
import { FaqSection } from "@/components/ui/FaqSection";
import { CtaBand } from "@/components/ui/CtaBand";

type Params = { tipo: string };

export function generateStaticParams(): Params[] {
  return dedicatedTypes.map((d) => ({ tipo: d.slug }));
}

export async function generateMetadata({
  params,
}: {
  params: Promise<Params>;
}): Promise<Metadata> {
  const { tipo } = await params;
  const line = getDedicatedType(tipo);
  if (!line) return {};
  return {
    title: line.title,
    description: line.tagline,
    alternates: { canonical: `/dedicados/${line.slug}` },
  };
}

export default async function DedicatedTypePage({ params }: { params: Promise<Params> }) {
  const { tipo } = await params;
  const line = getDedicatedType(tipo);
  if (!line) notFound();

  const productJsonLd = {
    "@context": "https://schema.org",
    "@type": "Product",
    name: `${site.brand} ${line.title}`,
    description: line.tagline,
    brand: { "@type": "Brand", name: site.brand },
    offers: line.plans.map((p) => ({
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
        index="/ Dedicated"
        kicker={line.highlight}
        title={line.title}
        description={line.tagline}
      />

      <PlanGrid
        index="/01"
        kicker="Configurations"
        title="Available configurations."
        description="Automated delivery for in-stock models. All include IPMI/KVM and DDoS protection."
        plans={line.plans}
      />

      <FaqSection items={dedicatedFaq} index="/02" />
      <CtaBand title={`Order your ${line.title}`} />
    </>
  );
}
