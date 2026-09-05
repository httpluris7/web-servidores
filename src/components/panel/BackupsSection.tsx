"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useLocale, useTranslations } from "next-intl";
import type { VpsBackup, VpsBackupSchedule } from "@/lib/provisioner/client";
import { CARD, SECTION_INDEX } from "./ui";

/**
 * Sección "Copias de seguridad" (Fase 4). Lanza copias (vzdump) como tarea
 * asíncrona (UPID + sondeo, como las de energía), lista las existentes y permite
 * borrarlas. Si el nodo no tiene un almacén de backup configurado, se indica.
 * Restaurar (destructivo) exige teclear el nombre del servidor, como reinstalar,
 * y deja el servidor apagado. La programación de copias automáticas la ejecuta
 * el worker del aprovisionador (hora UTC, retención solo de las automáticas).
 */
export function BackupsSection({ id, nombre }: { id: string; nombre: string }) {
  const t = useTranslations("panel");
  const locale = useLocale();
  const [storage, setStorage] = useState<string | null | undefined>(undefined); // undefined = cargando
  const [backups, setBackups] = useState<VpsBackup[]>([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const timer = useRef<ReturnType<typeof setInterval> | null>(null);
  const [restaurando, setRestaurando] = useState<string | null>(null); // volid con el diálogo abierto
  const [confirmacion, setConfirmacion] = useState("");

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
    (upid: string, modo: "backup" | "restore" = "backup") => {
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
            setNotice(
              modo === "restore"
                ? j.okResult === false
                  ? t("backups.restoreFailed")
                  : t("backups.restored")
                : j.okResult === false
                  ? t("backups.failed")
                  : t("backups.done"),
            );
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

  async function restaurar(volid: string) {
    setError(null);
    setNotice(null);
    setBusy(true);
    try {
      const res = await fetch(`/api/panel/servicios/${id}/backups/restaurar`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ volid, confirmacion }),
      });
      const j = await res.json().catch(() => null);
      if (!res.ok || !j?.ok) {
        setBusy(false);
        setError(
          j?.error === "confirmation_mismatch"
            ? t("power.errorConfirmation")
            : j?.error === "busy"
              ? t("power.errorBusy")
              : t("power.errorGeneric"),
        );
        return;
      }
      setRestaurando(null);
      setConfirmacion("");
      setNotice(t("backups.restoring"));
      sondear(j.upid, "restore");
    } catch {
      setBusy(false);
      setError(t("power.errorConnection"));
    }
  }

  const boton =
    "inline-flex min-h-11 items-center justify-center rounded-[var(--radius-md)] border border-[var(--color-line-strong)] px-4 text-sm transition-colors hover:border-[var(--color-accent)] hover:text-[var(--color-accent)] disabled:opacity-40";

  return (
    <section id="backups" className={`${CARD} scroll-mt-28`}>
      <div className="px-6 pt-6">
        <p className={SECTION_INDEX}>/11</p>
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
                      <p className="font-mono text-xs text-[var(--color-fg-muted)]">
                        {humano(b.size)}
                        {b.notes === "viahost-auto" && <span className="ml-2 text-[var(--color-accent)]">· {t("backups.auto")}</span>}
                      </p>
                    </div>
                    <div className="flex items-center gap-4">
                      <button
                        type="button"
                        disabled={busy}
                        onClick={() => {
                          setRestaurando(restaurando === b.volid ? null : b.volid);
                          setConfirmacion("");
                          setError(null);
                        }}
                        className="text-xs text-[var(--color-fg-muted)] transition-colors hover:text-[var(--color-accent)] disabled:opacity-40"
                      >
                        {t("backups.restore")}
                      </button>
                      <button
                        type="button"
                        disabled={busy}
                        onClick={() => borrar(b.volid)}
                        className="text-xs text-[var(--color-fg-muted)] transition-colors hover:text-[var(--color-danger)] disabled:opacity-40"
                      >
                        {t("backups.delete")}
                      </button>
                    </div>
                    {restaurando === b.volid && (
                      <div className="basis-full rounded-[var(--radius-md)] border border-[var(--color-danger)]/40 bg-[var(--color-danger)]/5 p-4">
                        <p className="text-sm font-medium">{t("backups.restoreTitle")}</p>
                        <p className="mt-1 text-xs text-[var(--color-fg-muted)]">
                          {t("backups.restoreBody")}{" "}
                          <span className="font-mono break-all text-[var(--color-fg)]">{nombre}</span>
                        </p>
                        <label htmlFor={`restore-confirm-${b.volid}`} className="mono-label mt-3 block text-[0.6rem]">
                          {t("power.confirmLabel")}
                        </label>
                        <input
                          id={`restore-confirm-${b.volid}`}
                          type="text"
                          value={confirmacion}
                          onChange={(e) => setConfirmacion(e.target.value)}
                          autoComplete="off"
                          className="mt-1 w-full min-w-0 rounded-[var(--radius-md)] border border-[var(--color-line-strong)] bg-[var(--color-bg-base)] px-3 py-2.5 font-mono text-sm focus:border-[var(--color-danger)] focus:outline-none"
                        />
                        <div className="mt-3 flex flex-wrap gap-3">
                          <button
                            type="button"
                            disabled={busy || confirmacion.trim() !== nombre}
                            onClick={() => restaurar(b.volid)}
                            className="inline-flex min-h-11 items-center justify-center rounded-[var(--radius-md)] bg-[var(--color-danger)] px-5 text-sm font-medium text-white transition-opacity hover:opacity-90 disabled:opacity-40"
                          >
                            {t("backups.restoreConfirm")}
                          </button>
                          <button
                            type="button"
                            onClick={() => {
                              setRestaurando(null);
                              setConfirmacion("");
                            }}
                            className="text-sm text-[var(--color-fg-muted)] transition-colors hover:text-[var(--color-fg)]"
                          >
                            {t("power.cancel")}
                          </button>
                        </div>
                      </div>
                    )}
                  </li>
                ))}
              </ul>
            )}

            <Programacion id={id} />
          </>
        )}
      </div>
    </section>
  );
}

