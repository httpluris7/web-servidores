import { useTranslations } from "next-intl";
import { bankRows } from "@/lib/bank";

/**
 * Datos para pagar por transferencia.
 *
 * Se usa en dos contextos con paletas distintas: la web (fondo oscuro) y la hoja
 * imprimible de la proforma (documento blanco), de ahí `variant`. Los datos y su
 * orden salen siempre de `lib/bank.ts`, así que no pueden divergir entre sitios.
 *
 * Sin `reference` (p. ej. justo al confirmar el pedido, cuando aún no se ha
 * emitido la proforma) se muestran los datos de la cuenta y se avisa de que el
 * número de referencia llegará por correo.
 */
export function BankTransfer({
  reference,
  amountLabel,
  variant = "site",
}: {
  reference?: string;
  amountLabel?: string;
  variant?: "site" | "document";
}) {
  const t = useTranslations("common");
  const rows = bankRows({ reference, amountLabel });
  const doc = variant === "document";

  const box = doc
    ? "rounded-[var(--radius-sm)] border border-[#c9d3e4] bg-[#f8fafc] px-5 py-4"
    : "rounded-[var(--radius-md)] border border-[var(--color-line-strong)] bg-[var(--color-bg-base)] px-5 py-4";
  const title = doc
    ? "text-[0.65rem] font-semibold uppercase tracking-wider text-[#8a93a6]"
    : "mono-label text-[0.6rem]";
  const label = doc ? "text-[#8a93a6]" : "text-[var(--color-fg-muted)]";
  const value = doc ? "text-[#0b0f17]" : "text-[var(--color-fg)]";
  const strong = doc ? "text-[#0b0f17]" : "text-[var(--color-accent)]";
  const note = doc ? "text-[#55607a]" : "text-[var(--color-fg-muted)]";

  return (
    <div className={box}>
      <p className={title}>{t("bankTransfer.title")}</p>
      <dl className="mt-3 grid gap-x-4 gap-y-1.5 text-sm sm:grid-cols-[auto_1fr]">
        {rows.map((r) => (
          <div key={r.key} className="contents">
            <dt className={`text-xs sm:pt-0.5 ${label}`}>{t(`bankTransfer.labels.${r.key}`)}</dt>
            {/* La referencia se destaca: es lo único que liga el ingreso al pedido. */}
            <dd
              className={
                r.key === "reference"
                  ? `font-mono text-base font-semibold break-words ${strong}`
                  : `font-mono text-sm break-words ${value}`
              }
            >
              {r.value}
            </dd>
          </div>
        ))}
      </dl>
      <p className={`mt-3 text-xs leading-relaxed ${note}`}>
        {reference
          ? t("bankTransfer.referenceNote", { reference })
          : t("bankTransfer.pendingReferenceNote")}
      </p>
    </div>
  );
}
