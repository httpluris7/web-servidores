import { useTranslations } from "next-intl";
import type { PanelService } from "@/lib/panel/types";
import { CARD, SECTION_INDEX } from "./ui";

/** Fila etiqueta/valor, como en la tabla de información. */
function Row({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="grid grid-cols-1 gap-1 border-t border-[var(--color-line)] px-6 py-3.5 first:border-0 sm:grid-cols-[minmax(9rem,14rem)_1fr] sm:items-center sm:gap-4">
      <dt className="mono-label text-[0.6rem]">{label}</dt>
      <dd className="min-w-0 text-sm break-words text-[var(--color-fg)]">{children}</dd>
    </div>
  );
}

/**
 * Sección "Red" (Fase 6), informativa: interfaz de red de la VM (modelo, bridge,
 * límite de tasa, cortafuegos en la NIC) y nº de IPs. El detalle de cada IP está
 * en la tabla de IPs; reconfigurar la red pasa por soporte (aún no automatizado).
 */
export function RedSection({ service }: { service: PanelService }) {
  const t = useTranslations("panel");
  const dash = <span className="text-[var(--color-fg-dim)]">—</span>;
  return (
    <section id="red" className={`${CARD} scroll-mt-28`}>
      <div className="px-6 pt-6">
        <p className={SECTION_INDEX}>/11</p>
        <h2 className="mt-2 text-lg font-semibold">{t("red.heading")}</h2>
      </div>
      <dl className="mt-4">
        <Row label={t("red.model")}>
          {service.nicModel ? <span className="font-mono">{service.nicModel}</span> : dash}
        </Row>
        <Row label={t("red.bridge")}>
          {service.nicBridge ? <span className="font-mono">{service.nicBridge}</span> : dash}
        </Row>
        <Row label={t("red.rate")}>
          {service.tasaRedMbps != null ? (
            <span className="font-mono">{service.tasaRedMbps} Mbps</span>
          ) : (
            <span className="text-[var(--color-fg-muted)]">{t("red.noLimit")}</span>
          )}
        </Row>
        <Row label={t("red.nicFirewall")}>
          <span className={service.nicFirewall ? "text-[var(--color-accent)]" : "text-[var(--color-fg-muted)]"}>
            {service.nicFirewall ? t("red.on") : t("red.off")}
          </span>
        </Row>
        <Row label={t("info.numIps")}>
          <span className="font-mono">{service.ips.length}</span>
        </Row>
      </dl>
    </section>
  );
}
