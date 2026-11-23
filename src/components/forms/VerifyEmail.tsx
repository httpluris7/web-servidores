"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { Link, useRouter } from "@/i18n/navigation";

/**
 * Botón de activación de la cuenta. El token no se consume al abrir el enlace
 * (los antivirus de correo los prefetchean) sino al pulsar.
 */
export function VerifyEmail({ token, email }: { token: string; email: string }) {
  const t = useTranslations("auth");
  const router = useRouter();
  const [status, setStatus] = useState<"idle" | "sending" | "done">("idle");
  const [error, setError] = useState<string | null>(null);

  async function confirm() {
    setError(null);
    setStatus("sending");
    try {
      const res = await fetch("/api/verificar-email", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ token }),
      });
      const data = await res.json().catch(() => null);
      if (!res.ok || !data?.ok) {
        if (data?.error === "invalid_token") setError(t("verify.errorToken"));
        else setError(data?.error ?? t("verify.errorGeneric"));
        setStatus("idle");
        return;
      }
      setStatus("done");
      router.refresh();
    } catch {
      setError(t("verify.errorConnection"));
      setStatus("idle");
    }
  }

  if (status === "done") {
    return (
      <div className="rounded-[var(--radius-lg)] border border-[var(--color-accent)] bg-[var(--color-bg-raised)] p-8 glow-accent">
        <p className="mono-label text-[var(--color-accent)]">{t("verify.doneKicker")}</p>
        <h2 className="mt-2 text-xl font-semibold">{t("verify.doneTitle")}</h2>
        <p className="mt-2 text-sm text-[var(--color-fg-muted)]">{t("verify.doneText")}</p>
        <Link
          href="/cuenta"
          className="mt-6 inline-flex items-center justify-center rounded-[var(--radius-md)] bg-[var(--color-accent)] px-6 py-3 text-sm font-medium text-black transition-colors hover:bg-[var(--color-accent-dim)]"
        >
          {t("verify.goToAccount")}
        </Link>
      </div>
    );
  }

  return (
    <div className="rounded-[var(--radius-lg)] border border-[var(--color-line)] bg-[var(--color-bg-raised)] p-8">
      <p className="text-sm text-[var(--color-fg-muted)]">{t("verify.text")}</p>
      <p className="mt-3 break-all text-base font-medium text-[var(--color-fg)]">{email}</p>
      <div className="mt-6 flex flex-wrap gap-3">
        <button
          type="button"
          onClick={confirm}
          disabled={status === "sending"}
          className="inline-flex items-center justify-center rounded-[var(--radius-md)] bg-[var(--color-accent)] px-6 py-3 text-sm font-medium text-black transition-colors hover:bg-[var(--color-accent-dim)] disabled:opacity-60"
        >
          {status === "sending" ? t("verify.submitting") : t("verify.submit")}
        </button>
      </div>
      {error && <p role="alert" className="mt-4 text-sm text-[var(--color-danger)]">{error}</p>}
    </div>
  );
}
