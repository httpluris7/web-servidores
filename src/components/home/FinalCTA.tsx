import { getTranslations } from "next-intl/server";
import { deployUrl } from "@/data/site";
import { Cta } from "@/components/ui/Cta";
import { Reveal } from "@/components/ui/Reveal";
import { CityClocks } from "./CityClocks";

export async function FinalCTA() {
  const t = await getTranslations("home");
  return (
    <section className="relative overflow-hidden">
      <div className="pointer-events-none absolute inset-0 grid-lines opacity-50" aria-hidden="true" />
      <div
        className="pointer-events-none absolute inset-0"
        style={{
          background:
            "radial-gradient(60% 60% at 50% 100%, var(--color-accent-glow), transparent 70%)",
        }}
        aria-hidden="true"
      />
      <div className="container-edge relative flex min-h-[70vh] flex-col items-center justify-center py-16 md:py-28 text-center">
        <Reveal>
          <span className="mono-label">{t("finalCta.kicker")}</span>
        </Reveal>
        <Reveal delay={1}>
          <h2 className="mt-8 text-balance font-semibold uppercase leading-[0.95] tracking-tight text-[clamp(2.4rem,8vw,6.5rem)]">
            {t("finalCta.titleLine1")}
            <br />
            <span className="text-accent">{t("finalCta.titleWaiting")}</span>
          </h2>
        </Reveal>
        <Reveal delay={2}>
          <div className="mt-10 flex justify-center">
            <Cta href={deployUrl()} className="px-7 py-4 text-base">
              {t("finalCta.deploy")}
            </Cta>
          </div>
          <p className="mt-6 font-mono text-xs text-[var(--color-fg-muted)]">
            {t("finalCta.note")}
          </p>
        </Reveal>
      </div>

      <CityClocks />
    </section>
  );
}
