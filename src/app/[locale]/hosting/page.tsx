import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { getHostingLine } from "@/data/products";
import { site } from "@/data/site";
import { jsonLdScript } from "@/lib/utils";
import { PageHero } from "@/components/ui/PageHero";
import { PlanGrid } from "@/components/product/PlanGrid";
import { SectionHeader } from "@/components/ui/SectionHeader";
import { Reveal } from "@/components/ui/Reveal";
import { CtaBand } from "@/components/ui/CtaBand";
import { alternatesFor, breadcrumbJsonLd } from "@/lib/seo";
import { JsonLd } from "@/components/seo/JsonLd";
import { HostingPlansTable } from "@/components/hosting/HostingPlansTable";
import { FaqSection } from "@/components/ui/FaqSection";
import { hostingFaq } from "@/data/faq";

export const dynamic = "force-dynamic";

const FEATURES = ["ssl", "cpanel", "transfer", "backups", "migration", "ddos"] as const;

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>;
}): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "hosting" });
  return {
    alternates: alternatesFor(locale, "/hosting"),
    title: t("metaTitle"),
    description: t("metaDescription", { brand: site.brand }),
  };
}

export default async function HostingPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);
  const t = await getTranslations("hosting");
  const line = await getHostingLine(locale);

  // Sin planes de hosting visibles no hay escaparate: 404 hasta que se publique.
  if (!line || line.plans.length === 0) notFound();

  // Los 4 campos del plan se reetiquetan para hosting (ver `catalogo.json`).
  const specLabels = {
    cpu: t("spec.sites"),
    ram: t("spec.storage"),
    storage: t("spec.email"),
    bandwidth: t("spec.databases"),
  };

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
      <JsonLd data={breadcrumbJsonLd(locale, [{ name: line.title, path: "/hosting" }])} />
      <PageHero
        index="/ Hosting"
        kicker={t("kicker")}
        title={
          <>
            {t("titleA")} <span className="text-accent">{t("titleB")}</span>
          </>
        }
        description={t("description")}
      />

      <section className="container-edge max-w-3xl py-10 md:py-14">
        <div className="space-y-4 text-[var(--color-fg-muted)]">
          <p>{t("intro.p1")}</p>
          <p>{t("intro.p2")}</p>
        </div>
      </section>

      <PlanGrid
        index="/01"
        kicker={t("plansKicker")}
        title={t("plansTitle")}
        description={t("plansDescription")}
        plans={line.plans}
        specLabels={specLabels}
      />

      <section className="container-edge py-6 md:py-10">
        <SectionHeader index="/02" title={t("table.title")} />
        <div className="mt-8">
          <HostingPlansTable
            plans={line.plans}
            labels={{
              plan: t("table.plan"),
              sites: t("spec.sites"),
              storage: t("spec.storage"),
              email: t("spec.email"),
              databases: t("spec.databases"),
              price: t("table.price"),
            }}
            perMonth={t("table.perMonth")}
            caption={t("table.caption")}
          />
        </div>
      </section>

      <section className="container-edge py-14 md:py-24">
        <SectionHeader index="/03" kicker={t("featuresKicker")} title={t("featuresTitle")} />
        <div className="mt-12 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
          {FEATURES.map((k, i) => (
            <Reveal key={k} delay={i} as="article">
              <div className="flex h-full flex-col rounded-[var(--radius-lg)] border border-[var(--color-line)] bg-[var(--color-bg-raised)] p-6">
                <h3 className="text-lg font-semibold tracking-tight">{t(`features.${k}.t`)}</h3>
                <p className="mt-2 text-sm text-[var(--color-fg-muted)]">{t(`features.${k}.d`)}</p>
              </div>
            </Reveal>
          ))}
        </div>
      </section>

      <FaqSection items={hostingFaq} tKey="faqItems" namespace="hosting" index="/04" />

      <CtaBand title={t("ctaTitle")} />
    </>
  );
}
