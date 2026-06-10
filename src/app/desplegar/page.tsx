import type { Metadata } from "next";
import Link from "next/link";
import { vps, dedicatedTypes } from "@/data/products";
import { eur } from "@/lib/utils";
import { PageHero } from "@/components/ui/PageHero";
import { Reveal } from "@/components/ui/Reveal";
import { SectionHeader } from "@/components/ui/SectionHeader";

export const metadata: Metadata = {
  title: "Desplegar servidor",
  description: "Elige tu plan VPS o servidor dedicado y despliégalo en 60 segundos.",
  alternates: { canonical: "/desplegar" },
};

function PlanRow({
  id,
  name,
  spec,
  price,
}: {
  id: string;
  name: string;
  spec: string;
  price: number;
}) {
  return (
    <Link
      href={`/contratar/${id}`}
      className="group flex items-center justify-between gap-4 rounded-[var(--radius-md)] border border-[var(--color-line)] bg-[var(--color-bg-base)] p-4 transition-colors hover:border-[var(--color-accent)]"
    >
      <div>
        <span className="font-medium">{name}</span>
        <span className="mt-0.5 block font-mono text-xs text-[var(--color-fg-muted)]">{spec}</span>
      </div>
      <div className="flex items-center gap-3 text-right">
        <span className="font-mono text-lg">{eur(price)}</span>
        <span className="font-mono text-[var(--color-fg-dim)] transition-colors group-hover:text-[var(--color-accent)]">
          →
        </span>
      </div>
    </Link>
  );
}

export default function DeployPage() {
  return (
    <>
      <PageHero
        index="/ Deploy"
        kicker="Desplegar servidor"
        title={
          <>
            Elige tu plan y <span className="text-accent">despliégalo</span>.
          </>
        }
        description="Selecciona un plan para ir al checkout. Misma red, mismo NVMe Gen4 y la misma protección DDoS en todos."
      />

      <section className="container-edge py-16 md:py-20">
        {/* VPS */}
        <SectionHeader index="/01" kicker="Cloud VPS" title={vps.title} description={vps.tagline} />
        <div className="mt-8 grid gap-3 sm:grid-cols-2">
          {vps.plans.map((p, i) => (
            <Reveal key={p.id} delay={i % 2}>
              <PlanRow
                id={p.id}
                name={p.name}
                spec={`${p.cpu} · ${p.ram} · ${p.storage}`}
                price={p.price}
              />
            </Reveal>
          ))}
        </div>

        {/* Dedicados */}
        {dedicatedTypes.map((line, idx) => (
          <div key={line.slug} className="mt-14">
            <SectionHeader
              index={`/0${idx + 2}`}
              kicker={line.highlight}
              title={line.title}
              description={line.tagline}
            />
            <div className="mt-8 grid gap-3 sm:grid-cols-2">
              {line.plans.map((p, i) => (
                <Reveal key={p.id} delay={i % 2}>
                  <PlanRow
                    id={p.id}
                    name={p.name}
                    spec={`${p.cpu} · ${p.ram}`}
                    price={p.price}
                  />
                </Reveal>
              ))}
            </div>
          </div>
        ))}
      </section>
    </>
  );
}
