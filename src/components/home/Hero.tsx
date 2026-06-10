import { deployUrl, site } from "@/data/site";
import { Cta } from "@/components/ui/Cta";
import { LiveMetrics } from "./LiveMetrics";

export function Hero() {
  return (
    <section className="relative overflow-hidden">
      <div className="pointer-events-none absolute inset-0 grid-lines opacity-60" aria-hidden="true" />
      <div className="container-edge relative pb-10 pt-20 md:pt-28">
        {/* Kicker */}
        <div className="flex items-center gap-2">
          <span className="inline-block h-1.5 w-1.5 animate-pulse rounded-full bg-[var(--color-accent)]" />
          <span className="mono-label">
            {site.network.asn} · red propia en Europa · provisioning 60 s
          </span>
        </div>

        {/* Titular gigante */}
        <h1 className="mt-8 max-w-5xl text-balance font-semibold uppercase leading-[0.92] tracking-tight text-[clamp(2.6rem,9vw,8rem)]">
          Tu servidor,
          <br />
          en <span className="text-accent">60 segundos</span>.
        </h1>

        <p className="mt-8 max-w-xl text-lg text-[var(--color-fg-muted)] md:text-xl">
          VPS, bare metal y mitigación DDoS sobre red propia. NVMe Gen4, uplinks de 10 Gbps y
          presencia en seis regiones europeas. Sin esperas, sin sorpresas.
        </p>

        <div className="mt-10 flex flex-wrap gap-3">
          <Cta href={deployUrl()}>Desplegar en 60 segundos →</Cta>
          <Cta href="/vps" variant="secondary">
            Ver precios
          </Cta>
        </div>

        {/* Barra de métricas en vivo */}
        <LiveMetrics />

        {/* Indicador de scroll */}
        <div className="mt-14 flex items-center gap-3 text-[var(--color-fg-dim)]">
          <span className="flex h-9 w-5 items-start justify-center rounded-full border border-[var(--color-line-strong)] p-1">
            <span className="h-2 w-0.5 animate-bounce rounded-full bg-[var(--color-accent)]" />
          </span>
          <span className="font-mono text-xs uppercase tracking-widest">Scroll</span>
        </div>
      </div>
    </section>
  );
}
