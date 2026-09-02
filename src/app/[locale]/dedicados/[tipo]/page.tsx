import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { alternatesFor } from "@/lib/seo";
import { getDedicatedType, getDedicatedTypes } from "@/data/products";
import { dedicatedFaq } from "@/data/faq";
import { site } from "@/data/site";
import { jsonLdScript } from "@/lib/utils";
import { PageHero } from "@/components/ui/PageHero";
import { PlanGrid } from "@/components/product/PlanGrid";
import { FaqSection } from "@/components/ui/FaqSection";
import { CtaBand } from "@/components/ui/CtaBand";

type Params = { locale: string; tipo: string };

export async function generateStaticParams(): Promise<{ tipo: string }[]> {
  return (await getDedicatedTypes()).map((d) => ({ tipo: d.slug }));
}

export async function generateMetadata({
  params,
}: {
  params: Promise<Params>;
}): Promise<Metadata> {
  const { locale, tipo } = await params;
  const line = await getDedicatedType(tipo, locale);
  if (!line) return {};
  return {
    alternates: alternatesFor(locale, `/dedicados/${tipo}`),
    title: line.title,
    description: line.tagline,
  };
}

export default async function DedicatedTypePage({ params }: { params: Promise<Params> }) {
  const { locale, tipo } = await params;
  setRequestLocale(locale);
  const line = await getDedicatedType(tipo, locale);
  if (!line) notFound();

  const t = await getTranslations("products");
  const { title, tagline, highlight } = line;

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
        kicker={highlight}
        title={title}
        description={tagline}
      />

      <PlanGrid
        index="/01"
        kicker={t("dedicatedType.plansKicker")}
        title={t("dedicatedType.plansTitle")}
        description={t("dedicatedType.plansDescription")}
        plans={line.plans}
      />

      <FaqSection items={dedicatedFaq} tKey="dedicatedFaq" index="/02" />
      <CtaBand title={t("dedicatedType.ctaTitle", { title })} />
    </>
  );
}
