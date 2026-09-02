"use client";

import { useCallback, useEffect, useState } from "react";
import { useLocale, useTranslations } from "next-intl";
import { GraficaSerie, PALETA } from "@/components/servidores/GraficaSerie";
import type { RrdPoint, RrdTimeframe } from "@/lib/provisioner/client";

const TIMEFRAMES: RrdTimeframe[] = ["hour", "day", "week", "month"];

/**
 * Gráficas desde las series RRD de Proxmox. Es el camino SIN agente: cubre CPU,
 * memoria y red (el hipervisor no ve el disco del guest en QEMU; eso lo aporta el
 * agente, y en ese caso el panel muestra `MetricasPanel` en su lugar). Dibuja con
 * `GraficaSerie` (SVG propio, sin dependencias).
 */
export function RrdCharts({ id }: { id: string }) {
  const t = useTranslations("panel");
  const locale = useLocale();
  const [tf, setTf] = useState<RrdTimeframe>("hour");
  const [points, setPoints] = useState<RrdPoint[] | null>(null);
  const [error, setError] = useState(false);

  const load = useCallback(
    async (timeframe: RrdTimeframe) => {
      setError(false);
      try {
        const res = await fetch(`/api/panel/servicios/${id}/rrd?timeframe=${timeframe}`);
        const j = await res.json().catch(() => null);
        if (j?.ok && Array.isArray(j.points)) setPoints(j.points as RrdPoint[]);
        else setError(true);
      } catch {
        setError(true);
      }
    },
    [id],
  );

  useEffect(() => {
    setPoints(null);
    void load(tf);
  }, [tf, load]);

  const validos = (points ?? []).filter((p) => p.time != null);
  const ts = validos.map((p) => p.time as number);
  const resolucion = tf === "hour" ? "min" : "hora";
  const comun = {
    ts,
    resolucion,
    locale,
    etiquetaVacia: t("graficas.empty"),
    etiquetaPico: t("graficas.peak"),
  } as const;

  const cpu = validos.map((p) => (p.cpu != null ? Math.round(p.cpu * 1000) / 10 : null));
  const mem = validos.map((p) =>
    p.mem != null && p.maxmem ? Math.round((p.mem / p.maxmem) * 1000) / 10 : null,
  );
  const rx = validos.map((p) => p.netin);
  const tx = validos.map((p) => p.netout);

  const tab = (activo: boolean) =>
    `min-h-8 rounded-[var(--radius-sm)] border px-3 text-xs transition-colors ${
      activo
        ? "border-[var(--color-accent)] text-[var(--color-accent)]"
        : "border-[var(--color-line-strong)] text-[var(--color-fg-muted)] hover:text-[var(--color-fg)]"
    }`;

  return (
    <div>
      <div className="mb-5 flex flex-wrap gap-1.5" role="group" aria-label={t("graficas.rangeLabel")}>
        {TIMEFRAMES.map((x) => (
          <button key={x} type="button" onClick={() => setTf(x)} className={tab(x === tf)}>
            {t(`graficas.tf.${x}`)}
          </button>
        ))}
      </div>

      {error ? (
        <p className="text-sm text-[var(--color-fg-dim)]">{t("graficas.error")}</p>
      ) : points === null ? (
        <div className="grid gap-6 md:grid-cols-2" aria-hidden="true">
          {Array.from({ length: 3 }).map((_, i) => (
            <span
              key={i}
              className="block h-40 animate-pulse rounded-[var(--radius-md)] bg-[var(--color-bg-overlay)]"
            />
          ))}
        </div>
      ) : ts.length === 0 ? (
        <p className="text-sm text-[var(--color-fg-dim)]">{t("graficas.empty")}</p>
      ) : (
        <div className="grid gap-6 md:grid-cols-2">
          <GraficaSerie
            {...comun}
            titulo={t("graficas.cpu")}
            unidad="pct"
            series={[{ clave: "cpu", nombre: t("graficas.cpu"), color: PALETA.verde, valores: cpu }]}
          />
          <GraficaSerie
            {...comun}
            titulo={t("graficas.mem")}
            unidad="pct"
            series={[{ clave: "mem", nombre: t("graficas.mem"), color: PALETA.azul, valores: mem }]}
          />
          <GraficaSerie
            {...comun}
            titulo={t("graficas.net")}
            unidad="bps"
            series={[
              { clave: "rx", nombre: t("graficas.netin"), color: PALETA.verde, valores: rx },
              { clave: "tx", nombre: t("graficas.netout"), color: PALETA.ambar, valores: tx },
            ]}
          />
        </div>
      )}
    </div>
  );
}
