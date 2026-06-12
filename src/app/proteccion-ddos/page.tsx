import type { Metadata } from "next";
import { site } from "@/data/site";
import { ddosFeatures } from "@/data/content";
import { PageHero } from "@/components/ui/PageHero";
import { CtaBand } from "@/components/ui/CtaBand";
import { Reveal } from "@/components/ui/Reveal";
import { SectionHeader } from "@/components/ui/SectionHeader";

export const metadata: Metadata = {
  title: "DDoS Protection",
  description: `Always-on DDoS mitigation of up to ${site.ddos.mitigationTbps} Tbps included in all plans. L3/L4 and L7 filtering at the network edge, with no cost per attack.`,
  alternates: { canonical: "/proteccion-ddos" },
};

const steps = [
  {
    n: "/01",
    t: "Edge detection",
    d: "Traffic is analyzed as it enters the network. Attack signatures are identified in under 2 seconds.",
  },
  {
    n: "/02",
    t: "Adaptive filtering",
    d: "L3/L4 and L7 rules that adjust to the attack signature, with no reroute or downtime windows.",
  },
  {
    n: "/03",
    t: "Clean traffic",
    d: "Only legitimate traffic reaches your server. You do nothing; we charge nothing extra.",
  },
];

export default function DdosPage() {
  return (
    <>
      <PageHero
        index="/01"
        kicker="DDoS Protection"
        title={
          <>
            The attack hits. To your server, <span className="text-accent">zero</span>.
          </>
        }
        description={`Always-on mitigation of up to ${site.ddos.mitigationTbps} Tbps, included with every VPS and every dedicated server. No cost per attack, no reconfiguration on your end.`}
      />

      {/* Métricas */}
      <section className="border-b border-[var(--color-line)]">
        <div className="container-edge grid gap-px bg-[var(--color-line)] sm:grid-cols-3">
          {[
            { v: `${site.ddos.mitigationTbps} Tbps`, l: "Mitigation capacity" },
            { v: site.ddos.absorbedAttacks, l: "Attacks absorbed" },
            { v: `${site.ddos.filteredToServer}`, l: "Attack packets to your server" },
          ].map((s, i) => (
            <Reveal key={s.l} delay={i} className="bg-[var(--color-bg-base)] px-6 py-10">
              <div className="font-mono text-4xl font-semibold text-[var(--color-accent)]">{s.v}</div>
              <p className="mono-label mt-3">{s.l}</p>
            </Reveal>
          ))}
        </div>
      </section>

      {/* Cómo funciona */}
      <section className="container-edge py-14 md:py-28">
        <SectionHeader index="/02" kicker="How it works" title="Three steps, zero intervention." />
        <div className="mt-12 grid gap-5 md:grid-cols-3">
          {steps.map((s, i) => (
            <Reveal key={s.n} delay={i} className="rounded-[var(--radius-lg)] border border-[var(--color-line)] bg-[var(--color-bg-raised)] p-7">
              <span className="font-mono text-sm text-[var(--color-accent)]">{s.n}</span>
              <h3 className="mt-4 text-xl font-semibold">{s.t}</h3>
              <p className="mt-2 text-sm text-[var(--color-fg-muted)]">{s.d}</p>
            </Reveal>
          ))}
        </div>
      </section>

      {/* Features */}
      <section className="border-t border-[var(--color-line)] bg-[var(--color-bg-raised)]">
        <div className="container-edge py-14 md:py-24">
          <SectionHeader index="/03" kicker="Capabilities" title="Multi-layer defense." />
          <ul className="mt-12 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {ddosFeatures.map((f) => (
              <li
                key={f}
                className="flex items-center gap-2 rounded-[var(--radius-md)] border border-[var(--color-line)] bg-[var(--color-bg-base)] px-4 py-4 text-sm text-[var(--color-fg-muted)]"
              >
                <span className="text-[var(--color-accent)]">✓</span>
                {f}
              </li>
            ))}
          </ul>
        </div>
      </section>

      <CtaBand title="Deploy protected from day one" subtitle="DDoS included · no cost per attack · nothing to configure" />
    </>
  );
}
