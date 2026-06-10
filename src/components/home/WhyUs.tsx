import { whyUs } from "@/data/content";
import { SectionHeader } from "@/components/ui/SectionHeader";
import { Reveal } from "@/components/ui/Reveal";

export function WhyUs() {
  return (
    <section className="container-edge py-24 md:py-32">
      <SectionHeader
        index="/07"
        kicker="Por qué NODARA"
        title="El dato manda. Lo demás, ruido."
        description="Sin iconografía de stock ni promesas vacías: cada motivo es una cifra que puedes verificar."
      />

      <div className="mt-12 grid gap-px overflow-hidden rounded-[var(--radius-lg)] border border-[var(--color-line)] bg-[var(--color-line)] sm:grid-cols-2 lg:grid-cols-3">
        {whyUs.map((f, i) => (
          <Reveal
            key={f.label}
            delay={i % 3}
            className="group bg-[var(--color-bg-base)] p-7 transition-colors hover:bg-[var(--color-bg-raised)]"
          >
            <div className="font-mono text-4xl font-semibold tracking-tight text-[var(--color-fg)] transition-colors group-hover:text-[var(--color-accent)]">
              {f.metric}
            </div>
            <h3 className="mono-label mt-3">{f.label}</h3>
            <p className="mt-2 text-sm leading-relaxed text-[var(--color-fg-muted)]">{f.body}</p>
          </Reveal>
        ))}
      </div>
    </section>
  );
}
