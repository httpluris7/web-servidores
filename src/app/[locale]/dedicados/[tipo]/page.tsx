import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { dedicatedTypes, getDedicatedType } from "@/data/products";
import { dedicatedFaq } from "@/data/faq";
import { site } from "@/data/site";
import { jsonLdScript } from "@/lib/utils";
import { PageHero } from "@/components/ui/PageHero";
import { PlanGrid } from "@/components/product/PlanGrid";
import { FaqSection } from "@/components/ui/FaqSection";
import { CtaBand } from "@/components/ui/CtaBand";

type Params = { locale: string; tipo: string };

export function generateStaticParams(): { tipo: string }[] {
  return dedicatedTypes.map((d) => ({ tipo: d.slug }));
}

export async function generateMetadata({
  params,
}: {
  params: Promise<Params>;
}): Promise<Metadata> {
  const { locale, tipo } = await params;
  const line = getDedicatedType(tipo);
  if (!line) return {};
  const t = await getTranslations({ locale, namespace: "products" });
  return {
    title: t(`dedicated.types.${tipo}.title`),
    description: t(`dedicated.types.${tipo}.tagline`),
  };
}

export default async function DedicatedTypePage({ params }: { params: Promise<Params> }) {
  const { locale, tipo } = await params;
  setRequestLocale(locale);
  const line = getDedicatedType(tipo);
  if (!line) notFound();

  const t = await getTranslations("products");
  const title = t(`dedicated.types.${tipo}.title`);
  const tagline = t(`dedicated.types.${tipo}.tagline`);
  const highlight = t(`dedicated.types.${tipo}.highlight`);

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
