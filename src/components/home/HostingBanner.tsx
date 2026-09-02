import { getTranslations } from "next-intl/server";
import { Link } from "@/i18n/navigation";
import { getHostingLine } from "@/data/products";
import { precioDesde } from "@/lib/utils";
import { Price } from "@/components/ui/Price";
import { Reveal } from "@/components/ui/Reveal";

/**
 * Banner del home que anuncia el Hosting Web (cPanel). Muestra el precio "desde"
 * del catálogo y lleva a `/hosting`. Se oculta solo (null) si no hay planes de
 * hosting publicados, para no anunciar algo que no se puede contratar.
 */
export async function HostingBanner() {
  const line = await getHostingLine();
  if (!line || line.plans.length === 0) return null;

  const t = await getTranslations("hosting");
  const from = precioDesde(line.plans);

  return (
    <section className="container-edge py-10 md:py-12">
      <Reveal>
        <div className="mx-auto max-w-5xl overflow-hidden rounded-[var(--radius-lg)] border border-[var(--color-accent)]/25 bg-[var(--color-bg-raised)] p-6 md:p-8">
          <div className="flex flex-col gap-6 lg:flex-row lg:items-center lg:justify-between">
            <div className="flex items-start gap-4">
              <svg
                width="26"
                height="26"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="1.6"
                className="mt-0.5 shrink-0 text-[var(--color-accent)]"
                aria-hidden="true"
              >
                <rect x="3" y="4" width="18" height="16" rx="2" />
                <path d="M3 9h18" />
                <path d="M6.5 6.5h.01M9 6.5h.01" />
              </svg>
              <div className="min-w-0">
                <p className="mono-label text-[0.7rem] text-[var(--color-accent)]">{t("banner.kicker")}</p>
                <h2 className="mt-2 text-xl font-semibold sm:text-2xl">{t("banner.title")}</h2>
                <p className="mt-1.5 text-sm text-[var(--color-fg-muted)]">{t("banner.subtitle")}</p>
              </div>
            </div>

            <div className="flex shrink-0 items-center gap-5">
              <div>
                <span className="mono-label block text-[0.6rem]">{t("banner.from")}</span>
                <span className="font-mono text-2xl font-semibold tracking-tight">
                  <Price value={from} />
                  <span className="text-sm text-[var(--color-fg-muted)]">{t("banner.perMonth")}</span>
                </span>
              </div>
              <Link
                href="/hosting"
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
