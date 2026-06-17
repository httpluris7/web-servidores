import type { Metadata } from "next";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { site } from "@/data/site";
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
    title: t("sobreNosotros.metaTitle"),
    description: t("sobreNosotros.metaDescription", {
      brand: site.brand,
      asn: site.network.asn,
    }),
  };
}

export default async function AboutPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);
  const t = await getTranslations("pages");

  const principles = [
    { key: 0 },
    { key: 1 },
    { key: 2, asn: site.network.asn },
    { key: 3 },
  ];

  return (
    <>
      <PageHero
        index="/01"
        kicker={t("sobreNosotros.kicker")}
        title={
          <>
            {t("sobreNosotros.titlePrefix")}
            <span className="text-accent">{t("sobreNosotros.titleAccent")}</span>
            {t("sobreNosotros.titleSuffix")}
          </>
        }
        description={t("sobreNosotros.description", { brand: site.brand })}
      />

      {/* TODO: sustituir por la historia real de la empresa, hitos y equipo. */}
      <section className="container-edge py-14 md:py-28">
        <SectionHeader index="/02" kicker={t("sobreNosotros.principlesKicker")} title={t("sobreNosotros.principlesTitle")} />
        <div className="mt-12 grid gap-px overflow-hidden rounded-[var(--radius-lg)] border border-[var(--color-line)] bg-[var(--color-line)] sm:grid-cols-2">
          {principles.map((p) => (
            <Reveal key={p.key} className="bg-[var(--color-bg-base)] p-8">
              <h3 className="text-xl font-semibold">{t(`sobreNosotros.principles.${p.key}.t`)}</h3>
              <p className="mt-2 text-sm leading-relaxed text-[var(--color-fg-muted)]">
                {t(`sobreNosotros.principles.${p.key}.d`, { asn: site.network.asn })}
              </p>
            </Reveal>
          ))}
        </div>

        <Reveal className="mt-16">
          <div className="rounded-[var(--radius-lg)] border border-[var(--color-line)] bg-[var(--color-bg-raised)] p-8">
            <span className="mono-label">{t("sobreNosotros.companyDetails")}</span>
            <dl className="mt-6 grid gap-4 font-mono text-sm sm:grid-cols-2">
              <div>
                <dt className="text-[var(--color-fg-dim)]">{t("sobreNosotros.legalName")}</dt>
                <dd className="mt-1">{site.legal.companyName}</dd>
              </div>
              <div>
                <dt className="text-[var(--color-fg-dim)]">{t("sobreNosotros.incorporation")}</dt>
                <dd className="mt-1">{site.legal.jurisdiction}</dd>
              </div>
              <div>
                <dt className="text-[var(--color-fg-dim)]">{t("sobreNosotros.taxId")}</dt>
                <dd className="mt-1">{site.legal.taxId}</dd>
              </div>
              <div>
                <dt className="text-[var(--color-fg-dim)]">{t("sobreNosotros.autonomousSystem")}</dt>
                <dd className="mt-1 text-[var(--color-accent)]">{site.network.asn}</dd>
              </div>
              <div className="sm:col-span-2">
                <dt className="text-[var(--color-fg-dim)]">{t("sobreNosotros.registeredAddress")}</dt>
                <dd className="mt-1">{site.legal.address}</dd>
              </div>
            </dl>
            <p className="mt-6 text-xs text-[var(--color-fg-dim)]">
              {/* TODO: confirmar todos los datos legales con el cliente antes de publicar. */}
              {t("sobreNosotros.provisionalData")}
            </p>
          </div>
        </Reveal>
      </section>

      <CtaBand title={t("sobreNosotros.ctaTitle")} />
    </>
  );
}
