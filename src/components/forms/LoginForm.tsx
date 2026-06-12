"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Label, Input, FieldError } from "./Field";
import { emailRe } from "@/lib/password";

type Errors = Partial<Record<"email" | "password", string>>;

export function LoginForm() {
  const router = useRouter();
  const [values, setValues] = useState({ email: "", password: "" });
  const [errors, setErrors] = useState<Errors>({});
  const [status, setStatus] = useState<"idle" | "sending">("idle");
  const [formError, setFormError] = useState<string | null>(null);

  function validate(): boolean {
    const e: Errors = {};
    if (!emailRe.test(values.email)) e.email = "Enter a valid email.";
    if (!values.password) e.password = "Enter your password.";
    setErrors(e);
    return Object.keys(e).length === 0;
  }

  async function onSubmit(ev: React.FormEvent) {
    ev.preventDefault();
    setFormError(null);
    if (!validate()) return;
    setStatus("sending");

    try {
      const res = await fetch("/api/login", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(values),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => null);
        if (data?.errors) setErrors(data.errors as Errors);
        setFormError(data?.error ?? "Could not log in.");
        setStatus("idle");
        return;
      }
      router.push("/cuenta");
      router.refresh();
    } catch {
      setFormError("Connection error. Check your network and try again.");
      setStatus("idle");
    }
  }

  return (
    <form onSubmit={onSubmit} noValidate className="space-y-5">
      <div>
        <Label htmlFor="email" required>Email</Label>
        <Input
          id="email"
          type="email"
          value={values.email}
          onChange={(e) => setValues((v) => ({ ...v, email: e.target.value }))}
          placeholder="tu@email.com"
          autoComplete="email"
          aria-invalid={!!errors.email}
        />
        <FieldError>{errors.email}</FieldError>
      </div>

      <div>
        <Label htmlFor="password" required>Password</Label>
        <Input
          id="password"
          type="password"
          value={values.password}
          onChange={(e) => setValues((v) => ({ ...v, password: e.target.value }))}
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
        {status === "sending" ? "Logging in…" : "Log in →"}
      </button>

      {formError && (
        <p role="alert" className="text-sm text-[var(--color-danger)]">{formError}</p>
      )}

      <p className="text-sm text-[var(--color-fg-muted)]">
        Don&apos;t have an account?{" "}
        <a href="/registro" className="text-[var(--color-accent)] underline">Sign up</a>.
      </p>
    </form>
  );
}
