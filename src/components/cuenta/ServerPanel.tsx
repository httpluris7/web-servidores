"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useTranslations } from "next-intl";
import type { ProviderServer, ProviderSnapshot, ServerLimit } from "@/lib/servidores/v4vm";
import { ServerStatusBadge } from "@/components/ui/ServerStatusBadge";

type OsOption = { id: number; label: string; family: string; supportsSshKeys: boolean };
type SshKey = { id: number; name: string };

/** Cada cuánto se relee el estado mientras el proveedor está trabajando. */
const POLL_MS = 5000;

function bytes(n: number | null): string {
  if (n === null) return "—";
  const u = ["B", "KB", "MB", "GB", "TB"];
  let v = n;
  let i = 0;
  while (v >= 1024 && i < u.length - 1) {
    v /= 1024;
    i++;
  }
  return `${v.toFixed(v >= 10 || i === 0 ? 0 : 1)} ${u[i]}`;
}

export function ServerPanel({
  id,
  initialServer,
  initialSnapshots,
  initialLimits,
}: {
  id: string;
  initialServer: ProviderServer;
  initialSnapshots: ProviderSnapshot[];
  initialLimits: ServerLimit[];
}) {
  const t = useTranslations("auth");
  const [server, setServer] = useState(initialServer);
  const [snapshots, setSnapshots] = useState(initialSnapshots);
  const [limits, setLimits] = useState(initialLimits);
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  // Contraseña de root: se enseña una vez y no se guarda en ningún sitio.
  const [password, setPassword] = useState<string | null>(null);

  // Reinstalación
  const [reinstallOpen, setReinstallOpen] = useState(false);
  const [opciones, setOpciones] = useState<{ sistemas: OsOption[]; claves: SshKey[] } | null>(null);
  const [osElegido, setOsElegido] = useState<number | null>(null);
  const [clavesElegidas, setClavesElegidas] = useState<number[]>([]);
  const [confirmacion, setConfirmacion] = useState("");

  // Instantáneas
  const [snapshotNombre, setSnapshotNombre] = useState("");

  const refresh = useCallback(
    async (extras = false) => {
      try {
        const res = await fetch(`/api/cuenta/servidores/${id}${extras ? "?extras=1" : ""}`);
        const json = await res.json().catch(() => null);
        if (!res.ok || !json?.ok) return;
        setServer(json.server as ProviderServer);
        if (json.snapshots) setSnapshots(json.snapshots as ProviderSnapshot[]);
        if (json.limits) setLimits(json.limits as ServerLimit[]);
      } catch {
        // Un fallo puntual de red no debe romper la pantalla: se reintenta solo.
      }
    },
    [id]
  );

  // Mientras el proveedor trabaja, releemos el estado. Al terminar, una última
  // lectura con extras para que las instantáneas nuevas aparezcan solas.
  const eraProcesando = useRef(server.isProcessing);
  useEffect(() => {
    if (!server.isProcessing) {
      if (eraProcesando.current) {
        eraProcesando.current = false;
        void refresh(true);
      }
      return;
    }
    eraProcesando.current = true;
    const timer = setInterval(() => void refresh(false), POLL_MS);
    return () => clearInterval(timer);
  }, [server.isProcessing, refresh]);

  async function accion(accion: string, extra: Record<string, unknown> = {}) {
    setError(null);
    setNotice(null);
    setBusy(accion);
    try {
      const res = await fetch(`/api/cuenta/servidores/${id}/accion`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ accion, ...extra }),
      });
      const json = await res.json().catch(() => null);
      if (!res.ok || !json?.ok) {
        const code = json?.error;
        setError(
          code === "busy"
            ? t("serverDetail.errorBusy")
            : code === "suspended"
              ? t("serverDetail.errorSuspended")
              : code === "confirmation_mismatch"
                ? t("serverDetail.errorConfirmation")
                : code === "console_unavailable"
                  ? t("serverDetail.errorConsole")
                  : res.status === 429
                    ? t("serverDetail.errorTooMany")
                    : t("serverDetail.errorGeneric")
        );
        return null;
      }
      return json;
    } catch {
      setError(t("serverDetail.errorConnection"));
      return null;
    } finally {
      setBusy(null);
    }
  }

  async function power(cual: "encender" | "apagar" | "reiniciar") {
    const r = await accion(cual);
    if (r) {
      setNotice(t("serverDetail.taskStarted"));
      void refresh(false);
    }
  }

  async function abrirConsola() {
    const r = await accion("consola");
    if (r?.url) window.open(r.url as string, "_blank", "noopener,noreferrer");
  }

  async function nuevaPassword() {
    const r = await accion("password");
    if (r?.password) setPassword(r.password as string);
  }

  async function abrirReinstalar() {
    setReinstallOpen(true);
    if (opciones) return;
    const r = await accion("opciones");
    if (r) {
      setOpciones({ sistemas: r.sistemas as OsOption[], claves: r.claves as SshKey[] });
      setOsElegido((r.sistemas as OsOption[])[0]?.id ?? null);
    }
  }

  async function reinstalar() {
    if (!osElegido) return;
    const r = await accion("reinstalar", {
      os: osElegido,
      confirmacion,
      sshKeys: clavesElegidas,
    });
    if (r) {
      setReinstallOpen(false);
      setConfirmacion("");
      setNotice(t("serverDetail.reinstallStarted"));
      void refresh(false);
    }
  }

  async function crearSnapshot() {
    const r = await accion("snapshot-crear", { nombre: snapshotNombre });
    if (r) {
      setSnapshotNombre("");
      setNotice(t("serverDetail.taskStarted"));
      void refresh(true);
    }
  }

  async function snapshotAccion(snapshotId: number, cual: "revertir" | "borrar") {
    const r = await accion(`snapshot-${cual}`, { snapshotId });
    if (r) {
      setNotice(cual === "revertir" ? t("serverDetail.taskStarted") : t("serverDetail.snapshotDeleted"));
      void refresh(true);
    }
  }

  const trabajando = busy !== null || server.isProcessing;
  const encendido = server.status === "started";
  const osSeleccionado = opciones?.sistemas.find((s) => s.id === osElegido) ?? null;

  const card =
    "rounded-[var(--radius-lg)] border border-[var(--color-line)] bg-[var(--color-bg-raised)] p-6 min-w-0";
  const boton =
    "inline-flex min-h-11 items-center justify-center rounded-[var(--radius-md)] border border-[var(--color-line-strong)] px-4 text-sm transition-colors hover:border-[var(--color-accent)] hover:text-[var(--color-accent)] disabled:opacity-40";

  return (
    <div className="grid min-w-0 gap-6">
      {/* Estado y datos */}
      <section className={card}>
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div className="min-w-0">
            <ServerStatusBadge status={server.status} processing={server.isProcessing} />
            <p className="mt-3 font-mono text-sm break-words text-[var(--color-fg-muted)]">
              {server.ipv4[0] ?? "—"}
            </p>
          </div>
          <div className="text-right font-mono text-xs text-[var(--color-fg-muted)]">
            <p>
              {server.vcpu ?? "—"} vCPU · {server.ramMb ? Math.round(server.ramMb / 1024) : "—"} GB
            </p>
            <p className="mt-0.5">
              {server.diskGb ?? "—"} GB · {server.location ?? "—"}
            </p>
          </div>
        </div>

        {server.isProcessing && (
          <p className="mt-4 text-sm text-[var(--color-accent)]">
            {t("serverDetail.working")}
            {server.progress !== null ? ` ${server.progress}%` : ""}
          </p>
        )}
        {server.isSuspended && (
          <p className="mt-4 text-sm text-[var(--color-danger)]">
            {t("serverDetail.suspended")}
          </p>
        )}

        {server.ipv4.length > 1 && (
          <div className="mt-5 border-t border-[var(--color-line)] pt-4">
            <p className="mono-label text-[0.6rem]">{t("serverDetail.allIps")}</p>
            <p className="mt-2 font-mono text-xs break-words text-[var(--color-fg-muted)]">
              {server.ipv4.join(" · ")}
            </p>
          </div>
        )}
      </section>

      {error && (
        <p role="alert" className="text-sm text-[var(--color-danger)]">
          {error}
        </p>
      )}
      {notice && <p className="text-sm text-[var(--color-accent)]">{notice}</p>}

      {/* Energía y consola */}
      <section className={card}>
        <h2 className="text-lg font-semibold">{t("serverDetail.powerHeading")}</h2>
        <p className="mt-1 mb-5 text-sm text-[var(--color-fg-muted)]">
          {t("serverDetail.powerIntro")}
        </p>
        <div className="flex flex-wrap gap-3">
          <button type="button" className={boton} disabled={trabajando || encendido} onClick={() => power("encender")}>
            {t("serverDetail.start")}
          </button>
          <button type="button" className={boton} disabled={trabajando || !encendido} onClick={() => power("apagar")}>
            {t("serverDetail.stop")}
          </button>
          <button type="button" className={boton} disabled={trabajando || !encendido} onClick={() => power("reiniciar")}>
            {t("serverDetail.restart")}
          </button>
          <button type="button" className={boton} disabled={busy !== null} onClick={abrirConsola}>
            {t("serverDetail.console")}
          </button>
        </div>
      </section>

      {/* Contraseña de root */}
      <section className={card}>
        <h2 className="text-lg font-semibold">{t("serverDetail.passwordHeading")}</h2>
        <p className="mt-1 mb-5 text-sm text-[var(--color-fg-muted)]">
          {t("serverDetail.passwordIntro")}
        </p>
        <button type="button" className={boton} disabled={trabajando} onClick={nuevaPassword}>
          {t("serverDetail.passwordButton")}
        </button>

        {password && (
          <div className="mt-5 rounded-[var(--radius-md)] border border-[var(--color-accent)]/40 bg-[var(--color-accent)]/5 px-4 py-3">
            <p className="text-sm text-[var(--color-accent)]">{t("serverDetail.passwordOnce")}</p>
            <p className="mt-2 font-mono text-sm break-all select-all">{password}</p>
          </div>
        )}
      </section>

      {/* Instantáneas */}
      <section className={card}>
        <h2 className="text-lg font-semibold">{t("serverDetail.snapshotsHeading")}</h2>
        <p className="mt-1 mb-5 text-sm text-[var(--color-fg-muted)]">
          {t("serverDetail.snapshotsIntro")}
        </p>

        <div className="flex flex-wrap gap-3">
          <input
            type="text"
            value={snapshotNombre}
            onChange={(e) => setSnapshotNombre(e.target.value)}
            placeholder={t("serverDetail.snapshotNamePlaceholder")}
            maxLength={255}
            className="min-w-0 flex-1 rounded-[var(--radius-md)] border border-[var(--color-line-strong)] bg-[var(--color-bg-base)] px-3 py-2.5 text-sm placeholder:text-[var(--color-fg-dim)] focus:border-[var(--color-accent)] focus:outline-none sm:flex-none sm:w-64"
          />
          <button type="button" className={boton} disabled={trabajando} onClick={crearSnapshot}>
            {t("serverDetail.snapshotCreate")}
          </button>
        </div>

        {snapshots.length > 0 && (
          <ul className="mt-5 grid gap-3">
            {snapshots.map((s) => (
              <li
                key={s.id}
                className="flex min-w-0 flex-wrap items-center justify-between gap-3 border-t border-[var(--color-line)] pt-3 first:border-0 first:pt-0"
              >
                <div className="min-w-0">
                  <p className="text-sm break-words text-[var(--color-fg)]">{s.name}</p>
                  <p className="font-mono text-xs text-[var(--color-fg-muted)]">
                    {bytes(s.sizeBytes)} · {s.status}
                  </p>
                </div>
                <div className="flex shrink-0 gap-3">
                  <button
                    type="button"
                    disabled={trabajando}
                    onClick={() => snapshotAccion(s.id, "revertir")}
                    className="text-xs text-[var(--color-accent)] transition-colors hover:underline disabled:opacity-40"
                  >
                    {t("serverDetail.snapshotRevert")}
                  </button>
                  <button
                    type="button"
                    disabled={trabajando}
                    onClick={() => snapshotAccion(s.id, "borrar")}
                    className="text-xs text-[var(--color-fg-muted)] transition-colors hover:text-[var(--color-danger)] disabled:opacity-40"
                  >
                    {t("serverDetail.snapshotDelete")}
                  </button>
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>

      {/* Consumo */}
      {(limits.length > 0 || server.usage.cpuPct !== null) && (
        <section className={card}>
          <h2 className="text-lg font-semibold">{t("serverDetail.usageHeading")}</h2>
          <dl className="mt-4 grid gap-3 text-sm">
            {server.usage.cpuPct !== null && (
              <div className="flex justify-between gap-4">
                <dt className="text-[var(--color-fg-muted)]">{t("serverDetail.usageCpu")}</dt>
                <dd className="font-mono">{server.usage.cpuPct}%</dd>
              </div>
            )}
            {server.usage.diskBytes !== null && (
              <div className="flex justify-between gap-4">
                <dt className="text-[var(--color-fg-muted)]">{t("serverDetail.usageDisk")}</dt>
                <dd className="font-mono">{bytes(server.usage.diskBytes)}</dd>
              </div>
            )}
            {server.usage.trafficInBytes !== null && (
              <div className="flex justify-between gap-4">
                <dt className="text-[var(--color-fg-muted)]">{t("serverDetail.usageTrafficIn")}</dt>
                <dd className="font-mono">{bytes(server.usage.trafficInBytes)}</dd>
              </div>
            )}
            {server.usage.trafficOutBytes !== null && (
              <div className="flex justify-between gap-4">
                <dt className="text-[var(--color-fg-muted)]">{t("serverDetail.usageTrafficOut")}</dt>
                <dd className="font-mono">{bytes(server.usage.trafficOutBytes)}</dd>
              </div>
            )}
            {limits.map((l) => (
              <div key={l.name} className="flex justify-between gap-4">
                <dt className="min-w-0 break-words text-[var(--color-fg-muted)]">{l.name}</dt>
                <dd
                  className={`shrink-0 font-mono ${l.isExceeded ? "text-[var(--color-danger)]" : ""}`}
                >
                  {l.used}
                  {l.limit !== null ? ` / ${l.limit}` : ""} {l.unit ?? ""}
                </dd>
              </div>
            ))}
          </dl>
        </section>
      )}

      {/* Reinstalación: la acción destructiva va la última y con confirmación */}
      <section className="rounded-[var(--radius-lg)] border border-[var(--color-danger)]/30 bg-[var(--color-bg-raised)] p-6 min-w-0">
        <h2 className="text-lg font-semibold">{t("serverDetail.reinstallHeading")}</h2>
        <p className="mt-1 mb-5 text-sm text-[var(--color-fg-muted)]">
          {t("serverDetail.reinstallIntro")}
        </p>

        {!reinstallOpen ? (
          <button type="button" className={boton} disabled={trabajando} onClick={abrirReinstalar}>
            {t("serverDetail.reinstallOpen")}
          </button>
        ) : !opciones ? (
          <p className="text-sm text-[var(--color-fg-muted)]">{t("serverDetail.loading")}</p>
        ) : (
          <div className="grid gap-5">
            <div>
              <label htmlFor="os" className="mono-label text-[0.6rem]">
                {t("serverDetail.reinstallOs")}
              </label>
              <select
                id="os"
                value={osElegido ?? ""}
                onChange={(e) => setOsElegido(Number(e.target.value))}
                className="mt-2 w-full min-w-0 rounded-[var(--radius-md)] border border-[var(--color-line-strong)] bg-[var(--color-bg-base)] px-3 py-2.5 text-sm focus:border-[var(--color-accent)] focus:outline-none"
              >
                {opciones.sistemas.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.label}
                  </option>
                ))}
              </select>
            </div>

            {osSeleccionado?.supportsSshKeys && opciones.claves.length > 0 && (
              <fieldset className="min-w-0">
                <legend className="mono-label text-[0.6rem]">
                  {t("serverDetail.reinstallKeys")}
                </legend>
                <div className="mt-2 grid gap-2">
                  {opciones.claves.map((k) => (
                    <label key={k.id} className="flex items-center gap-3 text-sm">
                      <input
                        type="checkbox"
                        checked={clavesElegidas.includes(k.id)}
                        onChange={(e) =>
                          setClavesElegidas((prev) =>
                            e.target.checked ? [...prev, k.id] : prev.filter((x) => x !== k.id)
                          )
                        }
                        className="h-4 w-4 accent-[var(--color-accent)]"
                      />
                      <span className="min-w-0 break-words">{k.name}</span>
                    </label>
                  ))}
                </div>
              </fieldset>
            )}

            <div>
              <label htmlFor="confirmacion" className="mono-label text-[0.6rem]">
                {t("serverDetail.reinstallConfirmLabel")}
              </label>
              <p className="mt-1 mb-2 text-xs text-[var(--color-fg-muted)]">
                {t("serverDetail.reinstallConfirmHint")}{" "}
                <span className="font-mono break-all text-[var(--color-fg)]">{server.name}</span>
              </p>
              <input
                id="confirmacion"
                type="text"
                value={confirmacion}
                onChange={(e) => setConfirmacion(e.target.value)}
                autoComplete="off"
                className="w-full min-w-0 rounded-[var(--radius-md)] border border-[var(--color-line-strong)] bg-[var(--color-bg-base)] px-3 py-2.5 font-mono text-sm focus:border-[var(--color-accent)] focus:outline-none"
              />
            </div>

            <div className="flex flex-wrap gap-3">
              <button
                type="button"
                disabled={trabajando || confirmacion.trim() !== server.name || !osElegido}
                onClick={reinstalar}
                className="inline-flex min-h-11 items-center justify-center rounded-[var(--radius-md)] bg-[var(--color-danger)] px-5 text-sm font-medium text-white transition-opacity hover:opacity-90 disabled:opacity-40"
              >
                {t("serverDetail.reinstallConfirm")}
              </button>
              <button
                type="button"
                onClick={() => {
                  setReinstallOpen(false);
                  setConfirmacion("");
                }}
                className="text-sm text-[var(--color-fg-muted)] transition-colors hover:text-[var(--color-fg)]"
              >
                {t("serverDetail.cancel")}
              </button>
            </div>
          </div>
        )}
      </section>
    </div>
  );
}
