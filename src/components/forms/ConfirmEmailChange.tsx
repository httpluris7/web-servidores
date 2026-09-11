"use client";

import { useState } from "react";
import { useLocale, useTranslations } from "next-intl";
import { Link, useRouter } from "@/i18n/navigation";

/**
 * Botón de confirmación del cambio de email. El token no se consume al abrir
 * el enlace (los antivirus de correo los prefetchean) sino al pulsar.
 */
export function ConfirmEmailChange({ token, newEmail }: { token: string; newEmail: string }) {
  const t = useTranslations("auth");
  const locale = useLocale();
  const router = useRouter();
  const [status, setStatus] = useState<"idle" | "sending" | "done">("idle");
  const [error, setError] = useState<string | null>(null);

  async function confirm() {
    setError(null);
    setStatus("sending");
    try {
      const res = await fetch("/api/cuenta/email/confirmar", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ token, locale }),
      });
      const data = await res.json().catch(() => null);
      if (!res.ok || !data?.ok) {
        if (data?.error === "email_taken") setError(t("confirmEmail.errorTaken"));
        else if (data?.error === "invalid_token") setError(t("confirmEmail.errorToken"));
        else setError(t("confirmEmail.errorGeneric"));
        setStatus("idle");
        return;
      }
      setStatus("done");
      router.refresh();
    } catch {
      setError(t("confirmEmail.errorConnection"));
      setStatus("idle");
    }
  }

  if (status === "done") {
    return (
      <div className="rounded-[var(--radius-lg)] border border-[var(--color-line)] bg-[var(--color-bg-raised)] p-8">
        <p className="mono-label text-[var(--color-accent)]">{t("confirmEmail.doneKicker")}</p>
        <h2 className="mt-2 text-xl font-semibold">{t("confirmEmail.doneTitle")}</h2>
        <p className="mt-2 text-sm text-[var(--color-fg-muted)]">
          {t("confirmEmail.doneText", { email: newEmail })}
        </p>
        <Link
          href="/cuenta"
          className="mt-6 inline-flex items-center justify-center rounded-[var(--radius-md)] bg-[var(--color-accent)] px-6 py-3 text-sm font-medium text-black transition-colors hover:bg-[var(--color-accent-dim)]"
        >
          {t("confirmEmail.backToAccount")}
        </Link>
      </div>
    );
  }

  return (
    <div className="rounded-[var(--radius-lg)] border border-[var(--color-line)] bg-[var(--color-bg-raised)] p-8">
      <p className="text-sm text-[var(--color-fg-muted)]">{t("confirmEmail.text")}</p>
      <p className="mt-3 break-all text-base font-medium text-[var(--color-fg)]">{newEmail}</p>
      <p className="mt-3 text-sm text-[var(--color-fg-muted)]">{t("confirmEmail.sessionsNote")}</p>
      <div className="mt-6 flex flex-wrap gap-3">
        <button
          type="button"
          onClick={confirm}
          disabled={status === "sending"}
          className="inline-flex items-center justify-center rounded-[var(--radius-md)] bg-[var(--color-accent)] px-6 py-3 text-sm font-medium text-black transition-colors hover:bg-[var(--color-accent-dim)] disabled:opacity-60"
        >
          {status === "sending" ? t("confirmEmail.submitting") : t("confirmEmail.submit")}
        </button>
        <Link
          href="/cuenta"
          className="inline-flex min-h-11 items-center justify-center rounded-[var(--radius-md)] border border-[var(--color-line-strong)] px-6 text-sm transition-colors hover:border-[var(--color-accent)] hover:text-[var(--color-accent)]"
        >
          {t("confirmEmail.cancel")}
        </Link>
      </div>
      {error && <p role="alert" className="mt-4 text-sm text-[var(--color-danger)]">{error}</p>}
    </div>
  );
}
