import { partners } from "@/data/content";
import { Counter } from "@/components/ui/Counter";
import { Reveal } from "@/components/ui/Reveal";
import { Marquee } from "@/components/ui/Marquee";

const stats = [
  { to: 14000, suffix: "+", label: "Servidores activos" },
  { to: 99.99, decimals: 2, suffix: " %", label: "Uptime SLA" },
  { to: 6, suffix: "", label: "Regiones EU" },
  { to: 24, suffix: "/7", label: "Soporte" },
];

export function TrustSection() {
  return (
    <section className="container-edge py-16 md:py-28">
      <Reveal>
        <span className="mono-label">/10 — Confianza</span>
      </Reveal>

      <div className="mt-8 grid gap-px overflow-hidden rounded-[var(--radius-lg)] border border-[var(--color-line)] bg-[var(--color-line)] sm:grid-cols-2 lg:grid-cols-4">
        {stats.map((s, i) => (
          <Reveal key={s.label} delay={i} className="bg-[var(--color-bg-base)] px-6 py-8">
            <div className="font-mono text-4xl font-semibold tracking-tight md:text-5xl">
              <Counter to={s.to} decimals={s.decimals ?? 0} suffix={s.suffix} />
            </div>
            <p className="mono-label mt-3">{s.label}</p>
          </Reveal>
        ))}
      </div>

      {/* Marquee de partners de hardware/red */}
      <div className="mt-12">
        <p className="mono-label mb-6 text-center">Hardware y red de primer nivel</p>
        <Marquee duration={36}>
          {partners.map((p) => (
            <span
              key={p}
              className="mx-5 whitespace-nowrap font-mono text-base text-[var(--color-fg-dim)] transition-colors hover:text-[var(--color-fg-muted)] sm:mx-8 sm:text-lg"
            >
              {p}
            </span>
          ))}
        </Marquee>
      </div>
    </section>
  );
}
