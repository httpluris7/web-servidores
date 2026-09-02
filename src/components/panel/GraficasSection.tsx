import { useTranslations } from "next-intl";
import { MetricasPanel } from "@/components/servidores/MetricasPanel";
import { RrdCharts } from "./RrdCharts";
import { CARD_PAD, SECTION_INDEX } from "./ui";

/**
 * Sección "Gráficas" (Fase 4), en modo HÍBRIDO:
 *  - Con agente en el guest → `MetricasPanel` (CPU/RAM/swap/disco/red del agente,
 *    lo más rico; trae su propio encabezado y selector de rango).
 *  - Sin agente → gráficas RRD de Proxmox (CPU/memoria/red) con `RrdCharts`.
 */
export function GraficasSection({ id, agenteActivo }: { id: string; agenteActivo: boolean }) {
  const t = useTranslations("panel");
  return (
    <section id="graficas" className={`${CARD_PAD} scroll-mt-28`}>
      <p className={SECTION_INDEX}>/07</p>
      {agenteActivo ? (
        <div className="mt-3">
          <MetricasPanel id={id} ambito="cuenta" />
        </div>
      ) : (
        <>
          <h2 className="mt-2 text-lg font-semibold">{t("graficas.heading")}</h2>
          <p className="mt-1 mb-5 text-sm text-[var(--color-fg-muted)]">{t("graficas.introRrd")}</p>
          <RrdCharts id={id} />
        </>
      )}
    </section>
  );
}
