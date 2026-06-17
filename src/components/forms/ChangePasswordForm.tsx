"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { useRouter } from "@/i18n/navigation";
import { Label, Input, FieldError } from "./Field";
import { PasswordRulesList } from "./PasswordRulesList";
import { failedPasswordRules } from "@/lib/password";

type FieldKey = "currentPassword" | "password" | "passwordConfirm";
type Errors = Partial<Record<FieldKey, string>>;

const empty: Record<FieldKey, string> = {
  currentPassword: "",
  password: "",
  passwordConfirm: "",
};

/** Cambio de contraseña del propio usuario (panel /cuenta). */
export function ChangePasswordForm() {
  const t = useTranslations("auth");
  const router = useRouter();
  const [values, setValues] = useState<Record<FieldKey, string>>(empty);
  const [errors, setErrors] = useState<Errors>({});
  const [status, setStatus] = useState<"idle" | "sending">("idle");
  const [formError, setFormError] = useState<string | null>(null);
  const [done, setDone] = useState(false);

  const set = (k: FieldKey) => (e: React.ChangeEvent<HTMLInputElement>) => {
    setValues((v) => ({ ...v, [k]: e.target.value }));
    setDone(false);
  };

  function validate(): boolean {
    const e: Errors = {};
    if (!values.currentPassword) e.currentPassword = t("changePasswordForm.errorCurrent");
    if (failedPasswordRules(values.password).length > 0) e.password = t("changePasswordForm.errorPassword");
    if (values.passwordConfirm !== values.password) e.passwordConfirm = t("changePasswordForm.errorConfirm");
    setErrors(e);
    return Object.keys(e).length === 0;
  }

  async function onSubmit(ev: React.FormEvent) {
    ev.preventDefault();
    setFormError(null);
    setDone(false);
    if (!validate()) return;
    setStatus("sending");

    try {
      const res = await fetch("/api/cuenta/password", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(values),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => null);
        if (data?.errors) setErrors(data.errors as Errors);
        setFormError(data?.error ?? t("changePasswordForm.errorGeneric"));
        setStatus("idle");
        return;
      }
      setValues(empty);
      setErrors({});
      setStatus("idle");
      setDone(true);
      router.refresh();
    } catch {
      setFormError(t("changePasswordForm.errorConnection"));
      setStatus("idle");
    }
  }

  return (
    <form onSubmit={onSubmit} noValidate className="max-w-md space-y-5">
      <div>
        <Label htmlFor="currentPassword" required>{t("changePasswordForm.currentLabel")}</Label>
        <Input
          id="currentPassword"
          type="password"
          value={values.currentPassword}
          onChange={set("currentPassword")}
          placeholder={t("changePasswordForm.placeholder")}
          autoComplete="current-password"
          aria-invalid={!!errors.currentPassword}
        />
        <FieldError>{errors.currentPassword}</FieldError>
      </div>

      <div>
        <Label htmlFor="password" required>{t("changePasswordForm.newLabel")}</Label>
        <Input
          id="password"
          type="password"
          value={values.password}
          onChange={set("password")}
          placeholder={t("changePasswordForm.placeholder")}
          autoComplete="new-password"
          aria-invalid={!!errors.password}
        />
        <PasswordRulesList password={values.password} />
        <FieldError>{errors.password}</FieldError>
      </div>

      <div>
        <Label htmlFor="passwordConfirm" required>{t("changePasswordForm.repeatLabel")}</Label>
        <Input
          id="passwordConfirm"
          type="password"
          value={values.passwordConfirm}
          onChange={set("passwordConfirm")}
          placeholder={t("changePasswordForm.placeholder")}
          autoComplete="new-password"
          aria-invalid={!!errors.passwordConfirm}
        />
        <FieldError>{errors.passwordConfirm}</FieldError>
      </div>

      <button
        type="submit"
        disabled={status === "sending"}
        className="inline-flex w-full items-center justify-center rounded-[var(--radius-md)] bg-[var(--color-accent)] px-6 py-3.5 text-sm font-medium text-black transition-colors hover:bg-[var(--color-accent-dim)] disabled:opacity-60 sm:w-auto"
      >
        {status === "sending" ? t("changePasswordForm.submitting") : t("changePasswordForm.submit")}
      </button>

      {formError && <p role="alert" className="text-sm text-[var(--color-danger)]">{formError}</p>}
      {done && (
        <p role="status" className="text-sm text-[var(--color-accent)]">
          {t("changePasswordForm.success")}
        </p>
      )}
    </form>
  );
}
