import type { Metadata } from "next";
import { site } from "@/data/site";
import { regions } from "@/data/products";
import { PageHero } from "@/components/ui/PageHero";
import { EuropeMap } from "@/components/home/EuropeMap";
import { CtaBand } from "@/components/ui/CtaBand";
import { Reveal } from "@/components/ui/Reveal";
import { SectionHeader } from "@/components/ui/SectionHeader";

export const metadata: Metadata = {
  title: "Network and backbone",
  description: `Autonomous system ${site.network.asn} with ${site.network.peers}+ peers and ${site.network.capacityTbps} Tbps of capacity. Direct peering at Europe's leading IXPs.`,
  alternates: { canonical: "/red" },
};

const bigStats = [
  { v: site.network.asn, l: "Autonomous system" },
  { v: `${site.network.peers}+`, l: "Peers" },
  { v: `${site.network.capacityTbps} Tbps`, l: "Network capacity" },
  { v: `${site.network.portMaxGbps} Gbps`, l: "Maximum port" },
];

const peeringPoints = ["DE-CIX Frankfurt", "AMS-IX Amsterdam", "LINX London", "ESPANIX Madrid"];

export default function NetworkPage() {
  return (
    <>
      <PageHero
        index="/01"
        kicker={`${site.network.asn} · our own backbone`}
        title={
          <>
            A network we <span className="text-accent">control</span>, end to end.
          </>
        }
        description="We operate our own autonomous system with direct peering at key European exchange points. Shorter routes, lower latency and total predictability."
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
      <section className="container-edge grid gap-12 py-14 md:py-20 md:grid-cols-2 md:items-center md:py-28">
        <Reveal>
          <SectionHeader
            index="/02"
            kicker="Coverage"
            title="Distributed presence across Europe."
            description="Each point is a region with local compute and mitigation. The lines represent the interconnection of our backbone."
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
        <div className="container-edge py-14 md:py-24">
          <SectionHeader index="/03" kicker="Commitments" title="What we guarantee." />
          <div className="mt-12 grid gap-px overflow-hidden rounded-[var(--radius-lg)] border border-[var(--color-line)] bg-[var(--color-line)] md:grid-cols-3">
            {[
              {
                t: "No port overselling",
                d: "The bandwidth you order is real capacity, not a shared theoretical maximum.",
              },
              {
                t: "Optimized routes",
                d: "Direct peering instead of transit whenever a route exists. Fewer hops, lower latency.",
              },
              {
                t: "Edge mitigation",
                d: "Attack traffic is filtered before it enters the network, not on your server.",
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

      <CtaBand title="Deploy on our network" />
    </>
  );
}
