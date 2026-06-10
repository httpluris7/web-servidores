import type { Metadata } from "next";
import { site } from "@/data/site";
import { regions } from "@/data/products";
import { PageHero } from "@/components/ui/PageHero";
import { EuropeMap } from "@/components/home/EuropeMap";
import { CtaBand } from "@/components/ui/CtaBand";
import { Reveal } from "@/components/ui/Reveal";
import { SectionHeader } from "@/components/ui/SectionHeader";

export const metadata: Metadata = {
  title: "Red y backbone",
  description: `Sistema autónomo ${site.network.asn} con ${site.network.peers}+ peers y ${site.network.capacityTbps} Tbps de capacidad. Peering directo en los IXP europeos de referencia.`,
  alternates: { canonical: "/red" },
};

const bigStats = [
  { v: site.network.asn, l: "Sistema autónomo" },
  { v: `${site.network.peers}+`, l: "Peers" },
  { v: `${site.network.capacityTbps} Tbps`, l: "Capacidad de red" },
  { v: `${site.network.portMaxGbps} Gbps`, l: "Puerto máximo" },
];

const peeringPoints = ["DE-CIX Fráncfort", "AMS-IX Ámsterdam", "LINX Londres", "ESPANIX Madrid"];

export default function NetworkPage() {
  return (
    <>
      <PageHero
        index="/01"
        kicker={`${site.network.asn} · backbone propio`}
        title={
          <>
            Una red que <span className="text-accent">controlamos</span>, de extremo a extremo.
          </>
        }
        description="Operamos nuestro propio sistema autónomo con peering directo en los puntos de intercambio europeos clave. Rutas más cortas, latencia menor y previsibilidad total."
      />

      {/* Stats grandes */}
      <section className="border-b border-[var(--color-line)]">
        <div className="container-edge grid gap-px bg-[var(--color-line)] sm:grid-cols-2 lg:grid-cols-4">
          {bigStats.map((s, i) => (
            <Reveal key={s.l} delay={i} className="bg-[var(--color-bg-base)] px-6 py-10">
              <div className="font-mono text-3xl font-semibold tracking-tight text-[var(--color-accent)] md:text-4xl">
                {s.v}
              </div>
              <p className="mono-label mt-3">{s.l}</p>
            </Reveal>
          ))}
        </div>
      </section>

      {/* Mapa + peering */}
      <section className="container-edge grid gap-12 py-20 md:grid-cols-2 md:items-center md:py-28">
        <Reveal>
          <SectionHeader
            index="/02"
            kicker="Cobertura"
            title="Presencia distribuida en Europa."
            description="Cada punto es una región con cómputo y mitigación local. Las líneas representan la interconexión de nuestro backbone."
          />
          <ul className="mt-8 space-y-3">
            {peeringPoints.map((p) => (
              <li key={p} className="flex items-center gap-3 font-mono text-sm text-[var(--color-fg-muted)]">
                <span className="text-[var(--color-accent)]">▸</span>
                {p}
              </li>
            ))}
          </ul>
          <div className="mt-8 flex flex-wrap gap-2">
            {regions.map((r) => (
              <span
                key={r.slug}
                className="rounded border border-[var(--color-line)] px-3 py-1.5 font-mono text-xs text-[var(--color-fg-muted)]"
              >
                {r.flag} {r.city}
              </span>
            ))}
          </div>
        </Reveal>
        <Reveal delay={1}>
          <EuropeMap />
        </Reveal>
      </section>

      {/* Compromisos de red */}
      <section className="border-t border-[var(--color-line)] bg-[var(--color-bg-raised)]">
        <div className="container-edge py-20 md:py-24">
          <SectionHeader index="/03" kicker="Compromisos" title="Lo que garantizamos." />
          <div className="mt-12 grid gap-px overflow-hidden rounded-[var(--radius-lg)] border border-[var(--color-line)] bg-[var(--color-line)] md:grid-cols-3">
            {[
              {
                t: "Sin overselling de puerto",
                d: "El ancho de banda contratado es capacidad real, no un máximo teórico compartido.",
              },
              {
                t: "Rutas optimizadas",
                d: "Peering directo en lugar de tránsito siempre que existe ruta. Menos saltos, menos latencia.",
              },
              {
                t: "Mitigación en el borde",
                d: "El tráfico de ataque se filtra antes de entrar a la red, no en tu servidor.",
              },
            ].map((c) => (
              <div key={c.t} className="bg-[var(--color-bg-raised)] p-7">
                <h3 className="text-lg font-semibold">{c.t}</h3>
                <p className="mt-2 text-sm text-[var(--color-fg-muted)]">{c.d}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      <CtaBand title="Despliega sobre nuestra red" />
    </>
  );
}
