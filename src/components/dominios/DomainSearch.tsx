"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { Price } from "@/components/ui/Price";

type Resultado = { name: string; tld: string; disponible: boolean; precioEur: number | null };

/**
 * Buscador de dominios (Fase 2). Consulta `/api/dominios/buscar`, que aplica el
 * margen sobre el precio de Njalla y devuelve solo el precio al cliente. Muestra
 * disponibilidad + precio/año. La contratación (carrito) llega en el paso siguiente.
 */
export function DomainSearch() {
  const t = useTranslations("dominios");
  const [q, setQ] = useState("");
  const [estado, setEstado] = useState<"idle" | "buscando" | "ok" | "error" | "vacio" | "off">("idle");
  const [label, setLabel] = useState("");
  const [resultados, setResultados] = useState<Resultado[]>([]);

  async function buscar(e: React.FormEvent) {
    e.preventDefault();
    const termino = q.trim();
    if (!termino) return;
    setEstado("buscando");
    setResultados([]);
    try {
      const res = await fetch(`/api/dominios/buscar?q=${encodeURIComponent(termino)}`);
      const j = await res.json().catch(() => null);
      if (res.status === 503) {
        setEstado("off");
        return;
      }
      if (!res.ok || !j?.ok) {
        setEstado("error");
        return;
      }
      setLabel(j.label);
      setResultados(j.resultados as Resultado[]);
      setEstado((j.resultados as Resultado[]).length ? "ok" : "vacio");
    } catch {
      setEstado("error");
    }
  }

  const input =
    "min-w-0 flex-1 rounded-[var(--radius-md)] border border-[var(--color-line-strong)] bg-[var(--color-bg-base)] px-4 py-3 text-sm placeholder:text-[var(--color-fg-dim)] focus:border-[var(--color-accent)] focus:outline-none";

  return (
    <div className="grid gap-6">
      <form onSubmit={buscar} className="flex flex-wrap gap-3">
        <input
          type="text"
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder={t("placeholder")}
          className={input}
          autoComplete="off"
          spellCheck={false}
        />
        <button
          type="submit"
          disabled={estado === "buscando" || !q.trim()}
          className="inline-flex min-h-11 items-center justify-center rounded-[var(--radius-md)] bg-[var(--color-accent)] px-6 text-sm font-medium text-black transition-opacity hover:opacity-90 disabled:opacity-40"
        >
          {estado === "buscando" ? t("searching") : t("searchButton")}
        </button>
      </form>

      {estado === "off" && <p className="text-sm text-[var(--color-fg-muted)]">{t("unconfigured")}</p>}
      {estado === "error" && <p role="alert" className="text-sm text-[var(--color-danger)]">{t("errorProvider")}</p>}
      {estado === "vacio" && <p className="text-sm text-[var(--color-fg-muted)]">{t("noResults")}</p>}

      {estado === "ok" && (
        <ul className="grid gap-3">
          {resultados.map((r) => (
            <li
              key={r.name}
              className="flex flex-wrap items-center justify-between gap-4 rounded-[var(--radius-lg)] border border-[var(--color-line)] bg-[var(--color-bg-raised)] p-4"
            >
              <span className="min-w-0 font-mono text-sm break-all text-[var(--color-fg)]">
                {r.name}
              </span>
              {r.disponible && r.precioEur != null ? (
                <span className="flex items-center gap-4">
                  <span className="text-sm">
                    <span className="font-semibold text-[var(--color-fg)]">
                      <Price value={r.precioEur} />
                    </span>
                    <span className="text-[var(--color-fg-muted)]"> {t("perYear")}</span>
                  </span>
                  <button
                    type="button"
                    disabled
                    title={t("soon")}
                    className="inline-flex min-h-9 items-center rounded-[var(--radius-md)] border border-[var(--color-line-strong)] px-4 text-xs text-[var(--color-fg-muted)] disabled:opacity-50"
                  >
                    {t("addToCart")}
                  </button>
                </span>
              ) : (
                <span className="text-xs text-[var(--color-fg-dim)]">{t("taken")}</span>
              )}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
