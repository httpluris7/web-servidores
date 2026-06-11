import type { Metadata } from "next";
import Link from "next/link";
import { useCases } from "@/data/content";
import { PageHero } from "@/components/ui/PageHero";
import { CtaBand } from "@/components/ui/CtaBand";
import { Reveal } from "@/components/ui/Reveal";

export const metadata: Metadata = {
  title: "Casos de uso",
  description:
    "Aplicaciones web, bases de datos, cargas enterprise y plataformas SaaS sobre la infraestructura de NODARA: misma red, misma protección, distinto tamaño.",
  alternates: { canonical: "/casos-de-uso" },
};

export default function UseCasesPage() {
  return (
    <>
      <PageHero
        index="/01"
        kicker="Casos de uso"
        title={
          <>
            Una base. <span className="text-accent">Muchas</span> cargas.
          </>
        }
        description="Da igual lo que despliegues: debajo siempre hay NVMe Gen4, 10 Gbps de red y mitigación DDoS. Elige por dónde empezar."
      />

      <section className="container-edge py-14 md:py-24">
        <div className="grid gap-5 sm:grid-cols-2">
          {useCases.map((c, i) => (
            <Reveal key={c.title} delay={i % 2} as="article">
              <Link
                href={c.href}
                className="group flex h-full flex-col rounded-[var(--radius-lg)] border border-[var(--color-line)] bg-[var(--color-bg-raised)] p-7 transition-colors hover:border-[var(--color-accent)]"
              >
                <span className="font-mono text-sm text-[var(--color-accent)]">{c.n}</span>
                <h2 className="mt-4 text-2xl font-semibold tracking-tight">{c.title}</h2>
                <ul className="mt-5 space-y-2.5 text-sm text-[var(--color-fg-muted)]">
                  {c.bullets.map((b) => (
                    <li key={b} className="flex items-start gap-2">
                      <span className="mt-0.5 text-[var(--color-accent)]">▸</span>
                      {b}
                    </li>
                  ))}
                </ul>
                <span className="mt-auto pt-6 font-mono text-xs text-[var(--color-fg-dim)] transition-colors group-hover:text-[var(--color-accent)]">
                  Ver producto recomendado →
                </span>
              </Link>
            </Reveal>
          ))}
        </div>
      </section>

      <CtaBand />
    </>
  );
}
