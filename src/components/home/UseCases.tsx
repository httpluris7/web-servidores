import Link from "next/link";
import { useCases } from "@/data/content";
import { SectionHeader } from "@/components/ui/SectionHeader";
import { Reveal } from "@/components/ui/Reveal";

export function UseCases() {
  return (
    <section className="border-t border-[var(--color-line)] bg-[var(--color-bg-raised)]">
      <div className="container-edge py-16 md:py-32">
        <SectionHeader
          index="/08"
          kicker="Use cases"
          title="Built for real workloads."
          description="From an API launching today to a multi-region SaaS platform. The same network underneath."
        />

        <div className="mt-12 grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
          {useCases.map((c, i) => (
            <Reveal key={c.title} delay={i} as="article">
              <Link
                href={c.href}
                className="group flex h-full flex-col rounded-[var(--radius-lg)] border border-[var(--color-line)] bg-[var(--color-bg-base)] p-6 transition-colors hover:border-[var(--color-accent)]"
              >
                <span className="font-mono text-sm text-[var(--color-accent)]">{c.n}</span>
                <h3 className="mt-4 text-xl font-semibold tracking-tight">{c.title}</h3>
                <ul className="mt-4 space-y-2 text-sm text-[var(--color-fg-muted)]">
                  {c.bullets.map((b) => (
                    <li key={b} className="flex items-start gap-2">
                      <span className="mt-0.5 text-[var(--color-accent)]">▸</span>
                      {b}
                    </li>
                  ))}
                </ul>
                <span className="mt-auto pt-6 font-mono text-xs text-[var(--color-fg-dim)] transition-colors group-hover:text-[var(--color-accent)]">
                  View product →
                </span>
              </Link>
            </Reveal>
          ))}
        </div>
      </div>
    </section>
  );
}
