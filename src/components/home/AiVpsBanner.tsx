import { getTranslations } from "next-intl/server";
import { Link } from "@/i18n/navigation";
import { getAiVpsLine } from "@/data/products";
import { precioDesde } from "@/lib/utils";
import { Price } from "@/components/ui/Price";
import { Reveal } from "@/components/ui/Reveal";

/**
 * Banner del home que anuncia los AI Developer VPS (Claude Code + Codex
 * preinstalados). Precio "desde" del catálogo; lleva a `/ai-developer-vps`. Se
 * oculta solo (null) si la familia no está publicada.
 */
export async function AiVpsBanner() {
  const line = await getAiVpsLine();
  if (!line || line.plans.length === 0) return null;

  const t = await getTranslations("ai");
  const from = precioDesde(line.plans);

  return (
    <section className="container-edge py-10 md:py-12">
      <Reveal>
        <div className="mx-auto max-w-5xl overflow-hidden rounded-[var(--radius-lg)] border border-[var(--color-accent)]/40 bg-[var(--color-bg-raised)] p-6 md:p-8">
          <div className="flex flex-col gap-6 lg:flex-row lg:items-center lg:justify-between">
            <div className="flex items-start gap-4">
              <span className="mt-0.5 shrink-0 text-2xl leading-none" aria-hidden="true">🤖</span>
              <div className="min-w-0">
                <p className="mono-label text-[0.7rem] text-[var(--color-accent)]">{t("banner.kicker")}</p>
                <h2 className="mt-2 text-xl font-semibold sm:text-2xl">{t("banner.title")}</h2>
                <p className="mt-1.5 text-sm text-[var(--color-fg-muted)]">{t("banner.subtitle")}</p>
              </div>
            </div>

            <div className="flex shrink-0 items-center gap-5">
              <div>
                <span className="mono-label block text-[0.6rem]">{t("common.from")}</span>
                <span className="font-mono text-2xl font-semibold tracking-tight">
                  <Price value={from} />
                  <span className="text-sm text-[var(--color-fg-muted)]">{t("common.perMonth")}</span>
                </span>
              </div>
              <Link
                href="/ai-developer-vps"
                className="inline-flex shrink-0 items-center justify-center rounded-[var(--radius-md)] bg-[var(--color-accent)] px-6 py-3 text-sm font-medium text-black transition-colors hover:bg-[var(--color-accent-dim)]"
              >
                {t("banner.cta")} →
              </Link>
            </div>
          </div>
        </div>
      </Reveal>
    </section>
  );
}
