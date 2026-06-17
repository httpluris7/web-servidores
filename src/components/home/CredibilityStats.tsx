import { getTranslations } from "next-intl/server";
import { site } from "@/data/site";
import { Counter } from "@/components/ui/Counter";
import { Reveal } from "@/components/ui/Reveal";

const stats = [
  { to: site.network.peers, suffix: "+" },
  { to: 10, suffix: " Gbps" },
  { to: site.ddos.mitigationTbps, suffix: " Tbps" },
];

export async function CredibilityStats() {
  const t = await getTranslations("home");
  return (
    <section className="border-y border-[var(--color-line)]">
      <div className="container-edge grid gap-px bg-[var(--color-line)] md:grid-cols-3">
        {stats.map((s, i) => (
          <Reveal
            key={i}
            delay={i}
            className="bg-[var(--color-bg-base)] px-2 py-12 md:px-8"
          >
            <div className="flex items-baseline gap-1 font-mono text-5xl font-semibold tracking-tight text-[var(--color-fg)] md:text-6xl">
              <Counter to={s.to} suffix={s.suffix} />
            </div>
            <p className="mono-label mt-3">{t(`credibilityStats.${i}.label`)}</p>
            <p className="mt-2 max-w-xs text-sm text-[var(--color-fg-muted)]">{t(`credibilityStats.${i}.context`)}</p>
          </Reveal>
        ))}
      </div>
    </section>
  );
}