/** Formulario de copias automáticas (frecuencia, día, hora UTC, retención). */
function Programacion({ id }: { id: string }) {
  const t = useTranslations("panel");
  const locale = useLocale();
  const [cargado, setCargado] = useState(false);
  const [actual, setActual] = useState<VpsBackupSchedule | null>(null);
  const [activo, setActivo] = useState(false);
  const [frecuencia, setFrecuencia] = useState<"daily" | "weekly">("daily");
  const [dia, setDia] = useState(0);
  const [hora, setHora] = useState(3);
  const [retencion, setRetencion] = useState(3);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<{ tipo: "ok" | "error"; texto: string } | null>(null);

  const aplicar = useCallback((s: VpsBackupSchedule | null) => {
    setActual(s);
    setActivo(s?.activo ?? false);
    setFrecuencia(s?.frecuencia ?? "daily");
    setDia(s?.diaSemana ?? 0);
    setHora(s?.hora ?? 3);
    setRetencion(s?.retencion ?? 3);
  }, []);

  useEffect(() => {
    let vivo = true;
    fetch(`/api/panel/servicios/${id}/backups/programacion`)
      .then((r) => r.json())
      .then((j) => {
        if (!vivo) return;
        aplicar(j?.ok ? (j.schedule as VpsBackupSchedule | null) : null);
      })
      .catch(() => {})
      .finally(() => {
        if (vivo) setCargado(true);
      });
    return () => {
      vivo = false;
    };
  }, [id, aplicar]);

  async function guardar() {
    setBusy(true);
    setMsg(null);
    try {
      const res = await fetch(`/api/panel/servicios/${id}/backups/programacion`, {
        method: "PUT",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ activo, frecuencia, dia_semana: frecuencia === "weekly" ? dia : null, hora, retencion }),
      });
      const j = await res.json().catch(() => null);
      if (!res.ok || !j?.ok) {
        setMsg({ tipo: "error", texto: j?.error === "invalid_schedule" ? t("backups.schedule.invalid") : t("power.errorGeneric") });
        return;
      }
      aplicar(j.schedule as VpsBackupSchedule | null);
      setMsg({ tipo: "ok", texto: t("backups.schedule.saved") });
    } catch {
      setMsg({ tipo: "error", texto: t("power.errorConnection") });
    } finally {
      setBusy(false);
    }
  }

  async function quitar() {
    setBusy(true);
    setMsg(null);
    try {
      const res = await fetch(`/api/panel/servicios/${id}/backups/programacion`, { method: "DELETE" });
      const j = await res.json().catch(() => null);
      if (!res.ok || !j?.ok) setMsg({ tipo: "error", texto: t("power.errorGeneric") });
      else aplicar(null);
    } catch {
      setMsg({ tipo: "error", texto: t("power.errorConnection") });
    } finally {
      setBusy(false);
    }
  }

  const campo =
    "mt-1 w-full min-w-0 rounded-[var(--radius-md)] border border-[var(--color-line-strong)] bg-[var(--color-bg-base)] px-3 py-2.5 text-sm focus:border-[var(--color-accent)] focus:outline-none disabled:opacity-40";
  const etiqueta = "mono-label block text-[0.6rem]";

  return (
    <div className="mt-8 border-t border-[var(--color-line)] pt-6">
      <h3 className="text-base font-semibold">{t("backups.schedule.heading")}</h3>
      <p className="mt-1 text-sm text-[var(--color-fg-muted)]">{t("backups.schedule.intro")}</p>
      {!cargado ? (
        <span className="mt-4 block h-5 w-1/2 animate-pulse rounded bg-[var(--color-bg-overlay)]" aria-hidden="true" />
      ) : (
        <div className="mt-4 grid gap-4">
          <label className="flex items-center gap-3 text-sm">
            <input type="checkbox" checked={activo} onChange={(e) => setActivo(e.target.checked)} className="h-4 w-4 accent-[var(--color-accent)]" />
            {t("backups.schedule.enabled")}
          </label>
          <div className="grid gap-4 sm:grid-cols-4">
            <div>
              <label htmlFor="bk-freq" className={etiqueta}>{t("backups.schedule.frequency")}</label>
              <select id="bk-freq" value={frecuencia} disabled={!activo} onChange={(e) => setFrecuencia(e.target.value as "daily" | "weekly")} className={campo}>
                <option value="daily">{t("backups.schedule.daily")}</option>
                <option value="weekly">{t("backups.schedule.weekly")}</option>
              </select>
            </div>
            <div>
              <label htmlFor="bk-day" className={etiqueta}>{t("backups.schedule.weekday")}</label>
              <select id="bk-day" value={dia} disabled={!activo || frecuencia !== "weekly"} onChange={(e) => setDia(Number(e.target.value))} className={campo}>
                {[0, 1, 2, 3, 4, 5, 6].map((d) => (
                  <option key={d} value={d}>{t(`backups.schedule.day.${d}`)}</option>
                ))}
              </select>
            </div>
            <div>
              <label htmlFor="bk-hour" className={etiqueta}>{t("backups.schedule.hour")}</label>
              <select id="bk-hour" value={hora} disabled={!activo} onChange={(e) => setHora(Number(e.target.value))} className={campo}>
                {Array.from({ length: 24 }, (_, h) => (
                  <option key={h} value={h}>{String(h).padStart(2, "0")}:00</option>
                ))}
              </select>
            </div>
            <div>
              <label htmlFor="bk-ret" className={etiqueta}>{t("backups.schedule.retention")}</label>
              <select id="bk-ret" value={retencion} disabled={!activo} onChange={(e) => setRetencion(Number(e.target.value))} className={campo}>
                {[1, 2, 3, 5, 7, 14].map((n) => (
                  <option key={n} value={n}>{t("backups.schedule.retentionUnit", { count: n })}</option>
                ))}
              </select>
            </div>
          </div>
          <div className="flex flex-wrap items-center gap-4">
            <button
              type="button"
              disabled={busy}
              onClick={guardar}
              className="inline-flex min-h-11 items-center justify-center rounded-[var(--radius-md)] border border-[var(--color-line-strong)] px-4 text-sm transition-colors hover:border-[var(--color-accent)] hover:text-[var(--color-accent)] disabled:opacity-40"
            >
              {busy ? t("backups.schedule.saving") : t("backups.schedule.save")}
            </button>
            {actual && (
              <button type="button" disabled={busy} onClick={quitar} className="text-sm text-[var(--color-fg-muted)] transition-colors hover:text-[var(--color-danger)] disabled:opacity-40">
                {t("backups.schedule.remove")}
              </button>
            )}
            {actual && (
              <p className="text-xs text-[var(--color-fg-muted)]">
                {t("backups.schedule.lastRun")}{" "}
                <span className="font-mono">
                  {actual.ultimoRun
                    ? new Intl.DateTimeFormat(locale, { dateStyle: "medium", timeStyle: "short" }).format(new Date(actual.ultimoRun))
                    : t("backups.schedule.never")}
                  {actual.ultimoResultado ? ` · ${actual.ultimoResultado}` : ""}
                </span>
              </p>
            )}
          </div>
          {msg && (
            <p role={msg.tipo === "error" ? "alert" : "status"} className={`text-sm ${msg.tipo === "error" ? "text-[var(--color-danger)]" : "text-[var(--color-accent)]"}`}>
              {msg.texto}
            </p>
          )}
        </div>
      )}
    </div>
  );
}

/** Bytes → texto legible (MB/GB). */
function humano(bytes: number | null): string {
  if (bytes == null) return "—";
  const gb = bytes / 1024 ** 3;
  if (gb >= 1) return `${Math.round(gb * 10) / 10} GB`;
  return `${Math.round(bytes / 1024 ** 2)} MB`;
}
