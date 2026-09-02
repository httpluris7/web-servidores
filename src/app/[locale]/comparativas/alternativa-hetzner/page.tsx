import type { Metadata } from "next";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { Link } from "@/i18n/navigation";
import { PageHero } from "@/components/ui/PageHero";
import { SectionHeader } from "@/components/ui/SectionHeader";
import { Accordion } from "@/components/ui/Accordion";
import { CtaBand } from "@/components/ui/CtaBand";
import { Reveal } from "@/components/ui/Reveal";
import { JsonLd } from "@/components/seo/JsonLd";
import { alternatesFor, breadcrumbJsonLd } from "@/lib/seo";

const PATH = "/comparativas/alternativa-hetzner";

type Row = { feature: string; viahost: string; hetzner: string };
type QA = { q: string; a: string };

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>;
}): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "comparativas.hetzner" });
  return {
    alternates: alternatesFor(locale, PATH),
    title: t("metaTitle"),
    description: t("metaDescription"),
  };
}

export default async function AlternativaHetznerPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);
  const t = await getTranslations("comparativas.hetzner");

  const rows = t.raw("table.rows") as Row[];
  const faqItems = t.raw("faqItems") as QA[];
  const whenHetzner = t.raw("whenHetzner.items") as string[];
  const whenViahost = t.raw("whenViahost.items") as string[];

  const faqJsonLd = {
    "@context": "https://schema.org",
    "@type": "FAQPage",
    mainEntity: faqItems.map((it) => ({
      "@type": "Question",
      name: it.q,
      acceptedAnswer: { "@type": "Answer", text: it.a },
    })),
  };

  return (
    <>
      <JsonLd data={faqJsonLd} />
      <JsonLd data={breadcrumbJsonLd(locale, [{ name: `${t("titleA")} ${t("titleB")}`, path: PATH }])} />

      <PageHero
        index="/ Comparativa"
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

      {/* Tabla comparativa */}
      <section className="container-edge py-6 md:py-10">
        <SectionHeader index="/01" title={t("table.title")} />
        <div className="mt-8 overflow-x-auto rounded-[var(--radius-lg)] border border-[var(--color-line)]">
          <table className="w-full min-w-[560px] border-collapse text-sm">
            <caption className="sr-only">{t("table.caption")}</caption>
            <thead>
              <tr className="bg-[var(--color-bg-raised)] text-left">
                <th scope="col" className="px-4 py-3 font-semibold">{t("table.feature")}</th>
                <th scope="col" className="px-4 py-3 font-semibold text-[var(--color-accent)]">{t("table.viahost")}</th>
                <th scope="col" className="px-4 py-3 font-semibold">{t("table.hetzner")}</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.feature} className="border-t border-[var(--color-line)]">
                  <th scope="row" className="px-4 py-3 text-left font-medium text-[var(--color-fg)]">{r.feature}</th>
                  <td className="px-4 py-3 text-[var(--color-fg)]">{r.viahost}</td>
                  <td className="px-4 py-3 text-[var(--color-fg-muted)]">{r.hetzner}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <p className="mt-3 text-xs text-[var(--color-fg-dim)]">{t("table.priceNote")}</p>
      </section>

      {/* Cuándo elegir cada uno */}
      <section className="container-edge py-10 md:py-16">
        <div className="grid gap-5 md:grid-cols-2">
          <Reveal as="article" className="rounded-[var(--radius-lg)] border border-[var(--color-accent)]/30 bg-[var(--color-bg-raised)] p-6">
            <h2 className="text-lg font-semibold">{t("whenViahost.title")}</h2>
            <ul className="mt-4 space-y-2.5 text-sm text-[var(--color-fg-muted)]">
              {whenViahost.map((it) => (
                <li key={it} className="flex items-start gap-2">
                  <span className="mt-0.5 text-[var(--color-accent)]">▸</span>
                  {it}
                </li>
              ))}
            </ul>
          </Reveal>
          <Reveal as="article" delay={1} className="rounded-[var(--radius-lg)] border border-[var(--color-line)] bg-[var(--color-bg-raised)] p-6">
            <h2 className="text-lg font-semibold">{t("whenHetzner.title")}</h2>
            <ul className="mt-4 space-y-2.5 text-sm text-[var(--color-fg-muted)]">
              {whenHetzner.map((it) => (
                <li key={it} className="flex items-start gap-2">
                  <span className="mt-0.5 text-[var(--color-fg-dim)]">▸</span>
                  {it}
                </li>
              ))}
            </ul>
          </Reveal>
        </div>
      </section>

      {/* FAQ */}
      <section className="container-edge py-14 md:py-24">
        <SectionHeader index="/02" kicker={t("faq.kicker")} title={t("faq.title")} />
        <div className="mt-10 max-w-3xl">
          <Accordion items={faqItems} />
        </div>
      </section>

      <div className="container-edge pb-4">
        <Link href="/vps" className="font-mono text-sm text-[var(--color-accent)] hover:underline">
          {t("cta")} →
        </Link>
      </div>

      <CtaBand />
    </>
  );
}
