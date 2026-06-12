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
    if (!values.currentPassword) e.currentPassword = "Introduce tu contraseña actual.";
    if (failedPasswordRules(values.password).length > 0) e.password = "La contraseña no cumple los requisitos.";
    if (values.passwordConfirm !== values.password) e.passwordConfirm = "Las contraseñas no coinciden.";
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
        setFormError(data?.error ?? "No se pudo cambiar la contraseña. Revisa los campos.");
        setStatus("idle");
        return;
      }
      setValues(empty);
      setErrors({});
      setStatus("idle");
      setDone(true);
      router.refresh();
    } catch {
      setFormError("Error de conexión. Revisa tu red e inténtalo de nuevo.");
      setStatus("idle");
    }
  }

  return (
    <form onSubmit={onSubmit} noValidate className="max-w-md space-y-5">
      <div>
        <Label htmlFor="currentPassword" required>Contraseña actual</Label>
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
        <Label htmlFor="password" required>Nueva contraseña</Label>
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
        <Label htmlFor="passwordConfirm" required>Repetir nueva contraseña</Label>
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
        {status === "sending" ? "Guardando…" : "Cambiar contraseña →"}
      </button>

      {formError && <p role="alert" className="text-sm text-[var(--color-danger)]">{formError}</p>}
      {done && (
        <p role="status" className="text-sm text-[var(--color-accent)]">
          Contraseña actualizada correctamente.
        </p>
      )}
    </form>
  );
}
