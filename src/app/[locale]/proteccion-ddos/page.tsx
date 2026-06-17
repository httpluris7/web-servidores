import type { Metadata } from "next";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { site } from "@/data/site";
import { ddosFeatures } from "@/data/content";
import { PageHero } from "@/components/ui/PageHero";
import { CtaBand } from "@/components/ui/CtaBand";
import { Reveal } from "@/components/ui/Reveal";
import { SectionHeader } from "@/components/ui/SectionHeader";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>;
}): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "pages" });
  return {
    title: t("proteccionDdos.metaTitle"),
    description: t("proteccionDdos.metaDescription", { mitigation: site.ddos.mitigationTbps }),
  };
}

export default async function DdosPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);
  const t = await getTranslations("pages");

  const steps = [
    { n: "/01", key: 0 },
    { n: "/02", key: 1 },
    { n: "/03", key: 2 },
  ];

  return (
    <>
      <PageHero
        index="/01"
        kicker={t("proteccionDdos.kicker")}
        title={
          <>
            {t("proteccionDdos.titlePrefix")}
            <span className="text-accent">{t("proteccionDdos.titleAccent")}</span>
            {t("proteccionDdos.titleSuffix")}
          </>
        }
        description={t("proteccionDdos.description", { mitigation: site.ddos.mitigationTbps })}
      />

      {/* Métricas */}
      <section className="border-b border-[var(--color-line)]">
        <div className="container-edge grid gap-px bg-[var(--color-line)] sm:grid-cols-3">
          {[
            { v: `${site.ddos.mitigationTbps} Tbps`, l: t("proteccionDdos.metrics.capacity") },
            { v: site.ddos.absorbedAttacks, l: t("proteccionDdos.metrics.absorbed") },
            { v: `${site.ddos.filteredToServer}`, l: t("proteccionDdos.metrics.toServer") },
          ].map((s, i) => (
            <Reveal key={s.l} delay={i} className="bg-[var(--color-bg-base)] px-6 py-10">
              <div className="font-mono text-4xl font-semibold text-[var(--color-accent)]">{s.v}</div>
              <p className="mono-label mt-3">{s.l}</p>
            </Reveal>
          ))}
        </div>
      </section>

      {/* Cómo funciona */}
      <section className="container-edge py-14 md:py-28">
        <SectionHeader index="/02" kicker={t("proteccionDdos.howKicker")} title={t("proteccionDdos.howTitle")} />
        <div className="mt-12 grid gap-5 md:grid-cols-3">
          {steps.map((s, i) => (
            <Reveal key={s.n} delay={i} className="rounded-[var(--radius-lg)] border border-[var(--color-line)] bg-[var(--color-bg-raised)] p-7">
              <span className="font-mono text-sm text-[var(--color-accent)]">{s.n}</span>
              <h3 className="mt-4 text-xl font-semibold">{t(`proteccionDdos.steps.${s.key}.t`)}</h3>
              <p className="mt-2 text-sm text-[var(--color-fg-muted)]">{t(`proteccionDdos.steps.${s.key}.d`)}</p>
            </Reveal>
          ))}
        </div>
      </section>

      {/* Features */}
      <section className="border-t border-[var(--color-line)] bg-[var(--color-bg-raised)]">
        <div className="container-edge py-14 md:py-24">
          <SectionHeader index="/03" kicker={t("proteccionDdos.capabilitiesKicker")} title={t("proteccionDdos.capabilitiesTitle")} />
          <ul className="mt-12 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {ddosFeatures.map((f, i) => (
              <li
                key={f}
                className="flex items-center gap-2 rounded-[var(--radius-md)] border border-[var(--color-line)] bg-[var(--color-bg-base)] px-4 py-4 text-sm text-[var(--color-fg-muted)]"
              >
                <span className="text-[var(--color-accent)]">✓</span>
                {t(`proteccionDdos.features.${i}`)}
              </li>
            ))}
          </ul>
        </div>
      </section>

      <CtaBand title={t("proteccionDdos.ctaTitle")} subtitle={t("proteccionDdos.ctaSubtitle")} />
    </>
  );
}
