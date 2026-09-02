"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useLocale, useTranslations } from "next-intl";
import type { VpsBackup } from "@/lib/provisioner/client";
import { CARD, SECTION_INDEX } from "./ui";

/**
 * Sección "Copias de seguridad" (Fase 4). Lanza copias (vzdump) como tarea
 * asíncrona (UPID + sondeo, como las de energía), lista las existentes y permite
 * borrarlas. Si el nodo no tiene un almacén de backup configurado, se indica.
 * Restaurar (destructivo) todavía pasa por soporte.
 */
export function BackupsSection({ id }: { id: string }) {
  const t = useTranslations("panel");
  const locale = useLocale();
  const [storage, setStorage] = useState<string | null | undefined>(undefined); // undefined = cargando
  const [backups, setBackups] = useState<VpsBackup[]>([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const timer = useRef<ReturnType<typeof setInterval> | null>(null);

  const cargar = useCallback(async () => {
    try {
      const res = await fetch(`/api/panel/servicios/${id}/backups`);
      const j = await res.json().catch(() => null);
      if (j?.ok) {
        setStorage(j.storage ?? null);
        setBackups(Array.isArray(j.backups) ? (j.backups as VpsBackup[]) : []);
      } else {
        setStorage(null);
      }
    } catch {
      setStorage(null);
    }
  }, [id]);

  useEffect(() => {
    void cargar();
    return () => {
      if (timer.current) clearInterval(timer.current);
    };
  }, [cargar]);

  const sondear = useCallback(
    (upid: string) => {
      const inicio = Date.now();
      timer.current = setInterval(async () => {
        if (Date.now() - inicio > 15 * 60 * 1000) {
          if (timer.current) clearInterval(timer.current);
          setBusy(false);
          void cargar();
          return;
        }
        try {
          const res = await fetch(`/api/panel/servicios/${id}/tarea?upid=${encodeURIComponent(upid)}`);
          const j = await res.json().catch(() => null);
          if (j?.ok && j.done) {
            if (timer.current) clearInterval(timer.current);
            setBusy(false);
            setNotice(j.okResult === false ? t("backups.failed") : t("backups.done"));
            void cargar();
          }
        } catch {
          /* reintenta en el siguiente tick */
        }
      }, 3000);
    },
    [cargar, id, t],
  );

  async function crear() {
    setError(null);
    setNotice(null);
    setBusy(true);
    try {
      const res = await fetch(`/api/panel/servicios/${id}/backups`, { method: "POST" });
      const j = await res.json().catch(() => null);
      if (!res.ok || !j?.ok) {
        setBusy(false);
        setError(j?.error === "no_storage" ? t("backups.noStorage") : t("power.errorGeneric"));
        return;
      }
      setNotice(t("backups.creating"));
      sondear(j.upid);
    } catch {
      setBusy(false);
      setError(t("power.errorConnection"));
    }
  }

  async function borrar(volid: string) {
    setError(null);
    setBusy(true);
    try {
      const res = await fetch(`/api/panel/servicios/${id}/backups?volid=${encodeURIComponent(volid)}`, {
        method: "DELETE",
      });
      const j = await res.json().catch(() => null);
      if (!res.ok || !j?.ok) setError(t("power.errorGeneric"));
      else await cargar();
    } catch {
      setError(t("power.errorConnection"));
    } finally {
      setBusy(false);
    }
  }

  const boton =
    "inline-flex min-h-11 items-center justify-center rounded-[var(--radius-md)] border border-[var(--color-line-strong)] px-4 text-sm transition-colors hover:border-[var(--color-accent)] hover:text-[var(--color-accent)] disabled:opacity-40";

  return (
    <section id="backups" className={`${CARD} scroll-mt-28`}>
      <div className="px-6 pt-6">
        <p className={SECTION_INDEX}>/09</p>
        <h2 className="mt-2 text-lg font-semibold">{t("backups.heading")}</h2>
        <p className="mt-1 text-sm text-[var(--color-fg-muted)]">{t("backups.intro")}</p>
      </div>

      <div className="px-6 py-5">
        {storage === undefined ? (
          <div className="space-y-3" aria-hidden="true">
            {Array.from({ length: 2 }).map((_, i) => (
              <span key={i} className="block h-5 animate-pulse rounded bg-[var(--color-bg-overlay)]" />
            ))}
          </div>
        ) : storage === null ? (
          <p className="text-sm text-[var(--color-fg-dim)]">{t("backups.noStorage")}</p>
        ) : (
          <>
            <button type="button" className={boton} disabled={busy} onClick={crear}>
              {t("backups.create")}
            </button>

            {error && (
              <p role="alert" className="mt-4 text-sm text-[var(--color-danger)]">
                {error}
              </p>
            )}
            {busy && <p className="mt-4 text-sm text-[var(--color-accent)]">{t("backups.creating")}</p>}
            {!busy && notice && <p className="mt-4 text-sm text-[var(--color-accent)]">{notice}</p>}

            {backups.length === 0 ? (
              <p className="mt-5 text-sm text-[var(--color-fg-dim)]">{t("backups.empty")}</p>
            ) : (
              <ul className="mt-5 grid gap-3">
                {backups.map((b) => (
                  <li
                    key={b.volid}
                    className="flex min-w-0 flex-wrap items-center justify-between gap-3 border-t border-[var(--color-line)] pt-3 first:border-0 first:pt-0"
                  >
                    <div className="min-w-0">
                      <p className="font-mono text-sm text-[var(--color-fg)]">
                        {b.ctime
                          ? new Intl.DateTimeFormat(locale, { dateStyle: "medium", timeStyle: "short" }).format(
                              new Date(b.ctime * 1000),
                            )
                          : "—"}
                      </p>
                      <p className="font-mono text-xs text-[var(--color-fg-muted)]">{humano(b.size)}</p>
                    </div>
                    <button
                      type="button"
                      disabled={busy}
                      onClick={() => borrar(b.volid)}
                      className="text-xs text-[var(--color-fg-muted)] transition-colors hover:text-[var(--color-danger)] disabled:opacity-40"
                    >
                      {t("backups.delete")}
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </>
        )}
      </div>
    </section>
  );
}

/** Bytes → texto legible (MB/GB). */
function humano(bytes: number | null): string {
  if (bytes == null) return "—";
  const gb = bytes / 1024 ** 3;
  if (gb >= 1) return `${Math.round(gb * 10) / 10} GB`;
  return `${Math.round(bytes / 1024 ** 2)} MB`;
}
