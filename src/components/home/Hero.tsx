import { getTranslations } from "next-intl/server";
import { deployUrl, site } from "@/data/site";
import { Cta } from "@/components/ui/Cta";
import { LiveMetrics } from "./LiveMetrics";

export async function Hero() {
  const t = await getTranslations("home");
  return (
    <section className="relative overflow-hidden">
      <div className="pointer-events-none absolute inset-0 grid-lines opacity-60" aria-hidden="true" />
      <div className="container-edge relative pb-10 pt-20 md:pt-28">
        {/* Kicker */}
        <div className="flex items-center gap-2">
          <span className="inline-block h-1.5 w-1.5 animate-pulse rounded-full bg-[var(--color-accent)]" />
          <span className="mono-label">
            {t("hero.kicker", { asn: site.network.asn })}
          </span>
        </div>

        {/* Titular gigante */}
        <h1 className="mt-8 max-w-5xl text-balance font-semibold uppercase leading-[0.92] tracking-tight text-[clamp(2.2rem,9vw,8rem)]">
          {t("hero.titleLine1")}
          <br />
          {t("hero.titleIn")} <span className="text-accent">{t("hero.title60s")}</span>.
        </h1>

        <p className="mt-8 max-w-xl text-lg text-[var(--color-fg-muted)] md:text-xl">
          {t("hero.description")}
        </p>

        <div className="mt-10 flex flex-wrap gap-3">
          <Cta href={deployUrl()}>{t("hero.deploy")}</Cta>
          <Cta href="/vps" variant="secondary">
            {t("hero.viewPricing")}
          </Cta>
        </div>

        {/* Barra de métricas en vivo */}
        <LiveMetrics />

        {/* Indicador de scroll */}
        <div className="mt-14 flex items-center gap-3 text-[var(--color-fg-dim)]">
          <span className="flex h-9 w-5 items-start justify-center rounded-full border border-[var(--color-line-strong)] p-1">
            <span className="h-2 w-0.5 animate-bounce rounded-full bg-[var(--color-accent)]" />
          </span>
          <span className="font-mono text-xs uppercase tracking-widest">{t("hero.scroll")}</span>
        </div>
      </div>
    </section>
  );
}
