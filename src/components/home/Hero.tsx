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
            {site.network.asn} · our own network in Europe · 60s provisioning
          </span>
        </div>

        {/* Titular gigante */}
        <h1 className="mt-8 max-w-5xl text-balance font-semibold uppercase leading-[0.92] tracking-tight text-[clamp(2.2rem,9vw,8rem)]">
          Your server,
          <br />
          in <span className="text-accent">60 seconds</span>.
        </h1>

        <p className="mt-8 max-w-xl text-lg text-[var(--color-fg-muted)] md:text-xl">
          VPS, bare metal and DDoS mitigation over our own network. NVMe Gen4, 10 Gbps uplinks and
          presence in strategic European regions. No waiting, no surprises.
        </p>

        <div className="mt-10 flex flex-wrap gap-3">
          <Cta href={deployUrl()}>Deploy in 60 seconds →</Cta>
          <Cta href="/vps" variant="secondary">
            View pricing
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
