"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useTranslations } from "next-intl";

/** Superficie mínima de noVNC que usamos (el paquete no trae tipos). */
interface RfbInstance {
  scaleViewport: boolean;
  clipViewport: boolean;
  focusOnClick: boolean;
  addEventListener(type: string, listener: (e: CustomEvent) => void): void;
  sendCtrlAltDel(): void;
  disconnect(): void;
}

type Estado = "idle" | "connecting" | "connected" | "closed" | "error";

/**
 * Consola noVNC embebida. Pide a `/api/cuenta/servidores/[id]/consola` un token
 * firmado + el ticket VNC, abre el websocket contra `/console-ws` (que nginx
 * enruta al provisioner) y deja que noVNC pinte la pantalla. El token y el ticket
 * son de un solo uso y caducan en segundos: si la sesión cae, se reconecta
 * pidiendo unos nuevos.
 */
export function ConsoleView({ id }: { id: string }) {
  const t = useTranslations("auth");
  const pantalla = useRef<HTMLDivElement>(null);
  const rfbRef = useRef<RfbInstance | null>(null);
  const [estado, setEstado] = useState<Estado>("idle");
  const [error, setError] = useState<string | null>(null);

  const desconectar = useCallback(() => {
    if (rfbRef.current) {
      try {
        rfbRef.current.disconnect();
      } catch {
        /* ya cerrado */
      }
      rfbRef.current = null;
    }
  }, []);

  const conectar = useCallback(async () => {
    setError(null);
    setEstado("connecting");
    desconectar();
    try {
      const res = await fetch(`/api/cuenta/servidores/${id}/consola`, { method: "POST" });
      const json = (await res.json().catch(() => ({}))) as {
        ok?: boolean;
        token?: string;
        ticket?: string;
        path?: string;
      };
      if (!res.ok || !json.ok || !json.token || !json.ticket) {
        setEstado("error");
        setError(t("serverDetail.errorConsole"));
        return;
      }

      const proto = window.location.protocol === "https:" ? "wss:" : "ws:";
      const url = `${proto}//${window.location.host}${json.path ?? "/console-ws"}?token=${encodeURIComponent(
        json.token,
      )}`;

      // Carga diferida: noVNC toca window/document, no puede correr en SSR.
      const { default: RFB } = (await import("@novnc/novnc")) as {
        default: new (
          target: HTMLElement,
          url: string,
          options?: { credentials?: { password?: string } },
        ) => RfbInstance;
      };
      if (!pantalla.current) return;
      pantalla.current.replaceChildren();

      const rfb = new RFB(pantalla.current, url, { credentials: { password: json.ticket } });
      rfb.scaleViewport = true;
      rfb.clipViewport = false;
      rfb.focusOnClick = true;
      rfb.addEventListener("connect", () => setEstado("connected"));
      rfb.addEventListener("disconnect", () => {
        setEstado("closed");
        rfbRef.current = null;
      });
      rfb.addEventListener("securityfailure", () => {
        setEstado("error");
        setError(t("serverDetail.errorConsole"));
        rfbRef.current = null;
      });
      rfbRef.current = rfb;
    } catch {
      setEstado("error");
      setError(t("serverDetail.errorConnection"));
    }
  }, [id, t, desconectar]);

  // Al desmontar, cerrar el websocket para no dejar la sesión VNC colgada.
  useEffect(() => () => desconectar(), [desconectar]);

  const boton =
    "inline-flex min-h-11 items-center justify-center rounded-[var(--radius-md)] border border-[var(--color-line-strong)] px-4 text-sm transition-colors hover:border-[var(--color-accent)] hover:text-[var(--color-accent)] disabled:opacity-40";

  return (
    <div className="grid gap-4">
      <div className="flex flex-wrap items-center gap-3">
        <button type="button" className={boton} onClick={conectar} disabled={estado === "connecting"}>
          {estado === "connected" || estado === "closed"
            ? t("serverDetail.consoleReconnect")
            : t("serverDetail.consoleConnect")}
        </button>
        <button
          type="button"
          className={boton}
          disabled={estado !== "connected"}
          onClick={() => rfbRef.current?.sendCtrlAltDel()}
        >
          {t("serverDetail.consoleCtrlAltDel")}
        </button>
        <span className="text-sm text-[var(--color-fg-muted)]">
          {estado === "connecting" && t("serverDetail.consoleConnecting")}
          {estado === "connected" && t("serverDetail.consoleConnected")}
          {estado === "closed" && t("serverDetail.consoleClosed")}
          {estado === "idle" && t("serverDetail.consoleIdle")}
        </span>
      </div>

      {error && (
        <p role="alert" className="text-sm text-[var(--color-danger)]">
          {error}
        </p>
      )}

      <div
        ref={pantalla}
        className="min-h-[60vh] w-full overflow-hidden rounded-[var(--radius-lg)] border border-[var(--color-line)] bg-black"
      />
      <p className="text-xs text-[var(--color-fg-dim)]">{t("serverDetail.consoleNote")}</p>
    </div>
  );
}
