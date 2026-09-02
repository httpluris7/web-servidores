import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";
import { Link } from "@/i18n/navigation";
import { PageHero } from "@/components/ui/PageHero";
import { SectionHeader } from "@/components/ui/SectionHeader";
import { Accordion } from "@/components/ui/Accordion";
import { CtaBand } from "@/components/ui/CtaBand";
import { Reveal } from "@/components/ui/Reveal";
import { JsonLd } from "@/components/seo/JsonLd";
import { alternatesFor, breadcrumbJsonLd } from "@/lib/seo";

type Row = { feature: string; viahost: string; competitor: string };
type QA = { q: string; a: string };

/** Metadata de una página de comparativa (namespace `comparativas.<nsKey>`). */
export async function comparativaMetadata(
  locale: string,
  nsKey: string,
  path: string,
): Promise<Metadata> {
  const t = await getTranslations({ locale, namespace: `comparativas.${nsKey}` });
  return {
    alternates: alternatesFor(locale, path),
    title: t("metaTitle"),
    description: t("metaDescription"),
  };
}

/**
 * Plantilla reutilizable de comparativa "cara a cara" (ViaHost vs X, o vs el
 * patrón del sector). Todo el contenido vive en `comparativas.<nsKey>` con
 * claves genéricas (`table.competitor`, `whenCompetitor`…), así que añadir una
 * comparativa nueva es solo contenido i18n + una página de 3 líneas.
 */
export async function ComparativaHeadToHead({
  locale,
  nsKey,
  path,
  ctaHref = "/vps",
}: {
  locale: string;
  nsKey: string;
  path: string;
  ctaHref?: string;
}) {
  const t = await getTranslations({ locale, namespace: `comparativas.${nsKey}` });

  const rows = t.raw("table.rows") as Row[];
  const faqItems = t.raw("faqItems") as QA[];
  const whenCompetitor = t.raw("whenCompetitor.items") as string[];
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
      <JsonLd data={breadcrumbJsonLd(locale, [{ name: `${t("titleA")} ${t("titleB")}`, path }])} />

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

      <section className="container-edge py-6 md:py-10">
        <SectionHeader index="/01" title={t("table.title")} />
        <div className="mt-8 overflow-x-auto rounded-[var(--radius-lg)] border border-[var(--color-line)]">
          <table className="w-full min-w-[560px] border-collapse text-sm">
            <caption className="sr-only">{t("table.caption")}</caption>
            <thead>
              <tr className="bg-[var(--color-bg-raised)] text-left">
                <th scope="col" className="px-4 py-3 font-semibold">{t("table.feature")}</th>
                <th scope="col" className="px-4 py-3 font-semibold text-[var(--color-accent)]">{t("table.viahost")}</th>
                <th scope="col" className="px-4 py-3 font-semibold">{t("table.competitor")}</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.feature} className="border-t border-[var(--color-line)]">
                  <th scope="row" className="px-4 py-3 text-left font-medium text-[var(--color-fg)]">{r.feature}</th>
                  <td className="px-4 py-3 text-[var(--color-fg)]">{r.viahost}</td>
                  <td className="px-4 py-3 text-[var(--color-fg-muted)]">{r.competitor}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {t.has("table.priceNote") && (
          <p className="mt-3 text-xs text-[var(--color-fg-dim)]">{t("table.priceNote")}</p>
        )}
      </section>

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
            <h2 className="text-lg font-semibold">{t("whenCompetitor.title")}</h2>
            <ul className="mt-4 space-y-2.5 text-sm text-[var(--color-fg-muted)]">
              {whenCompetitor.map((it) => (
                <li key={it} className="flex items-start gap-2">
                  <span className="mt-0.5 text-[var(--color-fg-dim)]">▸</span>
                  {it}
                </li>
              ))}
            </ul>
          </Reveal>
        </div>
      </section>

      <section className="container-edge py-14 md:py-24">
        <SectionHeader index="/02" kicker={t("faq.kicker")} title={t("faq.title")} />
        <div className="mt-10 max-w-3xl">
          <Accordion items={faqItems} />
        </div>
      </section>

      <div className="container-edge pb-4">
        <Link href={ctaHref} className="font-mono text-sm text-[var(--color-accent)] hover:underline">
          {t("cta")} →
        </Link>
      </div>

      <CtaBand />
    </>
  );
}
