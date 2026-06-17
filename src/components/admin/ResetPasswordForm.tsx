"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { useRouter } from "@/i18n/navigation";
import { Label, Input, FieldError } from "@/components/forms/Field";
import { PasswordRulesList } from "@/components/forms/PasswordRulesList";
import { failedPasswordRules } from "@/lib/password";

type FieldKey = "password" | "passwordConfirm";
type Errors = Partial<Record<FieldKey, string>>;

const empty: Record<FieldKey, string> = { password: "", passwordConfirm: "" };

/** Restablecimiento administrativo de la contraseña de un cliente. */
export function ResetPasswordForm({ userId }: { userId: string }) {
  const t = useTranslations("admin");
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
    if (failedPasswordRules(values.password).length > 0) e.password = t("resetPasswordForm.errorRequirements");
    if (values.passwordConfirm !== values.password) e.passwordConfirm = t("resetPasswordForm.errorMismatch");
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
      const res = await fetch(`/api/admin/clientes/${userId}/password`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(values),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => null);
        if (data?.errors) setErrors(data.errors as Errors);
        setFormError(data?.error ?? t("resetPasswordForm.errorCouldNotReset"));
        setStatus("idle");
        return;
      }
      setValues(empty);
      setErrors({});
      setStatus("idle");
      setDone(true);
      router.refresh();
    } catch {
      setFormError(t("resetPasswordForm.errorConnection"));
      setStatus("idle");
    }
  }

  return (
    <form onSubmit={onSubmit} noValidate className="max-w-md space-y-5">
      <div>
        <Label htmlFor="password" required>{t("resetPasswordForm.newPassword")}</Label>
        <Input
          id="password"
          type="password"
          value={values.password}
          onChange={set("password")}
          placeholder="••••••••"
          autoComplete="new-password"
          aria-invalid={!!errors.password}
        />
        <PasswordRulesList password={values.password} />
        <FieldError>{errors.password}</FieldError>
      </div>

      <div>
        <Label htmlFor="passwordConfirm" required>{t("resetPasswordForm.repeatNewPassword")}</Label>
        <Input
          id="passwordConfirm"
          type="password"
          value={values.passwordConfirm}
          onChange={set("passwordConfirm")}
          placeholder="••••••••"
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
        {status === "sending" ? t("resetPasswordForm.saving") : t("resetPasswordForm.submit")}
      </button>

      {formError && <p role="alert" className="text-sm text-[var(--color-danger)]">{formError}</p>}
      {done && (
        <p role="status" className="text-sm text-[var(--color-accent)]">
          {t("resetPasswordForm.success")}
        </p>
      )}
    </form>
  );
}
