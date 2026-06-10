import type { Metadata } from "next";
import Link from "next/link";
import { dedicatedTypes } from "@/data/products";
import { dedicatedFaq } from "@/data/faq";
import { eur } from "@/lib/utils";
import { PageHero } from "@/components/ui/PageHero";
import { FaqSection } from "@/components/ui/FaqSection";
import { CtaBand } from "@/components/ui/CtaBand";
import { Reveal } from "@/components/ui/Reveal";
import { SectionHeader } from "@/components/ui/SectionHeader";

export const metadata: Metadata = {
  title: "Servidores dedicados — Bare metal AMD EPYC",
  description:
    "Servidores dedicados bare metal AMD EPYC y Ryzen con uplinks de 1 y 10 Gbps, NVMe Gen4 y storage de alta capacidad. Sin overselling, con DDoS incluido.",
  alternates: { canonical: "/dedicados" },
};

export default function DedicatedPage() {
  return (
    <>
      <PageHero
        index="/01"
        kicker="Servidores dedicados"
        title={
          <>
            Bare metal <span className="text-accent">sin overselling</span>.
          </>
        }
        description="Hardware AMD EPYC y Ryzen dedicado en exclusiva. Uplinks garantizados, NVMe Gen4 y gestión IPMI/KVM. Lo que contratas es lo que tienes."
      />

      <section className="container-edge py-20 md:py-24">
        <SectionHeader
          index="/02"
          kicker="Líneas"
          title="Tres líneas, un objetivo: rendimiento real."
        />
        <div className="mt-12 grid gap-5 lg:grid-cols-3">
          {dedicatedTypes.map((d, i) => {
            const from = Math.min(...d.plans.map((p) => p.price));
            return (
              <Reveal key={d.slug} delay={i} as="article">
                <Link
                  href={`/dedicados/${d.slug}`}
                  className="group flex h-full flex-col rounded-[var(--radius-lg)] border border-[var(--color-line)] bg-[var(--color-bg-raised)] p-6 transition-all hover:border-[var(--color-accent)]"
                >
                  <span className="font-mono text-xs text-[var(--color-accent)]">{d.highlight}</span>
                  <h3 className="mt-4 text-2xl font-semibold tracking-tight">{d.title}</h3>
                  <p className="mt-2 text-sm text-[var(--color-fg-muted)]">{d.tagline}</p>
                  <div className="mt-auto pt-8">
                    <span className="mono-label block text-[0.65rem]">Desde</span>
                    <span className="font-mono text-3xl font-semibold">
                      {eur(from)}
                      <span className="text-base text-[var(--color-fg-muted)]">/mes</span>
                    </span>
                  </div>
                  <span className="mt-4 font-mono text-xs text-[var(--color-fg-dim)] transition-colors group-hover:text-[var(--color-accent)]">
                    Ver configuraciones →
                  </span>
                </Link>
              </Reveal>
            );
          })}
        </div>
      </section>

      <FaqSection items={dedicatedFaq} index="/03" />
      <CtaBand title="¿Necesitas una configuración a medida?" />
    </>
  );
}
