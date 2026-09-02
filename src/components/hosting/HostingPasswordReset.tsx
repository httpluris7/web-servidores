"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";

/**
 * Botón para resetear la contraseña de cPanel de una cuenta del cliente.
 *
 * Pide confirmación (evita resets accidentales), llama a la API y muestra la
 * nueva contraseña UNA vez (con copiar). La contraseña no se guarda ni se
 * vuelve a mostrar: si se pierde, se resetea otra vez.
 */
export function HostingPasswordReset({ cpanelUser }: { cpanelUser: string }) {
  const t = useTranslations("hosting");
  const [status, setStatus] = useState<"idle" | "confirming" | "working" | "done" | "error">("idle");
  const [password, setPassword] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  async function reset() {
    setStatus("working");
    setError(null);
    try {
      const res = await fetch(`/api/cuenta/hosting/${encodeURIComponent(cpanelUser)}/password`, {
        method: "POST",
      });
      const data = await res.json().catch(() => null);
      if (res.status === 429) {
        setError(t("mis.resetTooMany"));
        setStatus("error");
        return;
      }
      if (!res.ok || !data?.ok || typeof data.password !== "string") {
        setError(t("mis.resetError"));
        setStatus("error");
        return;
      }
      setPassword(data.password);
      setStatus("done");
    } catch {
      setError(t("mis.resetError"));
      setStatus("error");
    }
  }

  async function copy() {
    if (!password) return;
    try {
      await navigator.clipboard.writeText(password);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      /* sin clipboard: el cliente selecciona a mano */
    }
  }

  if (status === "done" && password) {
    return (
      <div className="mt-4 rounded-[var(--radius-md)] border border-[var(--color-accent)]/40 bg-[var(--color-accent)]/5 p-4">
        <p className="mono-label text-[0.6rem]">{t("mis.resetDoneTitle")}</p>
        <div className="mt-2 flex items-center gap-2">
          <code className="flex-1 break-all rounded bg-[var(--color-bg-base)] px-3 py-2 font-mono text-sm text-[var(--color-fg)]">
            {password}
          </code>
          <button
            type="button"
            onClick={copy}
            className="shrink-0 rounded-[var(--radius-md)] border border-[var(--color-line-strong)] px-3 py-2 text-xs transition-colors hover:border-[var(--color-accent)]"
          >
            {copied ? t("mis.copied") : t("mis.copy")}
          </button>
        </div>
        <p className="mt-2 text-xs text-[var(--color-fg-muted)]">{t("mis.resetDoneNote")}</p>
      </div>
    );
  }

  return (
    <div className="mt-4">
      {status === "confirming" ? (
        <div className="flex flex-wrap items-center gap-3">
          <span className="text-xs text-[var(--color-fg-muted)]">{t("mis.resetConfirm")}</span>
          <button
            type="button"
            onClick={reset}
            className="rounded-[var(--radius-md)] bg-[var(--color-accent)] px-4 py-2 text-xs font-medium text-black transition-colors hover:bg-[var(--color-accent-dim)]"
          >
            {t("mis.resetConfirmYes")}
          </button>
          <button
            type="button"
            onClick={() => setStatus("idle")}
            className="text-xs text-[var(--color-fg-muted)] transition-colors hover:text-[var(--color-fg)]"
          >
            {t("mis.resetCancel")}
          </button>
        </div>
      ) : (
        <button
          type="button"
          onClick={() => setStatus("confirming")}
          disabled={status === "working"}
          className="rounded-[var(--radius-md)] border border-[var(--color-line-strong)] px-4 py-2 text-xs transition-colors hover:border-[var(--color-accent)] hover:text-[var(--color-accent)] disabled:opacity-60"
        >
          {status === "working" ? t("mis.resetting") : t("mis.resetPassword")}
        </button>
      )}
      {error && (
        <p role="alert" className="mt-2 text-xs text-[var(--color-danger)]">
          {error}
        </p>
      )}
    </div>
  );
}
