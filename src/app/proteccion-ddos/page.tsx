import type { Metadata } from "next";
import { site } from "@/data/site";
import { ddosFeatures } from "@/data/content";
import { PageHero } from "@/components/ui/PageHero";
import { CtaBand } from "@/components/ui/CtaBand";
import { Reveal } from "@/components/ui/Reveal";
import { SectionHeader } from "@/components/ui/SectionHeader";

export const metadata: Metadata = {
  title: "Protección DDoS",
  description: `Mitigación DDoS de hasta ${site.ddos.mitigationTbps} Tbps siempre activa e incluida en todos los planes. Filtrado L3/L4 y L7 en el borde de la red, sin coste por ataque.`,
  alternates: { canonical: "/proteccion-ddos" },
};

const steps = [
  {
    n: "/01",
    t: "Detección en el borde",
    d: "El tráfico se analiza al entrar a la red. Las firmas de ataque se identifican en menos de 2 segundos.",
  },
  {
    n: "/02",
    t: "Filtrado adaptativo",
    d: "Reglas L3/L4 y L7 que se ajustan a la firma del ataque, sin reroute ni ventanas de corte.",
  },
  {
    n: "/03",
    t: "Tráfico limpio",
    d: "Sólo el tráfico legítimo llega a tu servidor. Tú no haces nada; nosotros no cobramos extra.",
  },
];

export default function DdosPage() {
  return (
    <>
      <PageHero
        index="/01"
        kicker="Protección DDoS"
        title={
          <>
            El ataque llega. A tu servidor, <span className="text-accent">cero</span>.
          </>
        }
        description={`Mitigación de hasta ${site.ddos.mitigationTbps} Tbps siempre activa, incluida en cada VPS y cada dedicado. Sin coste por ataque, sin reconfiguración por tu parte.`}
      />

      {/* Métricas */}
      <section className="border-b border-[var(--color-line)]">
        <div className="container-edge grid gap-px bg-[var(--color-line)] sm:grid-cols-3">
          {[
            { v: `${site.ddos.mitigationTbps} Tbps`, l: "Capacidad de mitigación" },
            { v: site.ddos.absorbedAttacks, l: "Ataques absorbidos" },
            { v: `${site.ddos.filteredToServer}`, l: "Paquetes de ataque al servidor" },
          ].map((s, i) => (
            <Reveal key={s.l} delay={i} className="bg-[var(--color-bg-base)] px-6 py-10">
              <div className="font-mono text-4xl font-semibold text-[var(--color-accent)]">{s.v}</div>
              <p className="mono-label mt-3">{s.l}</p>
            </Reveal>
          ))}
        </div>
      </section>

      {/* Cómo funciona */}
      <section className="container-edge py-20 md:py-28">
        <SectionHeader index="/02" kicker="Cómo funciona" title="Tres pasos, cero intervención." />
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
        <div className="container-edge py-20 md:py-24">
          <SectionHeader index="/03" kicker="Capacidades" title="Defensa de varias capas." />
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

      <CtaBand title="Despliega ya protegido" subtitle="DDoS incluido · sin coste por ataque · sin configurar nada" />
    </>
  );
}
