"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
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
    if (!values.currentPassword) e.currentPassword = "Enter your current password.";
    if (failedPasswordRules(values.password).length > 0) e.password = "The password does not meet the requirements.";
    if (values.passwordConfirm !== values.password) e.passwordConfirm = "The passwords do not match.";
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
        setFormError(data?.error ?? "Could not change the password. Check the fields.");
        setStatus("idle");
        return;
      }
      setValues(empty);
      setErrors({});
      setStatus("idle");
      setDone(true);
      router.refresh();
    } catch {
      setFormError("Connection error. Check your network and try again.");
      setStatus("idle");
    }
  }

  return (
    <form onSubmit={onSubmit} noValidate className="max-w-md space-y-5">
      <div>
        <Label htmlFor="currentPassword" required>Current password</Label>
        <Input
          id="currentPassword"
          type="password"
          value={values.currentPassword}
          onChange={set("currentPassword")}
          placeholder="••••••••"
          autoComplete="current-password"
          aria-invalid={!!errors.currentPassword}
        />
        <FieldError>{errors.currentPassword}</FieldError>
      </div>

      <div>
        <Label htmlFor="password" required>New password</Label>
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
        <Label htmlFor="passwordConfirm" required>Repeat new password</Label>
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
        {status === "sending" ? "Saving…" : "Change password →"}
      </button>

      {formError && <p role="alert" className="text-sm text-[var(--color-danger)]">{formError}</p>}
      {done && (
        <p role="status" className="text-sm text-[var(--color-accent)]">
          Password updated successfully.
        </p>
      )}
    </form>
  );
}
