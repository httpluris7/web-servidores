"use client";

import { useState } from "react";
import { useLocale, useTranslations } from "next-intl";
import { Link } from "@/i18n/navigation";
import { emailRe } from "@/lib/password";
import { Label, Input, FieldError } from "./Field";

/**
 * Petición del enlace para restablecer la contraseña.
 *
 * Tras enviar, el mensaje de confirmación es el mismo exista o no la cuenta:
 * decir "ese correo no está registrado" convertiría esta pantalla en un
 * comprobador de qué direcciones tienen cuenta. El API se comporta igual.
 */
export function ForgotPasswordForm() {
  const t = useTranslations("auth");
  const locale = useLocale();
  const [email, setEmail] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [formError, setFormError] = useState<string | null>(null);
  const [status, setStatus] = useState<"idle" | "sending" | "done">("idle");

  async function onSubmit(ev: React.FormEvent) {
    ev.preventDefault();
    setFormError(null);
    if (!emailRe.test(email.trim())) {
      setError(t("forgotForm.errorEmail"));
      return;
    }
    setError(null);
    setStatus("sending");

    try {
      const res = await fetch("/api/recuperar", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ email: email.trim(), locale }),
      });
      const data = await res.json().catch(() => null);
      if (!res.ok || !data?.ok) {
        if (data?.errors?.email) setError(data.errors.email);
        else setFormError(data?.error ?? t("forgotForm.errorGeneric"));
        setStatus("idle");
        return;
      }
      setStatus("done");
    } catch {
      setFormError(t("forgotForm.errorConnection"));
      setStatus("idle");
    }
  }

  if (status === "done") {
    return (
      <div className="rounded-[var(--radius-lg)] border border-[var(--color-accent)] bg-[var(--color-bg-raised)] p-8 glow-accent">
        <div className="font-mono text-sm text-[var(--color-accent)]">{t("forgotForm.sentKicker")}</div>
        <h2 className="mt-3 text-xl font-semibold">{t("forgotForm.sentTitle")}</h2>
        <p className="mt-2 text-sm text-[var(--color-fg-muted)]">{t("forgotForm.sentText")}</p>
        <p className="mt-4 text-sm text-[var(--color-fg-dim)]">{t("forgotForm.sentSpam")}</p>
        <p className="mt-6 text-sm">
          <Link href="/acceder" className="text-[var(--color-accent)] underline">
            {t("forgotForm.backToLogin")}
          </Link>
        </p>
      </div>
    );
  }

  return (
    <form onSubmit={onSubmit} noValidate className="space-y-5">
      <p className="text-sm text-[var(--color-fg-muted)]">{t("forgotForm.intro")}</p>

      <div>
        <Label htmlFor="email" required>
          {t("forgotForm.emailLabel")}
        </Label>
        <Input
          id="email"
          type="email"
          autoComplete="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder="tu@email.com"
          aria-invalid={!!error}
        />
        <FieldError>{error}</FieldError>
      </div>

      <button
        type="submit"
        disabled={status === "sending"}
        className="inline-flex w-full items-center justify-center rounded-[var(--radius-md)] bg-[var(--color-accent)] px-6 py-3.5 text-sm font-medium text-black transition-colors hover:bg-[var(--color-accent-dim)] disabled:opacity-60 sm:w-auto"
      >
        {status === "sending" ? t("forgotForm.submitting") : t("forgotForm.submit")}
      </button>

      {formError && (
        <p role="alert" className="text-sm text-[var(--color-danger)]">
          {formError}
        </p>
      )}

      <p className="text-sm text-[var(--color-fg-muted)]">
        <Link href="/acceder" className="text-[var(--color-accent)] underline">
          {t("forgotForm.backToLogin")}
        </Link>
      </p>
    </form>
  );
}
