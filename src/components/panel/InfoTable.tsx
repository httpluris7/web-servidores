import { useLocale, useTranslations } from "next-intl";
import type { PanelService } from "@/lib/panel/types";
import { CopyValue } from "./CopyValue";
import { UsageBar } from "./UsageBar";
import { formatDate, formatUptime, usagePct, usageText } from "./format";
import { CARD, SECTION_INDEX } from "./ui";

/** Una fila de la tabla de información: etiqueta a la izquierda, valor a la derecha. */
function Row({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="grid grid-cols-1 gap-1 border-t border-[var(--color-line)] px-6 py-3.5 first:border-0 sm:grid-cols-[minmax(9rem,14rem)_1fr] sm:items-center sm:gap-4">
      <dt className="mono-label text-[0.6rem]">{label}</dt>
      <dd className="min-w-0 text-sm break-words text-[var(--color-fg)]">{children}</dd>
    </div>
  );
}

/**
 * Tabla "Información": el estado técnico completo del servidor. La contraseña va
 * enmascarada con botón de copiar; CPU/memoria/swap/disco/ancho de banda se
 * muestran como barras "usado / límite".
 */
export function InfoTable({ service }: { service: PanelService }) {
  const t = useTranslations("panel");
  const locale = useLocale();

  const power = (
    <span className="inline-flex items-center gap-2">
      <span
        className={`inline-block h-2 w-2 rounded-full ${
          service.power === "encendido"
            ? "bg-[var(--color-accent)]"
            : service.power === "suspendido"
              ? "bg-[var(--color-danger)]"
              : "bg-[var(--color-fg-dim)]"
        }`}
      />
      {t(`info.powerState.${service.power}`)}
    </span>
  );

  return (
    <section id="informacion" className={`${CARD} scroll-mt-28`}>
      <div className="flex items-baseline justify-between gap-4 px-6 pt-6">
        <div>
          <p className={SECTION_INDEX}>/04</p>
          <h2 className="mt-2 text-lg font-semibold">{t("info.heading")}</h2>
        </div>
      </div>
      <dl className="mt-4">
        <Row label={t("info.estado")}>{power}</Row>
        <Row label={t("info.nodo")}>
          <span className="font-mono">{service.nodo}</span>
        </Row>
        <Row label={t("info.nombre")}>
          <span className="font-mono">{service.nombre}</span>
        </Row>
        <Row label={t("info.password")}>
          <CopyValue value={service.password} secret />
        </Row>
        <Row label={t("info.uptime")}>
          <span className="font-mono">{formatUptime(service.uptimeSec)}</span>
        </Row>
        <Row label={t("info.creado")}>{formatDate(service.creadoAt, locale)}</Row>
        <Row label={t("info.descripcion")}>
          <span className="flex flex-wrap items-center gap-2">
            {service.descripcion}
            <span className="text-xs text-[var(--color-fg-dim)]">· {t("info.editHint")}</span>
          </span>
        </Row>
        <Row label={`${t("info.cpu")} (${service.cores} ${t("info.cores")})`}>
          <UsageBar pct={usagePct(service.cpu)} text={usageText(service.cpu)} />
        </Row>
        <Row label={t("info.memoria")}>
          <UsageBar pct={usagePct(service.memoria)} text={usageText(service.memoria)} />
        </Row>
        <Row label={t("info.swap")}>
          <UsageBar pct={usagePct(service.swap)} text={usageText(service.swap)} />
        </Row>
        <Row label={t("info.disco")}>
          <UsageBar pct={usagePct(service.disco)} text={usageText(service.disco)} />
        </Row>
        <Row label={t("info.backupsLimite")}>
          <span className="font-mono">{service.backupsLimite}</span>
        </Row>
        <Row label={t("info.tasaRed")}>
          <span className="font-mono">{service.tasaRedMbps} Mbps</span>
        </Row>
        <Row label={t("info.numIps")}>
          <span className="font-mono">{service.ips.length}</span>
        </Row>
        <Row label={t("info.iso")}>
          {service.iso ? <span className="font-mono">{service.iso}</span> : <span className="text-[var(--color-fg-dim)]">{t("info.none")}</span>}
        </Row>
        <Row label={t("info.ordenArranque")}>
          <span className="font-mono">{service.ordenArranque}</span>
        </Row>
        <Row label={t("info.anchoBanda")}>
          <UsageBar pct={usagePct(service.anchoBanda)} text={usageText(service.anchoBanda)} />
        </Row>
      </dl>
    </section>
  );
}
