import type { Metadata } from "next";
import { site } from "@/data/site";
import { PageHero } from "@/components/ui/PageHero";
import { CtaBand } from "@/components/ui/CtaBand";
import { Reveal } from "@/components/ui/Reveal";
import { SectionHeader } from "@/components/ui/SectionHeader";

export const metadata: Metadata = {
  title: "Sobre nosotros",
  description: `${site.brand} es un proveedor europeo de hosting con red propia (${site.network.asn}), centrado en provisioning instantáneo, hardware sin overselling y mitigación DDoS incluida.`,
  alternates: { canonical: "/sobre-nosotros" },
};

const principles = [
  {
    t: "Sin overselling",
    d: "Lo que contratas existe físicamente y está reservado para ti. Sin máximos teóricos ni vecinos ruidosos.",
  },
  {
    t: "Automatización primero",
    d: "Desde el provisioning hasta la mitigación, el sistema actúa solo. El soporte humano es para lo que importa.",
  },
  {
    t: "Red propia",
    d: `Operamos nuestro sistema autónomo ${site.network.asn} y peering directo, no revendemos la red de otro.`,
  },
  {
    t: "Precios honestos",
    d: "Facturación mensual, sin cuotas de alta ni permanencia. La protección DDoS va incluida, no como extra.",
  },
];

export default function AboutPage() {
  return (
    <>
      <PageHero
        index="/01"
        kicker="Sobre nosotros"
        title={
          <>
            Infraestructura europea, <span className="text-accent">sin letra pequeña</span>.
          </>
        }
        description={`${site.brand} nace para que desplegar un servidor sea tan rápido como debería: segundos, no días. Red propia, hardware real y una sola promesa cumplida cada vez.`}
      />

      {/* TODO: sustituir por la historia real de la empresa, hitos y equipo. */}
      <section className="container-edge py-14 md:py-28">
        <SectionHeader index="/02" kicker="Cómo trabajamos" title="Cuatro principios, sin excepciones." />
        <div className="mt-12 grid gap-px overflow-hidden rounded-[var(--radius-lg)] border border-[var(--color-line)] bg-[var(--color-line)] sm:grid-cols-2">
          {principles.map((p) => (
            <Reveal key={p.t} className="bg-[var(--color-bg-base)] p-8">
              <h3 className="text-xl font-semibold">{p.t}</h3>
              <p className="mt-2 text-sm leading-relaxed text-[var(--color-fg-muted)]">{p.d}</p>
            </Reveal>
          ))}
        </div>

        <Reveal className="mt-16">
          <div className="rounded-[var(--radius-lg)] border border-[var(--color-line)] bg-[var(--color-bg-raised)] p-8">
            <span className="mono-label">Datos de la empresa</span>
            <dl className="mt-6 grid gap-4 font-mono text-sm sm:grid-cols-2">
              <div>
                <dt className="text-[var(--color-fg-dim)]">Razón social</dt>
                <dd className="mt-1">{site.legal.companyName}</dd>
              </div>
              <div>
                <dt className="text-[var(--color-fg-dim)]">Constitución</dt>
                <dd className="mt-1">{site.legal.jurisdiction}</dd>
              </div>
              <div>
                <dt className="text-[var(--color-fg-dim)]">EIN / Registro fiscal</dt>
                <dd className="mt-1">{site.legal.taxId}</dd>
              </div>
              <div>
                <dt className="text-[var(--color-fg-dim)]">Sistema autónomo</dt>
                <dd className="mt-1 text-[var(--color-accent)]">{site.network.asn}</dd>
              </div>
              <div className="sm:col-span-2">
                <dt className="text-[var(--color-fg-dim)]">Dirección registrada</dt>
                <dd className="mt-1">{site.legal.address}</dd>
              </div>
            </dl>
            <p className="mt-6 text-xs text-[var(--color-fg-dim)]">
              {/* TODO: confirmar todos los datos legales con el cliente antes de publicar. */}
              Datos provisionales pendientes de confirmación del cliente.
            </p>
          </div>
        </Reveal>
      </section>

      <CtaBand title="Únete a quienes ya despliegan con nosotros" />
    </>
  );
}
