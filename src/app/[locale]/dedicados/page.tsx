import type { Metadata } from "next";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { Link } from "@/i18n/navigation";
import { dedicatedTypes } from "@/data/products";
import { dedicatedFaq } from "@/data/faq";
import { eur } from "@/lib/utils";
import { PageHero } from "@/components/ui/PageHero";
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
    title: t("dedicated.meta.title"),
    description: t("dedicated.meta.description"),
  };
}

export default async function DedicatedPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);
  const t = await getTranslations("products");

  return (
    <>
      <PageHero
        index="/01"
        kicker={t("dedicated.kicker")}
        title={
          <>
            {t("dedicated.titleA")}
            <span className="text-accent">{t("dedicated.titleB")}</span>
            {t("dedicated.titleSuffix")}
          </>
        }
        description={t("dedicated.description")}
      />

      <section className="container-edge py-14 md:py-24">
        <SectionHeader
          index="/02"
          kicker={t("dedicated.locationsKicker")}
          title={t("dedicated.locationsTitle")}
        />
        <div className="mt-12 grid gap-5 sm:grid-cols-2">
          {dedicatedTypes.map((d, i) => {
            const from = Math.min(...d.plans.map((p) => p.price));
            return (
              <Reveal key={d.slug} delay={i} as="article">
                <Link
                  href={`/dedicados/${d.slug}`}
                  className="group flex h-full flex-col rounded-[var(--radius-lg)] border border-[var(--color-line)] bg-[var(--color-bg-raised)] p-6 transition-all hover:border-[var(--color-accent)]"
                >
                  <span className="font-mono text-xs text-[var(--color-accent)]">
                    {t(`dedicated.types.${d.slug}.highlight`)}
                  </span>
                  <h3 className="mt-4 text-2xl font-semibold tracking-tight">
                    {t(`dedicated.types.${d.slug}.title`)}
                  </h3>
                  <p className="mt-2 text-sm text-[var(--color-fg-muted)]">
                    {t(`dedicated.types.${d.slug}.tagline`)}
                  </p>
                  <div className="mt-auto pt-8">
                    <span className="mono-label block text-[0.65rem]">{t("dedicated.from")}</span>
                    <span className="font-mono text-3xl font-semibold">
                      {eur(from)}
                      <span className="text-base text-[var(--color-fg-muted)]">
                        {t("dedicated.perMonth")}
                      </span>
                    </span>
                  </div>
                  <span className="mt-4 font-mono text-xs text-[var(--color-fg-dim)] transition-colors group-hover:text-[var(--color-accent)]">
                    {t("dedicated.viewConfigurations")}
                  </span>
                </Link>
              </Reveal>
            );
          })}
        </div>
      </section>

      <FaqSection items={dedicatedFaq} tKey="dedicatedFaq" index="/03" />
      <CtaBand title={t("dedicated.ctaTitle")} />
    </>
  );
}
