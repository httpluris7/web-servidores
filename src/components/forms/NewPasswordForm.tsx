"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { Link } from "@/i18n/navigation";
import { failedPasswordRules } from "@/lib/password";
import { Label, Input, FieldError } from "./Field";
import { PasswordRulesList } from "./PasswordRulesList";

type Errors = Partial<Record<"password" | "passwordConfirm", string>>;

/**
 * Nueva contraseña a partir del enlace del correo.
 *
 * Al terminar NO se abre sesión: quien llega con el enlace podría no ser el
 * dueño de la cuenta, así que se le manda al formulario de acceso a entrar con
 * la contraseña que acaba de fijar.
 */
export function NewPasswordForm({ token }: { token: string }) {
  const t = useTranslations("auth");
  const [values, setValues] = useState({ password: "", passwordConfirm: "" });
  const [errors, setErrors] = useState<Errors>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [tokenDead, setTokenDead] = useState(false);
  const [status, setStatus] = useState<"idle" | "sending" | "done">("idle");

  async function onSubmit(ev: React.FormEvent) {
    ev.preventDefault();
    setFormError(null);

    const e: Errors = {};
    if (failedPasswordRules(values.password).length > 0) e.password = t("newPasswordForm.errorPassword");
    if (values.passwordConfirm !== values.password) e.passwordConfirm = t("newPasswordForm.errorConfirm");
    setErrors(e);
    if (Object.keys(e).length > 0) return;

    setStatus("sending");
    try {
      const res = await fetch("/api/restablecer", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ token, ...values }),
      });
      const data = await res.json().catch(() => null);
      if (!res.ok || !data?.ok) {
        if (data?.error === "invalid_token") {
          setTokenDead(true);
          setStatus("idle");
          return;
        }
        if (data?.errors) setErrors(data.errors as Errors);
        else setFormError(data?.error ?? t("newPasswordForm.errorGeneric"));
        setStatus("idle");
        return;
      }
      setStatus("done");
    } catch {
      setFormError(t("newPasswordForm.errorConnection"));
      setStatus("idle");
    }
  }

  // El enlace ya no sirve (caducado o usado): se pide uno nuevo.
  if (tokenDead) {
    return (
      <div className="rounded-[var(--radius-lg)] border border-[var(--color-line)] bg-[var(--color-bg-raised)] p-8">
        <h2 className="text-xl font-semibold">{t("newPasswordForm.expiredTitle")}</h2>
        <p className="mt-2 text-sm text-[var(--color-fg-muted)]">{t("newPasswordForm.expiredText")}</p>
        <Link
          href="/recuperar"
          className="mt-6 inline-flex items-center justify-center rounded-[var(--radius-md)] bg-[var(--color-accent)] px-6 py-3 text-sm font-medium text-black transition-colors hover:bg-[var(--color-accent-dim)]"
        >
          {t("newPasswordForm.requestAgain")}
        </Link>
      </div>
    );
  }

  if (status === "done") {
    return (
      <div className="rounded-[var(--radius-lg)] border border-[var(--color-accent)] bg-[var(--color-bg-raised)] p-8 glow-accent">
        <div className="font-mono text-sm text-[var(--color-accent)]">{t("newPasswordForm.doneKicker")}</div>
        <h2 className="mt-3 text-xl font-semibold">{t("newPasswordForm.doneTitle")}</h2>
        <p className="mt-2 text-sm text-[var(--color-fg-muted)]">{t("newPasswordForm.doneText")}</p>
        <Link
          href="/acceder"
          className="mt-6 inline-flex items-center justify-center rounded-[var(--radius-md)] bg-[var(--color-accent)] px-6 py-3 text-sm font-medium text-black transition-colors hover:bg-[var(--color-accent-dim)]"
        >
          {t("newPasswordForm.goToLogin")}
        </Link>
      </div>
    );
  }

  return (
    <form onSubmit={onSubmit} noValidate className="space-y-5">
      <div>
        <Label htmlFor="password" required>
          {t("newPasswordForm.passwordLabel")}
        </Label>
        <Input
          id="password"
          type="password"
          autoComplete="new-password"
          value={values.password}
          onChange={(e) => setValues((v) => ({ ...v, password: e.target.value }))}
          aria-invalid={!!errors.password}
        />
        <PasswordRulesList password={values.password} />
        <FieldError>{errors.password}</FieldError>
      </div>

      <div>
        <Label htmlFor="passwordConfirm" required>
          {t("newPasswordForm.confirmLabel")}
        </Label>
        <Input
          id="passwordConfirm"
          type="password"
          autoComplete="new-password"
          value={values.passwordConfirm}
          onChange={(e) => setValues((v) => ({ ...v, passwordConfirm: e.target.value }))}
          aria-invalid={!!errors.passwordConfirm}
        />
        <FieldError>{errors.passwordConfirm}</FieldError>
      </div>

      <button
        type="submit"
        disabled={status === "sending"}
        className="inline-flex w-full items-center justify-center rounded-[var(--radius-md)] bg-[var(--color-accent)] px-6 py-3.5 text-sm font-medium text-black transition-colors hover:bg-[var(--color-accent-dim)] disabled:opacity-60 sm:w-auto"
      >
        {status === "sending" ? t("newPasswordForm.submitting") : t("newPasswordForm.submit")}
      </button>

      {formError && (
        <p role="alert" className="text-sm text-[var(--color-danger)]">
          {formError}
        </p>
      )}
    </form>
  );
}
