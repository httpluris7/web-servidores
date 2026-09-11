"use client";

import { useState } from "react";
import { useLocale, useTranslations } from "next-intl";
import { Label, Input, FieldError } from "./Field";
import { emailRe } from "@/lib/password";

type FieldKey = "email" | "password";
type Errors = Partial<Record<FieldKey, string>>;

/**
 * Cambio de email del propio usuario (panel /cuenta). No cambia nada al
 * enviar: manda un enlace de confirmación a la dirección nueva.
 */
export function ChangeEmailForm({ currentEmail, locked }: { currentEmail: string; locked: boolean }) {
  const t = useTranslations("auth");
  const locale = useLocale();
  const [values, setValues] = useState<Record<FieldKey, string>>({ email: "", password: "" });
  const [errors, setErrors] = useState<Errors>({});
  const [status, setStatus] = useState<"idle" | "sending">("idle");
  const [formError, setFormError] = useState<string | null>(null);
  const [sentTo, setSentTo] = useState<string | null>(null);

  const set = (k: FieldKey) => (e: React.ChangeEvent<HTMLInputElement>) => {
    setValues((v) => ({ ...v, [k]: e.target.value }));
    setSentTo(null);
  };

  function validate(): boolean {
    const e: Errors = {};
    const email = values.email.trim().toLowerCase();
    if (!emailRe.test(email)) e.email = t("changeEmailForm.errorEmail");
    else if (email === currentEmail.toLowerCase()) e.email = t("changeEmailForm.errorSame");
    if (!values.password) e.password = t("changeEmailForm.errorPassword");
    setErrors(e);
    return Object.keys(e).length === 0;
  }

  async function onSubmit(ev: React.FormEvent) {
    ev.preventDefault();
    setFormError(null);
    setSentTo(null);
    if (!validate()) return;
    setStatus("sending");

    try {
      const res = await fetch("/api/cuenta/email", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ ...values, locale }),
      });
      const data = await res.json().catch(() => null);
      if (!res.ok || !data?.ok) {
        if (data?.errors) {
          const e = data.errors as Errors;
          setErrors({
            email: e.email
              ? res.status === 409
                ? t("changeEmailForm.errorTaken")
                : t("changeEmailForm.errorSame")
              : undefined,
            password: e.password ? t("changeEmailForm.errorWrongPassword") : undefined,
          });
        }
        if (data?.error === "admin_locked") setFormError(t("changeEmailForm.errorAdmin"));
        else if (res.status === 429) setFormError(t("changeEmailForm.errorRate"));
        else if (!data?.errors) setFormError(t("changeEmailForm.errorGeneric"));
        setStatus("idle");
        return;
      }
      setSentTo(data.email as string);
      setValues({ email: "", password: "" });
      setErrors({});
      setStatus("idle");
    } catch {
      setFormError(t("changeEmailForm.errorConnection"));
      setStatus("idle");
    }
  }

  if (locked) {
    return <p className="text-sm text-[var(--color-fg-muted)]">{t("changeEmailForm.errorAdmin")}</p>;
  }

  if (sentTo) {
    return (
      <div className="rounded-[var(--radius-lg)] border border-[var(--color-line)] bg-[var(--color-bg-raised)] p-6">
        <p className="mono-label text-[var(--color-accent)]">{t("changeEmailForm.sentKicker")}</p>
        <h3 className="mt-2 text-lg font-semibold">{t("changeEmailForm.sentTitle")}</h3>
        <p className="mt-2 text-sm text-[var(--color-fg-muted)]">
          {t("changeEmailForm.sentText", { email: sentTo })}
        </p>
        <p className="mt-2 text-sm text-[var(--color-fg-muted)]">{t("changeEmailForm.sentSpam")}</p>
        <button
          type="button"
          onClick={() => setSentTo(null)}
          className="mt-5 text-sm text-[var(--color-fg-muted)] underline-offset-4 hover:text-[var(--color-accent)] hover:underline"
        >
          {t("changeEmailForm.again")}
        </button>
      </div>
    );
  }

  return (
    <form onSubmit={onSubmit} noValidate className="max-w-md space-y-5">
      <div>
        <Label htmlFor="newEmail" required>{t("changeEmailForm.emailLabel")}</Label>
        <Input
          id="newEmail"
          type="email"
          value={values.email}
          onChange={set("email")}
          placeholder={t("changeEmailForm.emailPlaceholder")}
          autoComplete="email"
          aria-invalid={!!errors.email}
        />
        <FieldError>{errors.email}</FieldError>
      </div>

      <div>
        <Label htmlFor="emailPassword" required>{t("changeEmailForm.passwordLabel")}</Label>
        <Input
          id="emailPassword"
          type="password"
          value={values.password}
          onChange={set("password")}
          placeholder="••••••••"
          autoComplete="current-password"
          aria-invalid={!!errors.password}
        />
        <FieldError>{errors.password}</FieldError>
      </div>

      <button
        type="submit"
        disabled={status === "sending"}
        className="inline-flex w-full items-center justify-center rounded-[var(--radius-md)] bg-[var(--color-accent)] px-6 py-3.5 text-sm font-medium text-black transition-colors hover:bg-[var(--color-accent-dim)] disabled:opacity-60 sm:w-auto"
      >
        {status === "sending" ? t("changeEmailForm.submitting") : t("changeEmailForm.submit")}
      </button>

      {formError && <p role="alert" className="text-sm text-[var(--color-danger)]">{formError}</p>}
    </form>
  );
}
