import type { Metadata } from "next";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { Link } from "@/i18n/navigation";
import { useCases } from "@/data/content";
import { PageHero } from "@/components/ui/PageHero";
import { CtaBand } from "@/components/ui/CtaBand";
import { Reveal } from "@/components/ui/Reveal";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>;
}): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "pages" });
  return {
    title: t("casosDeUso.metaTitle"),
    description: t("casosDeUso.metaDescription"),
  };
}

export default async function UseCasesPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);
  const t = await getTranslations("pages");

  return (
    <>
      <PageHero
        index="/01"
        kicker={t("casosDeUso.kicker")}
        title={
          <>
            {t("casosDeUso.titlePrefix")}
            <span className="text-accent">{t("casosDeUso.titleAccent")}</span>
            {t("casosDeUso.titleSuffix")}
          </>
        }
        description={t("casosDeUso.description")}
      />

      <section className="container-edge py-14 md:py-24">
        <div className="grid gap-5 sm:grid-cols-2">
          {useCases.map((c, i) => {
            const bullets = t.raw(`casosDeUso.items.${i}.bullets`) as string[];
            return (
              <Reveal key={c.title} delay={i % 2} as="article">
                <Link
                  href={c.href}
                  className="group flex h-full flex-col rounded-[var(--radius-lg)] border border-[var(--color-line)] bg-[var(--color-bg-raised)] p-7 transition-colors hover:border-[var(--color-accent)]"
                >
                  <span className="font-mono text-sm text-[var(--color-accent)]">{c.n}</span>
                  <h2 className="mt-4 text-2xl font-semibold tracking-tight">{t(`casosDeUso.items.${i}.title`)}</h2>
                  <ul className="mt-5 space-y-2.5 text-sm text-[var(--color-fg-muted)]">
                    {bullets.map((b) => (
                      <li key={b} className="flex items-start gap-2">
                        <span className="mt-0.5 text-[var(--color-accent)]">▸</span>
                        {b}
                      </li>
                    ))}
                  </ul>
                  <span className="mt-auto pt-6 font-mono text-xs text-[var(--color-fg-dim)] transition-colors group-hover:text-[var(--color-accent)]">
                    {t("casosDeUso.viewProduct")}
                  </span>
                </Link>
              </Reveal>
            );
          })}
        </div>
      </section>

      <CtaBand />
    </>
  );
}
