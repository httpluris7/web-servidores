import { useTranslations } from "next-intl";
import { Price } from "@/components/ui/Price";
import type { TarifaTld } from "@/lib/domains/tarifas";

/**
 * Rejilla "Cuánto cuesta un dominio": tarjetas por TLD con su precio (alta =
 * renovación, Njalla es de precio plano). Adaptada al tema oscuro del sitio.
 */
export function TldGrid({ tarifas }: { tarifas: TarifaTld[] }) {
  const t = useTranslations("dominios");
  if (tarifas.length === 0) return null;

  return (
    <section className="mt-20">
      <h2 className="text-center text-2xl font-semibold sm:text-3xl">{t("pricing.heading")}</h2>
      <div className="mx-auto mt-3 h-px w-16 bg-[var(--color-accent)]" />

      <div className="mt-10 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {tarifas.map((x) => (
          <div
            key={x.tld}
            className="rounded-[var(--radius-lg)] border border-[var(--color-line)] bg-[var(--color-bg-raised)] p-7 text-center transition-colors hover:border-[var(--color-accent)]"
          >
            <p className="font-mono text-3xl font-semibold text-[var(--color-accent)]">.{x.tld}</p>
            <p className="mt-5 text-2xl font-semibold text-[var(--color-fg)]">
              <Price value={x.precioEur} />
              <span className="text-sm font-normal text-[var(--color-fg-muted)]"> {t("perYear")}</span>
            </p>
            <p className="mt-1.5 text-xs text-[var(--color-fg-dim)]">
              {t("pricing.renewal")} <Price value={x.precioEur} /> {t("perYear")}
            </p>
          </div>
        ))}
      </div>

      <p className="mt-8 text-center text-xs text-[var(--color-fg-dim)]">{t("pricing.note")}</p>
    </section>
  );
}
