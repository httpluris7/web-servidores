"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useTranslations } from "next-intl";
import type { ProviderServer } from "@/lib/servidores/v4vm";
import { ServerStatusBadge } from "@/components/ui/ServerStatusBadge";

/** Cada cuánto se relee el estado mientras el VPS está trabajando. */
const POLL_MS = 5000;

/**
 * Panel de gestión de un VPS de nuestro Proxmox.
 *
 * Deliberadamente más simple que el de v4vm: encender/apagar/reiniciar y
 * reenviar credenciales. Consola, reinstalación y snapshots no se ofrecen por
 * aquí (pasan por soporte). Habla con la misma ruta de acciones, que enruta al
 * provisioner.
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
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const refresh = useCallback(async () => {
    try {
      const res = await fetch(`/api/cuenta/servidores/${id}`);
      if (!res.ok) return;
      const json = await res.json();
      if (json.ok && json.server) setServer(json.server as ProviderServer);
    } catch {
      // Un fallo de red puntual no debe romper la pantalla; se reintenta.
    }
  }, [id]);

  // Mientras se aprovisiona/trabaja, releemos el estado hasta que termine.
  useEffect(() => {
    if (!server.isProcessing) return;
    timer.current = setTimeout(refresh, POLL_MS);
    return () => {
      if (timer.current) clearTimeout(timer.current);
    };
  }, [server.isProcessing, refresh]);

  async function accion(nombre: string): Promise<{ ok: boolean } | null> {
    setError(null);
    setNotice(null);
    setBusy(nombre);
    try {
      const res = await fetch(`/api/cuenta/servidores/${id}/accion`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ accion: nombre }),
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok || !json.ok) {
        setError(t("serverDetail.errorGeneric"));
        return null;
      }
      return json;
    } catch {
      setError(t("serverDetail.errorGeneric"));
      return null;
    } finally {
      setBusy(null);
    }
  }

  async function power(cual: "encender" | "apagar" | "reiniciar") {
    const r = await accion(cual);
    if (r?.ok) {
      setNotice(t("serverDetail.taskStarted"));
      // Marcamos "en proceso" localmente para arrancar el sondeo.
      setServer((s) => ({ ...s, isProcessing: true }));
    }
  }

  async function reenviar() {
    const r = await accion("reenviar-credenciales");
    if (r?.ok) setNotice(t("serverDetail.credsSent"));
  }

  const trabajando = busy !== null || server.isProcessing;
  const encendido = server.status === "started" && !server.isProcessing;

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
            <p className="mt-1">
              {server.diskGb ?? "—"} GB · {server.location ?? "—"}
            </p>
            {server.osType && <p className="mt-1">{server.osType}</p>}
          </div>
        </div>
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
        <p className="mt-1 mb-5 text-sm text-[var(--color-fg-muted)]">
          {t("serverDetail.powerIntro")}
        </p>
        <div className="flex flex-wrap gap-3">
          <button
            type="button"
            className={boton}
            disabled={trabajando || encendido}
            onClick={() => power("encender")}
          >
            {t("serverDetail.start")}
          </button>
          <button
            type="button"
            className={boton}
            disabled={trabajando || !encendido}
            onClick={() => power("apagar")}
          >
            {t("serverDetail.stop")}
          </button>
          <button
            type="button"
            className={boton}
            disabled={trabajando || !encendido}
            onClick={() => power("reiniciar")}
          >
            {t("serverDetail.restart")}
          </button>
        </div>
      </section>

      {/* Credenciales */}
      <section className={card}>
        <h2 className="text-lg font-semibold">{t("serverDetail.credsHeading")}</h2>
        <p className="mt-1 mb-5 text-sm text-[var(--color-fg-muted)]">
          {t("serverDetail.credsIntro")}
        </p>
        <button
          type="button"
          className={boton}
          disabled={busy !== null}
          onClick={reenviar}
        >
          {t("serverDetail.credsButton")}
        </button>
      </section>
    </div>
  );
}
