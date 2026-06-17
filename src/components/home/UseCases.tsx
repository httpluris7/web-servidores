import { getTranslations } from "next-intl/server";
import { Link } from "@/i18n/navigation";
import { useCases } from "@/data/content";
import { SectionHeader } from "@/components/ui/SectionHeader";
import { Reveal } from "@/components/ui/Reveal";

export async function UseCases() {
  const t = await getTranslations("home");
  return (
    <section className="border-t border-[var(--color-line)] bg-[var(--color-bg-raised)]">
      <div className="container-edge py-16 md:py-32">
        <SectionHeader
          index="/08"
          kicker={t("useCases.kicker")}
          title={t("useCases.title")}
          description={t("useCases.description")}
        />

        <div className="mt-12 grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
          {useCases.map((c, i) => (
            <Reveal key={i} delay={i} as="article">
              <Link
                href={c.href}
                className="group flex h-full flex-col rounded-[var(--radius-lg)] border border-[var(--color-line)] bg-[var(--color-bg-base)] p-6 transition-colors hover:border-[var(--color-accent)]"
              >
                <span className="font-mono text-sm text-[var(--color-accent)]">{c.n}</span>
                <h3 className="mt-4 text-xl font-semibold tracking-tight">{t(`useCases.${i}.title`)}</h3>
                <ul className="mt-4 space-y-2 text-sm text-[var(--color-fg-muted)]">
                  {c.bullets.map((b, j) => (
                    <li key={j} className="flex items-start gap-2">
                      <span className="mt-0.5 text-[var(--color-accent)]">▸</span>
                      {t(`useCases.${i}.bullets.${j}`)}
                    </li>
                  ))}
                </ul>
                <span className="mt-auto pt-6 font-mono text-xs text-[var(--color-fg-dim)] transition-colors group-hover:text-[var(--color-accent)]">
                  {t("useCases.viewProduct")}
                </span>
              </Link>
            </Reveal>
          ))}
        </div>
      </div>
    </section>
  );
}
