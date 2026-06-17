import { getTranslations } from "next-intl/server";
import { Link } from "@/i18n/navigation";
import { site } from "@/data/site";
import { Reveal } from "@/components/ui/Reveal";
import { EuropeMap } from "./EuropeMap";

export async function NetworkBackbone() {
  const t = await getTranslations("home");
  const miniStats = [
    { value: `${site.network.peers}+`, label: t("networkBackbone.stats.peers") },
    { value: `${site.network.capacityTbps} Tbps`, label: t("networkBackbone.stats.capacity") },
    { value: site.network.rankingNote, label: t("networkBackbone.stats.ranking") },
    { value: `${site.network.portMaxGbps} Gbps`, label: t("networkBackbone.stats.maxPort") },
  ];
  return (
    <section className="border-y border-[var(--color-line)] bg-[var(--color-bg-raised)]">
      <div className="container-edge grid gap-12 py-16 md:py-24 md:grid-cols-2 md:items-center md:py-32">
        {/* Izquierda: copy + stats */}
        <Reveal>
          <span className="inline-block rounded border border-[var(--color-line)] px-2.5 py-1 font-mono text-xs text-[var(--color-accent)]">
            {site.network.asn}
          </span>
          <h2 className="mt-6 text-balance text-3xl font-semibold leading-tight tracking-tight sm:text-4xl md:text-5xl">
            {t("networkBackbone.title")}
          </h2>
          <p className="mt-5 max-w-md text-base text-[var(--color-fg-muted)] md:text-lg">
            {t("networkBackbone.description")}
          </p>

          <dl className="mt-10 grid grid-cols-2 gap-px overflow-hidden rounded-[var(--radius-lg)] border border-[var(--color-line)] bg-[var(--color-line)]">
            {miniStats.map((s) => (
              <div key={s.label} className="bg-[var(--color-bg-raised)] px-5 py-4">
                <dt className="mono-label text-[0.65rem]">{s.label}</dt>
                <dd className="mt-1 font-mono text-xl text-[var(--color-fg)]">{s.value}</dd>
              </div>
            ))}
          </dl>

          <Link
            href="/red"
            className="mt-8 inline-block font-mono text-sm text-[var(--color-accent)] hover:opacity-80"
          >
            {t("networkBackbone.viewNetwork")}
          </Link>
        </Reveal>

        {/* Derecha: mapa */}
        <Reveal delay={1} className="relative">
          <div className="pointer-events-none absolute inset-0 -z-10 grid-lines opacity-30" aria-hidden="true" />
          <EuropeMap />
        </Reveal>
      </div>
    </section>
  );
}
