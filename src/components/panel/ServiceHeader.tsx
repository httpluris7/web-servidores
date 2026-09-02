import { useLocale, useTranslations } from "next-intl";
import { Price } from "@/components/ui/Price";
import type { PanelService } from "@/lib/panel/types";
import { formatDate } from "./format";
import { StatusBadge } from "./StatusBadge";
import { CARD_PAD } from "./ui";

/**
 * Cabecera del servicio: identidad (producto, plan, estado) a la izquierda y los
 * datos de facturación a la derecha (alta, importe recurrente en la divisa del
 * usuario, ciclo, próximo vencimiento y método de pago).
 */
export function ServiceHeader({ service }: { service: PanelService }) {
  const t = useTranslations("panel");
  const locale = useLocale();

  const facturacion: Array<{ label: string; value: React.ReactNode }> = [
    { label: t("header.since"), value: formatDate(service.altaAt, locale) },
    {
      label: t("header.amount"),
      value: (
        <>
          <Price value={service.importeEur} />
          <span className="text-[var(--color-fg-muted)]"> / {t(`header.cycles.${service.ciclo}`)}</span>
        </>
      ),
    },
    { label: t("header.nextDue"), value: formatDate(service.vencimientoAt, locale) },
    { label: t("header.method"), value: service.metodoPago },
  ];

  return (
    <section id="resumen" className={`${CARD_PAD} scroll-mt-28`}>
      <div className="flex flex-col gap-6 lg:flex-row lg:items-start lg:justify-between">
        <div className="min-w-0">
          <p className="mono-label text-[0.7rem]">{service.producto}</p>
          <h1 className="mt-2 text-2xl font-semibold break-words text-[var(--color-fg)]">
            {service.nombre}
          </h1>
          <div className="mt-3 flex flex-wrap items-center gap-3">
            <StatusBadge status={service.status} />
            <span className="font-mono text-xs text-[var(--color-fg-muted)]">
              {t("header.plan")}: <span className="text-[var(--color-fg)]">{service.plan}</span>
            </span>
          </div>
        </div>

        <dl className="grid grid-cols-2 gap-x-8 gap-y-4 sm:grid-cols-4 lg:min-w-[26rem]">
          {facturacion.map((f) => (
            <div key={f.label} className="min-w-0">
              <dt className="mono-label text-[0.6rem]">{f.label}</dt>
              <dd className="mt-1 text-sm break-words text-[var(--color-fg)]">{f.value}</dd>
            </div>
          ))}
        </dl>
      </div>
    </section>
  );
}
