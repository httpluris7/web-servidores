"use client";

import { useCallback, useEffect, useState } from "react";
import { useLocale, useTranslations } from "next-intl";
import { useRouter } from "@/i18n/navigation";
import { CARD, SECTION_INDEX } from "./ui";

type Snapshot = { name: string; description?: string; snaptime?: number; parent?: string };

/**
 * Sección "Instantáneas" (Fase 4). Crear/revertir/borrar snapshots de la VM.
 * Revertir es destructivo (vuelve el disco atrás): confirmación por hostname.
 * Las operaciones esperan a que Proxmox termine (el provisioner hace waitForTask),
 * así que se muestra "trabajando" mientras tanto.
 */
export function SnapshotsSection({ id, nombre }: { id: string; nombre: string }) {
  const t = useTranslations("panel");
  const locale = useLocale();
  const router = useRouter();
  const [lista, setLista] = useState<Snapshot[] | null>(null);
  const [nuevo, setNuevo] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [confirm, setConfirm] = useState<string | null>(null); // nombre del snapshot a revertir
  const [confirmText, setConfirmText] = useState("");

  const cargar = useCallback(async () => {
    try {
      const res = await fetch(`/api/panel/servicios/${id}/snapshots`);
      const j = await res.json().catch(() => null);
      if (j?.ok && Array.isArray(j.snapshots)) setLista(j.snapshots as Snapshot[]);
      else setLista([]);
    } catch {
      setLista([]);
    }
  }, [id]);

  useEffect(() => {
    void cargar();
  }, [cargar]);

  const op = useCallback(
    async (body: Record<string, unknown>): Promise<boolean> => {
      setError(null);
      setBusy(true);
      try {
        const res = await fetch(`/api/panel/servicios/${id}/snapshots`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(body),
        });
        const j = await res.json().catch(() => null);
        if (!res.ok || !j?.ok) {
          setError(
            j?.error === "confirmation_mismatch"
              ? t("power.errorConfirmation")
              : j?.error === "busy"
                ? t("power.errorBusy")
                : res.status === 429
                  ? t("power.errorTooMany")
                  : t("power.errorGeneric"),
          );
          return false;
        }
        return true;
      } catch {
        setError(t("power.errorConnection"));
        return false;
      } finally {
        setBusy(false);
      }
    },
    [id, t],
  );

  async function crear() {
    if (await op({ op: "crear", nombre: nuevo.trim() })) {
      setNuevo("");
      await cargar();
    }
  }

  async function borrar(name: string) {
    if (await op({ op: "borrar", nombre: name })) await cargar();
  }

  async function revertir() {
    if (!confirm) return;
    if (await op({ op: "revertir", nombre: confirm, confirmacion: confirmText })) {
      setConfirm(null);
      setConfirmText("");
      await cargar();
      router.refresh(); // el estado puede cambiar tras revertir
    }
  }

  const boton =
    "inline-flex min-h-11 items-center justify-center rounded-[var(--radius-md)] border border-[var(--color-line-strong)] px-4 text-sm transition-colors hover:border-[var(--color-accent)] hover:text-[var(--color-accent)] disabled:opacity-40";

  return (
    <section id="snapshots" className={`${CARD} scroll-mt-28`}>
      <div className="px-6 pt-6">
        <p className={SECTION_INDEX}>/08</p>
        <h2 className="mt-2 text-lg font-semibold">{t("snapshots.heading")}</h2>
        <p className="mt-1 text-sm text-[var(--color-fg-muted)]">{t("snapshots.intro")}</p>
      </div>

      <div className="px-6 py-5">
        <div className="flex flex-wrap gap-3">
          <input
            type="text"
            value={nuevo}
            onChange={(e) => setNuevo(e.target.value)}
            placeholder={t("snapshots.namePlaceholder")}
            maxLength={40}
            className="min-w-0 flex-1 rounded-[var(--radius-md)] border border-[var(--color-line-strong)] bg-[var(--color-bg-base)] px-3 py-2.5 text-sm placeholder:text-[var(--color-fg-dim)] focus:border-[var(--color-accent)] focus:outline-none sm:flex-none sm:w-64"
          />
          <button type="button" className={boton} disabled={busy} onClick={crear}>
            {t("snapshots.create")}
          </button>
        </div>

        {error && (
          <p role="alert" className="mt-4 text-sm text-[var(--color-danger)]">
            {error}
          </p>
        )}
        {busy && <p className="mt-4 text-sm text-[var(--color-accent)]">{t("power.working")}</p>}

        {lista === null ? (
          <div className="mt-5 space-y-3" aria-hidden="true">
            {Array.from({ length: 2 }).map((_, i) => (
              <span key={i} className="block h-5 animate-pulse rounded bg-[var(--color-bg-overlay)]" />
            ))}
          </div>
        ) : lista.length === 0 ? (
          <p className="mt-5 text-sm text-[var(--color-fg-dim)]">{t("snapshots.empty")}</p>
        ) : (
          <ul className="mt-5 grid gap-3">
            {lista.map((s) => (
              <li
                key={s.name}
                className="flex min-w-0 flex-wrap items-center justify-between gap-3 border-t border-[var(--color-line)] pt-3 first:border-0 first:pt-0"
              >
                <div className="min-w-0">
                  <p className="text-sm break-words text-[var(--color-fg)]">{s.name}</p>
                  {s.snaptime && (
                    <p className="font-mono text-xs text-[var(--color-fg-muted)]">
                      {new Intl.DateTimeFormat(locale, { dateStyle: "medium", timeStyle: "short" }).format(
                        new Date(s.snaptime * 1000),
                      )}
                    </p>
                  )}
                </div>
                <div className="flex shrink-0 gap-3">
                  <button
                    type="button"
                    disabled={busy}
                    onClick={() => {
                      setConfirmText("");
                      setConfirm(s.name);
                    }}
                    className="text-xs text-[var(--color-accent)] transition-colors hover:underline disabled:opacity-40"
                  >
                    {t("snapshots.revert")}
                  </button>
                  <button
                    type="button"
                    disabled={busy}
                    onClick={() => borrar(s.name)}
                    className="text-xs text-[var(--color-fg-muted)] transition-colors hover:text-[var(--color-danger)] disabled:opacity-40"
                  >
                    {t("snapshots.delete")}
                  </button>
                </div>
              </li>
            ))}
          </ul>
        )}

        {confirm && (
          <div className="mt-5 rounded-[var(--radius-md)] border border-[var(--color-danger)]/40 bg-[var(--color-bg-base)] p-5">
            <h3 className="text-sm font-semibold text-[var(--color-danger)]">
              {t("snapshots.revertTitle")}
            </h3>
            <p className="mt-1 text-sm text-[var(--color-fg-muted)]">
              {t("snapshots.revertBody", { snapshot: confirm })}
            </p>
            <p className="mt-2 mb-3 text-xs text-[var(--color-fg-muted)]">
              {t("power.confirmLabel")}{" "}
              <span className="font-mono break-all text-[var(--color-fg)]">{nombre}</span>
            </p>
            <input
              type="text"
              value={confirmText}
              onChange={(e) => setConfirmText(e.target.value)}
              autoComplete="off"
              className="w-full min-w-0 rounded-[var(--radius-md)] border border-[var(--color-line-strong)] bg-[var(--color-bg-overlay)] px-3 py-2.5 font-mono text-sm focus:border-[var(--color-danger)] focus:outline-none"
            />
            <div className="mt-4 flex flex-wrap gap-3">
              <button
                type="button"
                disabled={busy || confirmText.trim() !== nombre}
                onClick={revertir}
                className="inline-flex min-h-11 items-center justify-center rounded-[var(--radius-md)] bg-[var(--color-danger)] px-5 text-sm font-medium text-white transition-opacity hover:opacity-90 disabled:opacity-40"
              >
                {t("snapshots.revert")}
              </button>
              <button
                type="button"
                onClick={() => setConfirm(null)}
                className="text-sm text-[var(--color-fg-muted)] transition-colors hover:text-[var(--color-fg)]"
              >
                {t("power.cancel")}
              </button>
            </div>
          </div>
        )}
      </div>
    </section>
  );
}
