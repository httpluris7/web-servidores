"use client";

import { useEffect, useState } from "react";
import { useTranslations } from "next-intl";
import { CARD, SECTION_INDEX } from "./ui";

type Plantilla = { slug: string; label: string; familia: "linux" | "windows"; minDiscoGb: number; ofertable: boolean; cabe: boolean; actual: boolean };

/**
 * Sección "Plantillas": sistemas operativos con plantilla en el centro de datos
 * del servidor. Marca el instalado y, para los que caben en el disco, ofrece
 * saltar a "Reinstalación" con ese SO preseleccionado (evento `panel:reinstalar`).
 */
export function PlantillasSection({ id, diskGb }: { id: string; diskGb: number | null }) {
  const t = useTranslations("panel");
  const [lista, setLista] = useState<Plantilla[] | null>(null);

  useEffect(() => {
    let vivo = true;
    fetch(`/api/panel/servicios/${id}/plantillas`)
      .then((r) => r.json())
      .then((j) => {
        if (vivo) setLista(j?.ok ? (j.plantillas as Plantilla[]) : []);
      })
      .catch(() => {
        if (vivo) setLista([]);
      });
    return () => {
      vivo = false;
    };
  }, [id]);

  function reinstalar(slug: string) {
    window.dispatchEvent(new CustomEvent("panel:reinstalar", { detail: { slug } }));
    document.getElementById("reinstalar")?.scrollIntoView({ behavior: "smooth", block: "start" });
  }

  const grupos: Array<["linux" | "windows", Plantilla[]]> = [
    ["linux", (lista ?? []).filter((p) => p.familia === "linux")],
    ["windows", (lista ?? []).filter((p) => p.familia === "windows")],
  ];

  return (
    <section id="plantillas" className={`${CARD} scroll-mt-28`}>
      <div className="px-6 pt-6">
        <p className={SECTION_INDEX}>/06</p>
        <h2 className="mt-2 text-lg font-semibold">{t("plantillas.heading")}</h2>
        <p className="mt-1 text-sm text-[var(--color-fg-muted)]">{t("plantillas.intro")}</p>
      </div>
      <div className="px-6 py-5">
        {lista === null ? (
          <span className="block h-5 w-1/2 animate-pulse rounded bg-[var(--color-bg-overlay)]" aria-hidden="true" />
        ) : lista.length === 0 ? (
          <p className="text-sm text-[var(--color-fg-dim)]">{t("plantillas.empty")}</p>
        ) : (
          <div className="grid gap-6 sm:grid-cols-2">
            {grupos.map(([familia, items]) =>
              items.length === 0 ? null : (
                <div key={familia}>
                  <p className="mono-label text-[0.6rem]">{t(`plantillas.${familia}`)}</p>
                  <ul className="mt-2 grid gap-2">
                    {items.map((p) => {
                      const instalable = p.ofertable && p.cabe;
                      return (
                        <li
                          key={p.slug}
                          className={
                            "flex flex-wrap items-center justify-between gap-3 rounded-[var(--radius-md)] border px-3 py-2.5 " +
                            (p.actual ? "border-[var(--color-accent)]/60 bg-[var(--color-accent)]/5" : "border-[var(--color-line)] bg-[var(--color-bg-base)]")
                          }
                        >
                          <div className="min-w-0">
                            <p className="text-sm">
                              {p.label}
                              {p.actual && <span className="ml-2 rounded-full bg-[var(--color-accent)]/15 px-2 py-0.5 font-mono text-[0.6rem] text-[var(--color-accent)]">{t("plantillas.current")}</span>}
                            </p>
                            {!p.cabe && (
                              <p className="text-xs text-[var(--color-fg-muted)]">{t("plantillas.tooSmall", { size: p.minDiscoGb })}{diskGb != null ? ` · ${diskGb} GB` : ""}</p>
                            )}
                          </div>
                          {!p.actual && instalable && (
                            <button type="button" onClick={() => reinstalar(p.slug)} className="text-xs text-[var(--color-fg-muted)] transition-colors hover:text-[var(--color-accent)]">
                              {t("plantillas.reinstall")}
                            </button>
                          )}
                        </li>
                      );
                    })}
                  </ul>
                </div>
              ),
            )}
          </div>
        )}
      </div>
    </section>
  );
}
