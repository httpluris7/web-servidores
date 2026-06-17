import { getTranslations } from "next-intl/server";
import { whyUs } from "@/data/content";
import { SectionHeader } from "@/components/ui/SectionHeader";
import { Reveal } from "@/components/ui/Reveal";

export async function WhyUs() {
  const t = await getTranslations("home");
  return (
    <section className="container-edge py-16 md:py-32">
      <SectionHeader
        index="/07"
        kicker={t("whyUs.kicker")}
        title={t("whyUs.title")}
        description={t("whyUs.description")}
      />

      <div className="mt-12 grid gap-px overflow-hidden rounded-[var(--radius-lg)] border border-[var(--color-line)] bg-[var(--color-line)] sm:grid-cols-2 lg:grid-cols-3">
        {whyUs.map((f, i) => (
          <Reveal
            key={i}
            delay={i % 3}
            className="group bg-[var(--color-bg-base)] p-7 transition-colors hover:bg-[var(--color-bg-raised)]"
          >
            <div className="font-mono text-4xl font-semibold tracking-tight text-[var(--color-fg)] transition-colors group-hover:text-[var(--color-accent)]">
              {f.metric}
            </div>
            <h3 className="mono-label mt-3">{t(`whyUs.${i}.label`)}</h3>
            <p className="mt-2 text-sm leading-relaxed text-[var(--color-fg-muted)]">{t(`whyUs.${i}.body`)}</p>
          </Reveal>
        ))}
      </div>
    </section>
  );
}
