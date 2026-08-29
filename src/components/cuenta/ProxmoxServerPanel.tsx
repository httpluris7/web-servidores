"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useTranslations } from "next-intl";
import { Link } from "@/i18n/navigation";
import type { ProviderServer } from "@/lib/servidores/v4vm";
import { OS_OFERTABLES } from "@/lib/provisioner/os";
import { ServerStatusBadge } from "@/components/ui/ServerStatusBadge";

/** Cada cuánto se relee el estado mientras el VPS está trabajando. */
const POLL_MS = 5000;

type Snapshot = { name: string; description?: string; snaptime?: number };

/**
 * Panel de gestión de un VPS de nuestro Proxmox.
 *
 * Ofrece las mismas operaciones que permite Proxmox a un cliente: energía
 * completa (apagado ACPI, parada dura, reinicio, reset, suspender/reanudar),
 * reinstalación del SO, reset de la contraseña de root, snapshots y (en la
 * consola) acceso noVNC. Todo enruta al provisioner por la ruta de acciones.
 */
export function ProxmoxServerPanel({
  id,
  initialServer,
}: {
  id: string;
  initialServer: ProviderServer;
}) {
  const t = useTranslations("auth");
  const [server, setServer] = useState(initialServer);
  const [snapshots, setSnapshots] = useState<Snapshot[]>([]);
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  // Reinstalación
  const [reinstallOpen, setReinstallOpen] = useState(false);
  const [osElegido, setOsElegido] = useState<string>(OS_OFERTABLES[0]?.slug ?? "");
  const [confirmacion, setConfirmacion] = useState("");

  // Snapshots
  const [snapshotNombre, setSnapshotNombre] = useState("");

  const ip = server.ipv4[0] ?? "";

  const refresh = useCallback(async () => {
    try {
      const res = await fetch(`/api/cuenta/servidores/${id}`);
      if (!res.ok) return;
      const json = await res.json();
      if (json.ok && json.server) setServer(json.server as ProviderServer);
    } catch {
      /* fallo puntual de red: se reintenta */
    }
  }, [id]);

  const cargarSnapshots = useCallback(async () => {
    try {
      const res = await fetch(`/api/cuenta/servidores/${id}/accion`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ accion: "snapshot-listar" }),
      });
      const json = await res.json().catch(() => null);
      if (json?.ok && Array.isArray(json.snapshots)) setSnapshots(json.snapshots as Snapshot[]);
    } catch {
      /* si falla, la sección de snapshots queda vacía */
    }
  }, [id]);

  // Snapshots al montar.
  useEffect(() => {
    void cargarSnapshots();
  }, [cargarSnapshots]);

  // Mientras trabaja (p. ej. reinstalando), releemos el estado.
  const eraProcesando = useRef(server.isProcessing);
  useEffect(() => {
    if (!server.isProcessing) {
      if (eraProcesando.current) {
        eraProcesando.current = false;
        void refresh();
        void cargarSnapshots();
      }
      return;
    }
    eraProcesando.current = true;
    const timer = setInterval(() => void refresh(), POLL_MS);
    return () => clearInterval(timer);
  }, [server.isProcessing, refresh, cargarSnapshots]);

  async function accion(nombre: string, extra: Record<string, unknown> = {}) {
    setError(null);
    setNotice(null);
    setBusy(nombre);
    try {
      const res = await fetch(`/api/cuenta/servidores/${id}/accion`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ accion: nombre, ...extra }),
      });
      const json = await res.json().catch(() => null);
      if (!res.ok || !json?.ok) {
        const code = json?.error;
        setError(
          code === "busy"
            ? t("serverDetail.errorBusy")
            : code === "confirmation_mismatch"
              ? t("serverDetail.errorConfirmation")
              : code === "unsupported"
                ? t("serverDetail.errorUnsupported")
                : res.status === 429
                  ? t("serverDetail.errorTooMany")
                  : t("serverDetail.errorGeneric"),
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

  async function power(cual: string) {
    const r = await accion(cual);
    if (r) {
      setNotice(t("serverDetail.taskStarted"));
      setServer((s) => ({ ...s, isProcessing: true }));
    }
  }

  async function reenviar() {
    const r = await accion("reenviar-credenciales");
    if (r) setNotice(t("serverDetail.credsSent"));
  }

  async function nuevaPassword() {
    const r = await accion("password");
    if (r) setNotice(t("serverDetail.passwordEmailed"));
  }

  async function crearSnapshot() {
    const r = await accion("snapshot-crear", { nombre: snapshotNombre });
    if (r) {
      setSnapshotNombre("");
      setNotice(t("serverDetail.snapshotCreated"));
      void cargarSnapshots();
    }
  }

  async function snapshotAccion(name: string, cual: "revertir" | "borrar") {
    const r = await accion(`snapshot-${cual}`, { nombre: name });
    if (r) {
      setNotice(cual === "revertir" ? t("serverDetail.taskStarted") : t("serverDetail.snapshotDeleted"));
      void cargarSnapshots();
    }
  }

  async function reinstalar() {
    const r = await accion("reinstalar", { os: osElegido, confirmacion });
    if (r) {
      setReinstallOpen(false);
      setConfirmacion("");
      setNotice(t("serverDetail.reinstallStarted"));
      setServer((s) => ({ ...s, isProcessing: true }));
    }
  }

  const trabajando = busy !== null || server.isProcessing;
  const encendido = server.status === "started" && !server.isProcessing;
  const suspendido = server.isSuspended;

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
            <p className="mt-3 font-mono text-sm break-words text-[var(--color-fg-muted)]">{ip || "—"}</p>
          </div>
          <div className="text-right font-mono text-xs text-[var(--color-fg-muted)]">
            <p>
              {server.vcpu ?? "—"} vCPU · {server.ramMb ? Math.round(server.ramMb / 1024) : "—"} GB
            </p>
            <p className="mt-1">
              {server.diskGb ?? "—"} GB · {server.location ?? "—"}
            </p>
            {server.osType && <p className="mt-1">{server.osType}</p>}
          </div>
        </div>
        {server.isProcessing && (
          <p className="mt-4 text-sm text-[var(--color-accent)]">{t("serverDetail.working")}</p>
        )}
      </section>

      {error && (
        <p role="alert" className="text-sm text-[var(--color-danger)]">
          {error}
        </p>
      )}
      {notice && <p className="text-sm text-[var(--color-accent)]">{notice}</p>}

      {/* Energía */}
      <section className={card}>
        <h2 className="text-lg font-semibold">{t("serverDetail.powerHeading")}</h2>
        <p className="mt-1 mb-5 text-sm text-[var(--color-fg-muted)]">{t("serverDetail.powerIntro")}</p>
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
          {suspendido ? (
            <button type="button" className={boton} disabled={busy !== null} onClick={() => power("reanudar")}>
              {t("serverDetail.resume")}
            </button>
          ) : (
            <button type="button" className={boton} disabled={trabajando || !encendido} onClick={() => power("suspender")}>
              {t("serverDetail.suspend")}
            </button>
          )}
        </div>
        {/* Acciones "duras": menos visibles, para casos en que el SO no responde. */}
        <div className="mt-4 flex flex-wrap gap-4 border-t border-[var(--color-line)] pt-4 text-xs">
          <button
            type="button"
            disabled={trabajando}
            onClick={() => power("apagar-forzado")}
            className="text-[var(--color-fg-muted)] transition-colors hover:text-[var(--color-danger)] disabled:opacity-40"
          >
            {t("serverDetail.forceStop")}
          </button>
          <button
            type="button"
            disabled={trabajando}
            onClick={() => power("reset")}
            className="text-[var(--color-fg-muted)] transition-colors hover:text-[var(--color-danger)] disabled:opacity-40"
          >
            {t("serverDetail.hardReset")}
          </button>
        </div>
      </section>

      {/* Consola noVNC */}
      <section className={card}>
        <h2 className="text-lg font-semibold">{t("serverDetail.consoleHeading")}</h2>
        <p className="mt-1 mb-5 text-sm text-[var(--color-fg-muted)]">{t("serverDetail.consoleIntro")}</p>
        <Link href={`/cuenta/servidores/${id}/consola`} className={boton}>
          {t("serverDetail.console")}
        </Link>
      </section>

      {/* Contraseña de root */}
      <section className={card}>
        <h2 className="text-lg font-semibold">{t("serverDetail.passwordHeading")}</h2>
        <p className="mt-1 mb-5 text-sm text-[var(--color-fg-muted)]">{t("serverDetail.passwordProxmoxIntro")}</p>
        <button type="button" className={boton} disabled={trabajando} onClick={nuevaPassword}>
          {t("serverDetail.passwordButton")}
        </button>
      </section>

      {/* Credenciales */}
      <section className={card}>
        <h2 className="text-lg font-semibold">{t("serverDetail.credsHeading")}</h2>
        <p className="mt-1 mb-5 text-sm text-[var(--color-fg-muted)]">{t("serverDetail.credsIntro")}</p>
        <button type="button" className={boton} disabled={busy !== null} onClick={reenviar}>
          {t("serverDetail.credsButton")}
        </button>
      </section>

      {/* Snapshots */}
      <section className={card}>
        <h2 className="text-lg font-semibold">{t("serverDetail.snapshotsHeading")}</h2>
        <p className="mt-1 mb-5 text-sm text-[var(--color-fg-muted)]">{t("serverDetail.snapshotsIntro")}</p>
        <div className="flex flex-wrap gap-3">
          <input
            type="text"
            value={snapshotNombre}
            onChange={(e) => setSnapshotNombre(e.target.value)}
            placeholder={t("serverDetail.snapshotNamePlaceholder")}
            maxLength={40}
            className="min-w-0 flex-1 rounded-[var(--radius-md)] border border-[var(--color-line-strong)] bg-[var(--color-bg-base)] px-3 py-2.5 text-sm placeholder:text-[var(--color-fg-dim)] focus:border-[var(--color-accent)] focus:outline-none sm:flex-none sm:w-64"
          />
          <button type="button" className={boton} disabled={trabajando} onClick={crearSnapshot}>
            {t("serverDetail.snapshotCreate")}
          </button>
        </div>
        {snapshots.length > 0 ? (
          <ul className="mt-5 grid gap-3">
            {snapshots.map((s) => (
              <li
                key={s.name}
                className="flex min-w-0 flex-wrap items-center justify-between gap-3 border-t border-[var(--color-line)] pt-3 first:border-0 first:pt-0"
              >
                <div className="min-w-0">
                  <p className="text-sm break-words text-[var(--color-fg)]">{s.name}</p>
                  {s.snaptime && (
                    <p className="font-mono text-xs text-[var(--color-fg-muted)]">
                      {new Date(s.snaptime * 1000).toLocaleString()}
                    </p>
                  )}
                </div>
                <div className="flex shrink-0 gap-3">
                  <button
                    type="button"
                    disabled={trabajando}
                    onClick={() => snapshotAccion(s.name, "revertir")}
                    className="text-xs text-[var(--color-accent)] transition-colors hover:underline disabled:opacity-40"
                  >
                    {t("serverDetail.snapshotRevert")}
                  </button>
                  <button
                    type="button"
                    disabled={trabajando}
                    onClick={() => snapshotAccion(s.name, "borrar")}
                    className="text-xs text-[var(--color-fg-muted)] transition-colors hover:text-[var(--color-danger)] disabled:opacity-40"
                  >
                    {t("serverDetail.snapshotDelete")}
                  </button>
                </div>
              </li>
            ))}
          </ul>
        ) : (
          <p className="mt-5 text-sm text-[var(--color-fg-dim)]">{t("serverDetail.snapshotEmpty")}</p>
        )}
      </section>

      {/* Reinstalación: destructivo, al final y con confirmación por IP */}
      <section className="rounded-[var(--radius-lg)] border border-[var(--color-danger)]/30 bg-[var(--color-bg-raised)] p-6 min-w-0">
        <h2 className="text-lg font-semibold">{t("serverDetail.reinstallHeading")}</h2>
        <p className="mt-1 mb-5 text-sm text-[var(--color-fg-muted)]">{t("serverDetail.reinstallIntro")}</p>
        {!reinstallOpen ? (
          <button type="button" className={boton} disabled={trabajando} onClick={() => setReinstallOpen(true)}>
            {t("serverDetail.reinstallOpen")}
          </button>
        ) : (
          <div className="grid gap-5">
            <div>
              <label htmlFor="os" className="mono-label text-[0.6rem]">
                {t("serverDetail.reinstallOs")}
              </label>
              <select
                id="os"
                value={osElegido}
                onChange={(e) => setOsElegido(e.target.value)}
                className="mt-2 w-full min-w-0 rounded-[var(--radius-md)] border border-[var(--color-line-strong)] bg-[var(--color-bg-base)] px-3 py-2.5 text-sm focus:border-[var(--color-accent)] focus:outline-none"
              >
                {OS_OFERTABLES.map((o) => (
                  <option key={o.slug} value={o.slug}>
                    {o.label}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label htmlFor="confirmacion" className="mono-label text-[0.6rem]">
                {t("serverDetail.reinstallConfirmLabel")}
              </label>
              <p className="mt-1 mb-2 text-xs text-[var(--color-fg-muted)]">
                {t("serverDetail.reinstallConfirmIp")}{" "}
                <span className="font-mono break-all text-[var(--color-fg)]">{ip}</span>
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
                disabled={trabajando || confirmacion.trim() !== ip || !osElegido}
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
