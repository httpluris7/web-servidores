import { site } from "@/data/site";
import { Counter } from "@/components/ui/Counter";
import { Reveal } from "@/components/ui/Reveal";

const stats = [
  {
    to: site.network.peers,
    suffix: "+",
    label: "Peers de red",
    context: "Interconexión directa en los principales IXP europeos para latencia mínima.",
  },
  {
    to: 10,
    suffix: " Gbps",
    label: "Por servidor",
    context: "Uplink garantizado sin overselling, desde el VPS más pequeño al bare metal.",
  },
  {
    to: site.ddos.mitigationTbps,
    suffix: " Tbps",
    label: "Mitigación DDoS",
    context: "Capacidad de filtrado siempre activa en el borde, incluida en cada plan.",
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
