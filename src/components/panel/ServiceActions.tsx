"use client";

import { useCallback, useRef, useState } from "react";
import { useTranslations } from "next-intl";
import { useRouter } from "@/i18n/navigation";
import type { PowerState } from "@/lib/panel/types";
import { Icon, type IconName } from "./icons";
import { ACTION_TILE, ACTION_TILE_DANGER, CARD_PAD, SECTION_INDEX } from "./ui";

/** Notifica al historial de tareas que refresque ya (evita esperar al sondeo). */
function avisarHistorial() {
  window.dispatchEvent(new CustomEvent("panel:refresh-tasks"));
}

type AccionUI = {
  key: string;
  icon: IconName;
  /** Estados en los que aplica; [] = nunca (deshabilitada). */
  enabledWhen: PowerState[];
  danger?: boolean;
  /** Aún no implementada (Fase 6). */
  soon?: boolean;
};

const ACCIONES: AccionUI[] = [
  { key: "start", icon: "play", enabledWhen: ["apagado"] },
  { key: "restart", icon: "rotate", enabledWhen: ["encendido"] },
  { key: "stop", icon: "square", enabledWhen: ["encendido"], danger: true },
  { key: "shutdown", icon: "power", enabledWhen: ["encendido"] },
  { key: "reconfigNetwork", icon: "network", enabledWhen: [], soon: true },
  { key: "changePassword", icon: "key", enabledWhen: ["encendido"] },
];

// Clave de UI → vocabulario del BFF (/api/panel/servicios/[id]/accion).
const VOCAB: Record<string, string> = {
  start: "encender",
  restart: "reiniciar",
  shutdown: "apagar",
  stop: "parar",
  changePassword: "password",
};

/**
 * Rejilla "Acciones del servicio" (Fase 3), ya operativa y ASÍNCRONA: la acción
 * devuelve un UPID y se sondea la tarea sin bloquear la UI. "Parar" (corte de
 * energía) exige teclear el nombre del servidor. Al terminar una tarea se
 * revalida la página (`router.refresh`) para que el estado se actualice.
 */
export function ServiceActions({
  id,
  power,
  nombre,
}: {
  id: string;
  power: PowerState;
  nombre: string;
}) {
  const t = useTranslations("panel");
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [confirmText, setConfirmText] = useState("");
  const timer = useRef<ReturnType<typeof setInterval> | null>(null);

  const mensajeError = useCallback(
    (code: unknown, httpStatus: number): string => {
      switch (code) {
        case "busy":
          return t("power.errorBusy");
        case "confirmation_mismatch":
          return t("power.errorConfirmation");
        case "unsupported":
          return t("power.errorUnsupported");
        default:
          return httpStatus === 429 ? t("power.errorTooMany") : t("power.errorGeneric");
      }
    },
    [t],
  );

  const post = useCallback(
    async (accion: string, extra: Record<string, unknown> = {}) => {
      setError(null);
      setNotice(null);
      try {
        const res = await fetch(`/api/panel/servicios/${id}/accion`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ accion, ...extra }),
        });
        const json = await res.json().catch(() => null);
        if (!res.ok || !json?.ok) {
          setError(mensajeError(json?.error, res.status));
          return null;
        }
        return json as { ok: true; upid?: string; emailed?: boolean };
      } catch {
        setError(t("power.errorConnection"));
        return null;
      }
    },
    [id, mensajeError, t],
  );

  const sondear = useCallback(
    (upid: string) => {
      const inicio = Date.now();
      timer.current = setInterval(async () => {
        // Red de seguridad: no sondear indefinidamente.
        if (Date.now() - inicio > 5 * 60 * 1000) {
          if (timer.current) clearInterval(timer.current);
          setBusy(false);
          router.refresh();
          return;
        }
        try {
          const res = await fetch(
            `/api/panel/servicios/${id}/tarea?upid=${encodeURIComponent(upid)}`,
          );
          const j = await res.json().catch(() => null);
          if (j?.ok && j.done) {
            if (timer.current) clearInterval(timer.current);
            setBusy(false);
            setNotice(j.okResult === false ? t("power.taskFailed") : t("power.taskDone"));
            avisarHistorial();
            router.refresh();
          }
        } catch {
          /* fallo puntual de red: se reintenta en el siguiente tick */
        }
      }, 2000);
    },
    [id, router, t],
  );

  const energia = useCallback(
    async (uiKey: string, extra: Record<string, unknown> = {}) => {
      const accion = VOCAB[uiKey];
      if (!accion) return; // acción sin mapeo (p. ej. reconfigNetwork): nada que hacer
      setBusy(true);
      const r = await post(accion, extra);
      if (!r) {
        setBusy(false);
        return;
      }
      avisarHistorial();
      if (r.upid) {
        sondear(r.upid);
      } else {
        // Cambiar contraseña: no es tarea de Proxmox.
        setBusy(false);
        setNotice(t("power.passwordEmailed"));
      }
    },
    [post, sondear, t],
  );

  function onTile(a: AccionUI) {
    if (a.key === "stop") {
      setConfirmText("");
      setConfirmOpen(true);
      return;
    }
    void energia(a.key);
  }

  const trabajando = busy;

  return (
    <section id="acciones" className={`${CARD_PAD} scroll-mt-28`}>
      <p className={SECTION_INDEX}>/02</p>
      <h2 className="mt-2 text-lg font-semibold">{t("power.heading")}</h2>
      <p className="mt-1 mb-5 text-sm text-[var(--color-fg-muted)]">{t("power.intro")}</p>

      {error && (
        <p role="alert" className="mb-4 text-sm text-[var(--color-danger)]">
          {error}
        </p>
      )}
      {notice && <p className="mb-4 text-sm text-[var(--color-accent)]">{notice}</p>}
      {trabajando && <p className="mb-4 text-sm text-[var(--color-accent)]">{t("power.working")}</p>}

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
        {ACCIONES.map((a) => {
          const enabled = !a.soon && !trabajando && a.enabledWhen.includes(power);
          return (
            <button
              key={a.key}
              type="button"
              disabled={!enabled}
              onClick={() => onTile(a)}
              className={a.danger ? ACTION_TILE_DANGER : ACTION_TILE}
            >
              <span className="flex w-full items-center justify-between">
                <Icon name={a.icon} size={20} />
                {a.soon && (
                  <span className="rounded-full border border-[var(--color-line-strong)] px-2 py-0.5 text-[0.6rem] uppercase tracking-wide text-[var(--color-fg-dim)]">
                    {t("management.soon")}
                  </span>
                )}
              </span>
              <span className="text-sm font-medium">{t(`power.${a.key}`)}</span>
            </button>
          );
        })}
      </div>

      {confirmOpen && (
        <ConfirmStop
          nombre={nombre}
          text={confirmText}
          onText={setConfirmText}
          onCancel={() => setConfirmOpen(false)}
          onConfirm={() => {
            setConfirmOpen(false);
            void energia("stop", { confirmacion: confirmText });
          }}
        />
      )}
    </section>
  );
}

