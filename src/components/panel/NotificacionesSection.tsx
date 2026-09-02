"use client";

import { useEffect, useState } from "react";
import { useLocale, useTranslations } from "next-intl";
import { CARD_PAD, SECTION_INDEX } from "./ui";

type Aviso = { regla: string; valor: number | null; umbral: number; desde: string };
type Datos = {
  agenteActivo: boolean;
  umbrales: { cpu: number; memoria: number; disco: number };
  activos: Aviso[];
};

/**
 * "Notificaciones de recursos" (Fase 6), informativa. Muestra si el servidor está
 * dentro de los límites o tiene alguna alerta activa (CPU/memoria/disco sostenidos
 * o agente caído) y los umbrales vigilados. Requiere agente instalado.
 */
export function NotificacionesSection({ id }: { id: string }) {
  const t = useTranslations("panel");
  const locale = useLocale();
  const [datos, setDatos] = useState<Datos | null>(null);
  const [error, setError] = useState(false);

  useEffect(() => {
    let vivo = true;
    (async () => {
      try {
        const res = await fetch(`/api/panel/servicios/${id}/avisos`);
        const j = await res.json().catch(() => null);
        if (!vivo) return;
        if (j?.ok) setDatos(j as Datos);
        else setError(true);
      } catch {
        if (vivo) setError(true);
      }
    })();
    return () => {
      vivo = false;
    };
  }, [id]);

  return (
    <section id="notificaciones" className={`${CARD_PAD} scroll-mt-28`}>
      <p className={SECTION_INDEX}>/13</p>
      <h2 className="mt-2 text-lg font-semibold">{t("notif.heading")}</h2>

      {error ? (
        <p className="mt-3 text-sm text-[var(--color-fg-dim)]">{t("notif.error")}</p>
      ) : datos === null ? (
        <div className="mt-4 space-y-3" aria-hidden="true">
          {Array.from({ length: 2 }).map((_, i) => (
            <span key={i} className="block h-4 animate-pulse rounded bg-[var(--color-bg-overlay)]" />
          ))}
        </div>
      ) : !datos.agenteActivo ? (
        <p className="mt-3 text-sm text-[var(--color-fg-muted)]">{t("notif.noAgent")}</p>
      ) : (
        <>
          <p className="mt-1 mb-4 text-sm text-[var(--color-fg-muted)]">
            {t("notif.intro", {
              cpu: datos.umbrales.cpu,
              mem: datos.umbrales.memoria,
              disco: datos.umbrales.disco,
            })}
          </p>

          {datos.activos.length === 0 ? (
            <p className="inline-flex items-center gap-2 text-sm text-[var(--color-accent)]">
              <span className="h-1.5 w-1.5 rounded-full bg-current" />
              {t("notif.allOk")}
            </p>
          ) : (
            <ul className="grid gap-2">
              {datos.activos.map((a) => (
                <li
                  key={a.regla}
                  className="flex flex-wrap items-center justify-between gap-3 rounded-[var(--radius-md)] border border-[var(--color-danger)]/40 bg-[var(--color-danger)]/10 px-4 py-2.5 text-sm"
                >
                  <span className="font-medium text-[var(--color-danger)]">
                    {t(`notif.reglas.${a.regla}`)}
                    {a.valor != null && a.regla !== "agente" ? ` · ${Math.round(a.valor)}%` : ""}
                  </span>
                  <span className="font-mono text-xs text-[var(--color-fg-muted)]">
                    {t("notif.since")} {new Intl.DateTimeFormat(locale, { dateStyle: "short", timeStyle: "short" }).format(new Date(a.desde))}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </>
      )}
    </section>
  );
}
