"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import type { AlertSettings } from "@/lib/ajustes";

/**
 * Umbrales de aviso. Un 0 en un umbral desactiva esa regla, que se dice en el
 * texto de ayuda de cada campo: es más directo que un interruptor por regla y
 * deja el formulario en una sola fila de números.
 */
export function AlertSettingsForm({ initial }: { initial: AlertSettings }) {
  const t = useTranslations("admin");
  const [valores, setValores] = useState<AlertSettings>(initial);
  const [guardando, setGuardando] = useState(false);
  const [mensaje, setMensaje] = useState<{ tipo: "ok" | "error" | "aviso"; texto: string } | null>(
    null
  );

  function set<K extends keyof AlertSettings>(k: K, v: AlertSettings[K]) {
    setValores((prev) => ({ ...prev, [k]: v }));
    setMensaje(null);
  }

  async function guardar(e: React.FormEvent) {
    e.preventDefault();
    setGuardando(true);
    setMensaje(null);
    try {
      const res = await fetch("/api/admin/ajustes", {
        method: "PUT",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ section: "alerts", ...valores }),
      });
      const json = await res.json().catch(() => null);
      if (!res.ok || !json?.ok) {
        setMensaje({ tipo: "error", texto: json?.error ?? t("avisos.errorSave") });
        return;
      }
      if (json.alerts) setValores(json.alerts as AlertSettings);
      setMensaje(
        json.warning
          ? { tipo: "aviso", texto: json.warning as string }
          : { tipo: "ok", texto: t("avisos.saved") }
      );
    } catch {
      setMensaje({ tipo: "error", texto: t("avisos.errorConnection") });
    } finally {
      setGuardando(false);
    }
  }

  const campo =
    "min-h-11 w-full rounded-[var(--radius-md)] border border-[var(--color-line-strong)] bg-[var(--color-bg-base)] px-3 py-2 text-sm placeholder:text-[var(--color-fg-dim)] focus:border-[var(--color-accent)] focus:outline-none md:min-h-0";

  const numeros: Array<{ k: keyof AlertSettings; max: number; sufijo: string }> = [
    { k: "cpu", max: 100, sufijo: "%" },
    { k: "memoria", max: 100, sufijo: "%" },
    { k: "disco", max: 100, sufijo: "%" },
    { k: "sostenido", max: 720, sufijo: "min" },
    { k: "agenteCaido", max: 1440, sufijo: "min" },
    { k: "recordatorio", max: 720, sufijo: "h" },
  ];

  return (
    <section className="rounded-[var(--radius-lg)] border border-[var(--color-line)] bg-[var(--color-bg-raised)] p-5 md:p-6">
      <h2 className="text-lg font-semibold">{t("avisos.heading")}</h2>
      <p className="mt-1 text-sm text-[var(--color-fg-muted)]">{t("avisos.intro")}</p>

      <form onSubmit={guardar} className="mt-5 grid gap-5">
        <label className="flex items-center gap-3">
          <input
            type="checkbox"
            checked={valores.enabled}
            onChange={(e) => set("enabled", e.target.checked)}
            className="size-4 accent-[var(--color-accent)]"
          />
          <span className="text-sm">{t("avisos.enabled")}</span>
        </label>

        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {numeros.map(({ k, max, sufijo }) => (
            <label key={k} className="grid gap-1">
              <span className="mono-label text-[0.55rem]">{t(`avisos.field.${k}`)}</span>
              <div className="flex items-center gap-2">
                <input
                  type="number"
                  min={k === "sostenido" ? 1 : 0}
                  max={max}
                  step={1}
                  value={valores[k] as number}
                  onChange={(e) => set(k, Number(e.target.value) as never)}
                  className={campo}
                />
                <span className="shrink-0 font-mono text-xs text-[var(--color-fg-dim)]">
                  {sufijo}
                </span>
              </div>
              <span className="text-[0.65rem] text-[var(--color-fg-dim)]">
                {t(`avisos.help.${k}`)}
              </span>
            </label>
          ))}
        </div>

        <label className="grid gap-1">
          <span className="mono-label text-[0.55rem]">{t("avisos.field.destinatarios")}</span>
          <input
            type="text"
            value={valores.destinatarios}
            onChange={(e) => set("destinatarios", e.target.value)}
            placeholder="aviso@viahost.top, otro@ejemplo.com"
            className={campo}
          />
          <span className="text-[0.65rem] text-[var(--color-fg-dim)]">
            {t("avisos.help.destinatarios")}
          </span>
        </label>

        <div className="flex flex-wrap items-center gap-3">
          <button
            type="submit"
            disabled={guardando}
            className="inline-flex min-h-11 items-center rounded-[var(--radius-md)] border border-[var(--color-accent)] px-4 py-2 text-sm font-medium text-[var(--color-accent)] transition-colors hover:bg-[var(--color-accent)]/10 disabled:opacity-50 md:min-h-0"
          >
            {guardando ? t("avisos.saving") : t("avisos.save")}
          </button>
          {mensaje && (
            <p
              role={mensaje.tipo === "error" ? "alert" : "status"}
              className={`text-sm ${
                mensaje.tipo === "error"
                  ? "text-[var(--color-danger)]"
                  : mensaje.tipo === "aviso"
                    ? "text-amber-300"
                    : "text-[var(--color-accent)]"
              }`}
            >
              {mensaje.texto}
            </p>
          )}
        </div>
      </form>
    </section>
  );
}