/** Confirmación de "Parar" (corte de energía): teclear el nombre del servidor. */
function ConfirmStop({
  nombre,
  text,
  onText,
  onCancel,
  onConfirm,
}: {
  nombre: string;
  text: string;
  onText: (v: string) => void;
  onCancel: () => void;
  onConfirm: () => void;
}) {
  const t = useTranslations("panel");
  const ok = text.trim() === nombre;
  return (
    <div className="mt-5 rounded-[var(--radius-md)] border border-[var(--color-danger)]/40 bg-[var(--color-bg-base)] p-5">
      <h3 className="text-sm font-semibold text-[var(--color-danger)]">{t("power.confirmTitle")}</h3>
      <p className="mt-1 text-sm text-[var(--color-fg-muted)]">{t("power.confirmBody")}</p>
      <p className="mt-2 mb-3 text-xs text-[var(--color-fg-muted)]">
        {t("power.confirmLabel")}{" "}
        <span className="font-mono break-all text-[var(--color-fg)]">{nombre}</span>
      </p>
      <input
        type="text"
        value={text}
        onChange={(e) => onText(e.target.value)}
        autoComplete="off"
        className="w-full min-w-0 rounded-[var(--radius-md)] border border-[var(--color-line-strong)] bg-[var(--color-bg-overlay)] px-3 py-2.5 font-mono text-sm focus:border-[var(--color-danger)] focus:outline-none"
      />
      <div className="mt-4 flex flex-wrap gap-3">
        <button
          type="button"
          disabled={!ok}
          onClick={onConfirm}
          className="inline-flex min-h-11 items-center justify-center rounded-[var(--radius-md)] bg-[var(--color-danger)] px-5 text-sm font-medium text-white transition-opacity hover:opacity-90 disabled:opacity-40"
        >
          {t("power.confirm")}
        </button>
        <button
          type="button"
          onClick={onCancel}
          className="text-sm text-[var(--color-fg-muted)] transition-colors hover:text-[var(--color-fg)]"
        >
          {t("power.cancel")}
        </button>
      </div>
    </div>
  );
}
