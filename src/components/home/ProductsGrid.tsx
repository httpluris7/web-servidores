import Link from "next/link";
import { vps, dedicatedTypes } from "@/data/products";
import { eur } from "@/lib/utils";
import { SectionHeader } from "@/components/ui/SectionHeader";
import { Reveal } from "@/components/ui/Reveal";

const cards = [
  {
    n: "/01",
    title: "Cloud VPS",
    tagline: "Máquinas NVMe listas en 60 s.",
    specs: ["2–16 vCore AMD EPYC", "NVMe Gen4 en todos los planes", "10 Gbps + DDoS incluido"],
    priceFrom: Math.min(...vps.plans.map((p) => p.price)),
    href: "/vps",
  },
  {
    n: "/02",
    title: "Dedicado 10 Gbps",
    tagline: "Bare metal para saturar la red.",
    specs: ["EPYC hasta 192 hilos", "Puerto de 10 Gbps dedicado", "IPMI/KVM fuera de banda"],
    priceFrom: Math.min(...(dedicatedTypes.find((d) => d.slug === "10gbps")?.plans.map((p) => p.price) ?? [0])),
    href: "/dedicados/10gbps",
  },
  {
    n: "/03",
    title: "Storage Server",
    tagline: "Capacidad masiva, coste por TB mínimo.",
    specs: ["Hasta 360 TB por nodo", "Caché NVMe para lecturas", "Backup, archivo y data lakes"],
    priceFrom: Math.min(...(dedicatedTypes.find((d) => d.slug === "storage")?.plans.map((p) => p.price) ?? [0])),
    href: "/dedicados/storage",
  },
];

export function ProductsGrid() {
  return (
    <section className="container-edge py-24 md:py-32">
      <SectionHeader
        index="/05"
        kicker="Productos"
        title="Elige tu punto de partida."
        description="Tres líneas de cómputo sobre la misma red y la misma protección. Empieza pequeño y escala sin migrar."
      />

      <div className="mt-12 grid gap-5 md:grid-cols-3">
        {cards.map((c, i) => (
          <Reveal key={c.title} delay={i} as="article">
            <Link
              href={c.href}
              className="group flex h-full flex-col rounded-[var(--radius-lg)] border border-[var(--color-line)] bg-[var(--color-bg-raised)] p-6 transition-all duration-300 hover:border-[var(--color-accent)] hover:bg-[var(--color-bg-overlay)]"
            >
              <div className="flex items-center justify-between">
                <span className="font-mono text-sm text-[var(--color-accent)]">{c.n}</span>
                <span className="font-mono text-sm text-[var(--color-fg-dim)] transition-transform duration-300 group-hover:translate-x-1 group-hover:text-[var(--color-accent)]">
                  →
                </span>
              </div>

              <h3 className="mt-6 text-2xl font-semibold tracking-tight">{c.title}</h3>
              <p className="mt-1 text-sm text-[var(--color-fg-muted)]">{c.tagline}</p>

              <ul className="mt-6 space-y-2.5 text-sm">
                {c.specs.map((s) => (
                  <li key={s} className="flex items-start gap-2 text-[var(--color-fg-muted)]">
                    <span className="mt-0.5 text-[var(--color-accent)]">▸</span>
                    {s}
                  </li>
                ))}
              </ul>

              <div className="mt-auto pt-8">
                <span className="mono-label block text-[0.65rem]">Desde</span>
                <span className="font-mono text-3xl font-semibold tracking-tight">
                  {eur(c.priceFrom)}
                  <span className="text-base text-[var(--color-fg-muted)]">/mes</span>
                </span>
              </div>
            </Link>
          </Reveal>
        ))}
      </div>

      <div className="mt-10">
        <Link
          href="/vps"
          className="font-mono text-sm text-[var(--color-accent)] transition-opacity hover:opacity-80"
        >
          Ver todos los productos →
        </Link>
      </div>
    </section>
  );
}
