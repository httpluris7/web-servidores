"use client";

import { useId, useState, useTransition } from "react";
import { useSearchParams } from "next/navigation";
import { useTranslations } from "next-intl";
import { usePathname, useRouter } from "@/i18n/navigation";
import {
  invoiceFilterQuery,
  invoiceZipName,
  type InvoiceDateField,
  type InvoiceFilter,
  type InvoiceFilterState,
} from "@/lib/facturas-filtro";

type Props = {
  /** Filtro ya aplicado (lo resuelve el servidor a partir de la URL). */
  filtro: InvoiceFilter;
  /** Nº de facturas que cumplen el filtro, para el botón de descarga. */
  resultados: number;
};

/** Fecha local en formato YYYY-MM-DD (lo que entiende `<input type="date">`). */
function iso(d: Date): string {
  const mes = String(d.getMonth() + 1).padStart(2, "0");
  const dia = String(d.getDate()).padStart(2, "0");
  return `${d.getFullYear()}-${mes}-${dia}`;
}

/** Rangos rápidos, calculados en la zona horaria del navegador. */
function rangos(hoy: Date): Record<string, { desde: string; hasta: string }> {
  const y = hoy.getFullYear();
  const m = hoy.getMonth();
  const trimestre = Math.floor(m / 3);
  // Trimestre anterior: si estamos en el primero, es el cuarto del año pasado.
  const tPrevY = trimestre === 0 ? y - 1 : y;
  const tPrevInicio = trimestre === 0 ? 9 : (trimestre - 1) * 3;
  return {
    thisMonth: { desde: iso(new Date(y, m, 1)), hasta: iso(new Date(y, m + 1, 0)) },
    lastMonth: { desde: iso(new Date(y, m - 1, 1)), hasta: iso(new Date(y, m, 0)) },
    lastQuarter: {
      desde: iso(new Date(tPrevY, tPrevInicio, 1)),
      hasta: iso(new Date(tPrevY, tPrevInicio + 3, 0)),
    },
    thisYear: { desde: iso(new Date(y, 0, 1)), hasta: iso(new Date(y, 11, 31)) },
  };
}

const PRESETS = ["thisMonth", "lastMonth", "lastQuarter", "thisYear"] as const;

/**
 * Filtro de facturas por rango de fechas y estado, con descarga en lote de la
 * selección. Cada cambio se refleja en la URL: la tabla de abajo la pinta el
 * servidor con ese mismo filtro, así que el zip contiene siempre lo que se ve.
 */
