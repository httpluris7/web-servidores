import type { Metadata } from "next";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { Link } from "@/i18n/navigation";
import { site } from "@/data/site";
import { vpsFaq, dedicatedFaq } from "@/data/faq";
import { PageHero } from "@/components/ui/PageHero";
import { Accordion } from "@/components/ui/Accordion";
import { SectionHeader } from "@/components/ui/SectionHeader";
import { Reveal } from "@/components/ui/Reveal";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>;
}): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "pages" });
  return {
    title: t("soporte.metaTitle"),
    description: t("soporte.metaDescription", { brand: site.brand }),
  };
}

export default async function SupportPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);
  const t = await getTranslations("pages");

  const quickLinks = [
    { href: "/estado", key: "status", arrow: "→" },
    { href: "/contacto", key: "request", arrow: "→" },
    { href: "/desplegar", key: "deploy", arrow: "→" },
  ] as const;

  const categories = [
    { key: "gettingStarted" },
    { key: "networkDns" },
    { key: "security" },
    { key: "billing" },
  ] as const;

  return (
    <>
      <PageHero
        index="/01"
        kicker={t("soporte.kicker")}
        title={
          <>
            {t("soporte.titlePrefix")}
            <span className="text-accent">{t("soporte.titleAccent")}</span>
            {t("soporte.titleSuffix")}
          </>
        }
        description={t("soporte.description")}
      />

      {/* Accesos rápidos */}
      <section className="container-edge py-16 md:py-20">
        <div className="grid gap-4 md:grid-cols-3">
          {quickLinks.map((q, i) => (
            <Reveal key={q.href} delay={i}>
              <Link
                href={q.href}
                className="group flex h-full flex-col rounded-[var(--radius-lg)] border border-[var(--color-line)] bg-[var(--color-bg-raised)] p-6 transition-colors hover:border-[var(--color-accent)]"
              >
                <div className="flex items-center justify-between">
                  <h2 className="text-lg font-semibold">{t(`soporte.quickLinks.${q.key}.title`)}</h2>
                  <span className="font-mono text-[var(--color-fg-dim)] transition-colors group-hover:text-[var(--color-accent)]">
                    {q.arrow}
                  </span>
                </div>
                <p className="mt-2 text-sm text-[var(--color-fg-muted)]">{t(`soporte.quickLinks.${q.key}.desc`)}</p>
              </Link>
            </Reveal>
          ))}
        </div>
      </section>

      {/* Categorías de ayuda */}
      <section className="border-y border-[var(--color-line)] bg-[var(--color-bg-raised)]">
        <div className="container-edge py-16 md:py-20">
          <SectionHeader index="/02" kicker={t("soporte.docsKicker")} title={t("soporte.docsTitle")} />
          <div className="mt-10 grid gap-px overflow-hidden rounded-[var(--radius-lg)] border border-[var(--color-line)] bg-[var(--color-line)] sm:grid-cols-2 lg:grid-cols-4">
            {categories.map((c) => {
              const items = t.raw(`soporte.categories.${c.key}.items`) as string[];
              return (
                <div key={c.key} className="bg-[var(--color-bg-raised)] p-6">
                  <h3 className="mono-label">{t(`soporte.categories.${c.key}.title`)}</h3>
                  <ul className="mt-4 space-y-2 text-sm text-[var(--color-fg-muted)]">
                    {items.map((it) => (
                      // TODO: enlazar a artículos de documentación reales cuando existan.
                      <li key={it} className="flex items-start gap-2">
                        <span className="mt-0.5 text-[var(--color-accent)]">▸</span>
                        {it}
                      </li>
                    ))}
                  </ul>
                </div>
              );
            })}
          </div>
        </div>
      </section>

      {/* FAQ combinada */}
      <section className="container-edge py-16 md:py-20">
        <SectionHeader index="/03" kicker={t("soporte.faqKicker")} title={t("soporte.faqTitle")} />
        <div className="mt-10 max-w-3xl">
          <Accordion items={[...vpsFaq, ...dedicatedFaq].slice(0, 8)} />
        </div>
        <p className="mt-8 text-sm text-[var(--color-fg-muted)]">
          {t("soporte.faqHelpPrefix")}
          <Link href="/contacto" className="text-[var(--color-accent)] hover:underline">
            {t("soporte.faqHelpWrite")}
          </Link>
          {t("soporte.faqHelpMiddle")}
          <Link href="/estado" className="text-[var(--color-accent)] hover:underline">
            {t("soporte.faqHelpStatus")}
          </Link>
          {t("soporte.faqHelpSuffix")}
        </p>
      </section>
    </>
  );
}
