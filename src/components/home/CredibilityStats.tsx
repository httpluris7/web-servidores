import { site } from "@/data/site";
import { Counter } from "@/components/ui/Counter";
import { Reveal } from "@/components/ui/Reveal";

const stats = [
  {
    to: site.network.peers,
    suffix: "+",
    label: "Network peers",
    context: "Direct interconnection at the leading European IXPs for minimal latency.",
  },
  {
    to: 10,
    suffix: " Gbps",
    label: "Per server",
    context: "Guaranteed uplink with no overselling, from the smallest VPS to bare metal.",
  },
  {
    to: site.ddos.mitigationTbps,
    suffix: " Tbps",
    label: "DDoS Mitigation",
    context: "Always-on filtering capacity at the edge, included in every plan.",
  },
];

export function CredibilityStats() {
  return (
    <section className="border-y border-[var(--color-line)]">
      <div className="container-edge grid gap-px bg-[var(--color-line)] md:grid-cols-3">
        {stats.map((s, i) => (
          <Reveal
            key={s.label}
            delay={i}
            className="bg-[var(--color-bg-base)] px-2 py-12 md:px-8"
          >
            <div className="flex items-baseline gap-1 font-mono text-5xl font-semibold tracking-tight text-[var(--color-fg)] md:text-6xl">
              <Counter to={s.to} suffix={s.suffix} />
            </div>
            <p className="mono-label mt-3">{s.label}</p>
            <p className="mt-2 max-w-xs text-sm text-[var(--color-fg-muted)]">{s.context}</p>
          </Reveal>
        ))}
      </div>
    </section>
  );
}