export function InvoiceFilters({ filtro, resultados }: Props) {
  const t = useTranslations("admin");
  const router = useRouter();
  const pathname = usePathname();
  const search = useSearchParams();
  const [pendiente, startTransition] = useTransition();
  const [descargando, setDescargando] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const uid = useId();

  function aplicar(cambios: Partial<InvoiceFilter>) {
    const siguiente = { ...filtro, ...cambios };
    setError(null);
    startTransition(() => {
      router.replace(`${pathname}${invoiceFilterQuery(siguiente)}`, { scroll: false });
    });
  }

  /**
   * La descarga no puede ser un enlace normal: si el lote pasa del tope o no
   * hay nada que descargar, el servidor responde JSON y el navegador se
   * comería el error mostrando una página en blanco.
   */
  async function descargar() {
    setDescargando(true);
    setError(null);
    try {
      const res = await fetch(`/api/admin/facturas/descargar?${search.toString()}`);
      if (!res.ok) {
        const data = await res.json().catch(() => null);
        setError(data?.error ?? t("facturas.filters.downloadError"));
        return;
      }
      const url = URL.createObjectURL(await res.blob());
      const a = document.createElement("a");
      a.href = url;
      // Con un blob no llega el `Content-Disposition` del servidor, así que el
      // nombre se recalcula aquí con la misma función que usa la ruta.
      a.download = invoiceZipName(filtro);
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
    } catch {
      setError(t("facturas.filters.downloadError"));
    } finally {
      setDescargando(false);
    }
  }

  const campoBase =
    "min-h-11 w-full rounded-[var(--radius-sm)] border border-[var(--color-line-strong)] bg-[var(--color-bg-base)] px-3 py-2 text-sm outline-none transition-colors focus:border-[var(--color-accent)] md:min-h-0";
  const chip =
    "inline-flex min-h-11 items-center rounded-[var(--radius-sm)] border border-[var(--color-line-strong)] px-3 py-2 text-xs transition-colors hover:border-[var(--color-accent)] hover:text-[var(--color-accent)] disabled:opacity-50 md:min-h-0 md:px-2.5 md:py-1";

  const hoy = new Date();
  const rango = rangos(hoy);

  return (
    <div className="rounded-[var(--radius-lg)] border border-[var(--color-line)] bg-[var(--color-bg-raised)] p-5 md:p-6">
      <h2 className="mono-label text-[0.6rem]">{t("facturas.filters.legend")}</h2>

      <div className="mt-4 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <div>
          <label htmlFor={`${uid}-desde`} className="mono-label text-[0.55rem]">
            {t("facturas.filters.from")}
          </label>
          <input
            id={`${uid}-desde`}
            type="date"
            value={filtro.desde ?? ""}
            max={filtro.hasta ?? undefined}
            onChange={(e) => aplicar({ desde: e.target.value || null })}
            className={`mt-1 ${campoBase}`}
          />
        </div>
        <div>
          <label htmlFor={`${uid}-hasta`} className="mono-label text-[0.55rem]">
            {t("facturas.filters.to")}
          </label>
          <input
            id={`${uid}-hasta`}
            type="date"
            value={filtro.hasta ?? ""}
            min={filtro.desde ?? undefined}
            onChange={(e) => aplicar({ hasta: e.target.value || null })}
            className={`mt-1 ${campoBase}`}
          />
        </div>
        <div>
          <label htmlFor={`${uid}-estado`} className="mono-label text-[0.55rem]">
            {t("facturas.filters.status")}
          </label>
          <select
            id={`${uid}-estado`}
            value={filtro.estado}
            onChange={(e) => aplicar({ estado: e.target.value as InvoiceFilterState })}
            className={`mt-1 ${campoBase}`}
          >
            <option value="todas">{t("facturas.filters.statusAll")}</option>
            <option value="pagada">{t("facturas.filters.statusPaid")}</option>
            <option value="pendiente">{t("facturas.filters.statusPending")}</option>
            <option value="cancelada">{t("facturas.filters.statusCancelled")}</option>
          </select>
        </div>
        <div>
          <label htmlFor={`${uid}-campo`} className="mono-label text-[0.55rem]">
            {t("facturas.filters.dateField")}
          </label>
          <select
            id={`${uid}-campo`}
            value={filtro.campo}
            onChange={(e) => aplicar({ campo: e.target.value as InvoiceDateField })}
            className={`mt-1 ${campoBase}`}
          >
            <option value="emision">{t("facturas.filters.dateIssued")}</option>
            <option value="pago">{t("facturas.filters.datePaid")}</option>
          </select>
          <p className="mt-1 text-[0.65rem] text-[var(--color-fg-dim)]">
            {t("facturas.filters.dateFieldHint")}
          </p>
        </div>
      </div>

      <div className="mt-4 flex flex-wrap items-center gap-1.5">
        <span className="mono-label mr-1 text-[0.55rem]">{t("facturas.filters.presets")}</span>
        {PRESETS.map((k) => {
          const r = rango[k]!;
          const activo = filtro.desde === r.desde && filtro.hasta === r.hasta;
          return (
            <button
              key={k}
              type="button"
              onClick={() => aplicar(r)}
              aria-pressed={activo}
              className={
                chip +
                (activo ? " border-[var(--color-accent)] text-[var(--color-accent)]" : "")
              }
            >
              {t(`facturas.filters.${k}`)}
            </button>
          );
        })}
        <button
          type="button"
          onClick={() => aplicar({ desde: null, hasta: null, estado: "todas", campo: "emision" })}
          className={chip + " text-[var(--color-fg-muted)]"}
        >
          {t("facturas.filters.clear")}
        </button>
      </div>

      <div className="mt-5 flex flex-wrap items-center justify-between gap-3 border-t border-[var(--color-line)] pt-4">
        <p className="text-xs text-[var(--color-fg-muted)]" aria-live="polite">
          {pendiente ? "…" : t("facturas.filters.results", { count: resultados })}
        </p>
        <div className="text-right">
          <button
            type="button"
            onClick={descargar}
            disabled={resultados === 0 || descargando || pendiente}
            className="inline-flex min-h-11 items-center rounded-[var(--radius-sm)] border border-[var(--color-accent)] px-4 py-2 text-sm font-medium text-[var(--color-accent)] transition-colors hover:bg-[var(--color-accent)]/10 disabled:opacity-40 md:min-h-0"
          >
            {descargando ? t("facturas.filters.preparing") : t("facturas.filters.download")}
          </button>
          <p className="mt-1 text-[0.65rem] text-[var(--color-fg-dim)]">
            {t("facturas.filters.downloadHint")}
          </p>
        </div>
      </div>

      {error && (
        <p role="alert" className="mt-2 text-xs text-[var(--color-danger)]">
          {error}
        </p>
      )}
    </div>
  );
}
