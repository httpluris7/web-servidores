"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { Label, Input, FieldError } from "./Field";
import { emailRe, isPhoneValid, passwordRules, failedPasswordRules } from "@/lib/password";

type FieldKey =
  | "nombre"
  | "apellidos"
  | "direccion"
  | "ciudad"
  | "pais"
  | "telefono"
  | "codigoPostal"
  | "email"
  | "password";

type Values = Record<FieldKey, string>;
type Errors = Partial<Record<FieldKey | "terms", string>>;

const empty: Values = {
  nombre: "",
  apellidos: "",
  direccion: "",
  ciudad: "",
  pais: "",
  telefono: "",
  codigoPostal: "",
  email: "",
  password: "",
};

export function RegisterForm() {
  const router = useRouter();
  const [values, setValues] = useState<Values>(empty);
  const [terms, setTerms] = useState(false);
  const [errors, setErrors] = useState<Errors>({});
  const [status, setStatus] = useState<"idle" | "sending">("idle");
  const [formError, setFormError] = useState<string | null>(null);

  const set = (k: FieldKey) => (e: React.ChangeEvent<HTMLInputElement>) =>
    setValues((v) => ({ ...v, [k]: e.target.value }));

  const failedRules = useMemo(() => new Set(failedPasswordRules(values.password)), [values.password]);

  function validate(): boolean {
    const e: Errors = {};
    if (values.nombre.trim().length < 2) e.nombre = "Enter your name.";
    if (values.apellidos.trim().length < 2) e.apellidos = "Enter your last name.";
    if (values.direccion.trim().length < 3) e.direccion = "Enter your address.";
    if (values.ciudad.trim().length < 2) e.ciudad = "Enter your city.";
    if (values.pais.trim().length < 2) e.pais = "Enter your country.";
    if (!isPhoneValid(values.telefono)) e.telefono = "Enter a valid phone number.";
    if (values.codigoPostal.trim().length < 3) e.codigoPostal = "Enter your postal code.";
    if (!emailRe.test(values.email)) e.email = "Enter a valid email.";
    if (failedPasswordRules(values.password).length > 0) e.password = "The password does not meet the requirements.";
    if (!terms) e.terms = "You must accept the terms to continue.";
    setErrors(e);
    return Object.keys(e).length === 0;
  }

  async function onSubmit(ev: React.FormEvent) {
    ev.preventDefault();
    setFormError(null);
    if (!validate()) return;
    setStatus("sending");

    try {
      const res = await fetch("/api/registro", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(values),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => null);
        if (data?.errors) setErrors(data.errors as Errors);
        setFormError(data?.error ?? "Could not create the account. Check the fields.");
        setStatus("idle");
        return;
      }
      // Registro correcto: ya hay sesión iniciada → al área de cuenta.
      router.push("/cuenta");
      router.refresh();
    } catch {
      setFormError("Connection error. Check your network and try again.");
      setStatus("idle");
    }
  }

  return (
    <form onSubmit={onSubmit} noValidate className="space-y-5">
      <div className="grid gap-5 sm:grid-cols-2">
        <div>
          <Label htmlFor="nombre" required>Name</Label>
          <Input id="nombre" value={values.nombre} onChange={set("nombre")} placeholder="Ada" autoComplete="given-name" aria-invalid={!!errors.nombre} />
          <FieldError>{errors.nombre}</FieldError>
        </div>
        <div>
          <Label htmlFor="apellidos" required>Last name</Label>
          <Input id="apellidos" value={values.apellidos} onChange={set("apellidos")} placeholder="Lovelace" autoComplete="family-name" aria-invalid={!!errors.apellidos} />
          <FieldError>{errors.apellidos}</FieldError>
        </div>
      </div>

      <div>
        <Label htmlFor="direccion" required>Address</Label>
        <Input id="direccion" value={values.direccion} onChange={set("direccion")} placeholder="Street, number, floor" autoComplete="street-address" aria-invalid={!!errors.direccion} />
        <FieldError>{errors.direccion}</FieldError>
      </div>

      <div className="grid gap-5 sm:grid-cols-3">
        <div>
          <Label htmlFor="ciudad" required>City</Label>
          <Input id="ciudad" value={values.ciudad} onChange={set("ciudad")} placeholder="Madrid" autoComplete="address-level2" aria-invalid={!!errors.ciudad} />
          <FieldError>{errors.ciudad}</FieldError>
        </div>
        <div>
          <Label htmlFor="codigoPostal" required>Postal code</Label>
          <Input id="codigoPostal" value={values.codigoPostal} onChange={set("codigoPostal")} placeholder="28013" autoComplete="postal-code" aria-invalid={!!errors.codigoPostal} />
          <FieldError>{errors.codigoPostal}</FieldError>
        </div>
        <div>
          <Label htmlFor="pais" required>Country</Label>
          <Input id="pais" value={values.pais} onChange={set("pais")} placeholder="Spain" autoComplete="country-name" aria-invalid={!!errors.pais} />
          <FieldError>{errors.pais}</FieldError>
        </div>
      </div>

      <div className="grid gap-5 sm:grid-cols-2">
        <div>
          <Label htmlFor="telefono" required>Phone</Label>
          <Input id="telefono" type="tel" value={values.telefono} onChange={set("telefono")} placeholder="+34 600 000 000" autoComplete="tel" aria-invalid={!!errors.telefono} />
          <FieldError>{errors.telefono}</FieldError>
        </div>
        <div>
          <Label htmlFor="email" required>Email</Label>
          <Input id="email" type="email" value={values.email} onChange={set("email")} placeholder="tu@email.com" autoComplete="email" aria-invalid={!!errors.email} />
          <FieldError>{errors.email}</FieldError>
        </div>
      </div>

      <div>
        <Label htmlFor="password" required>Password</Label>
        <Input id="password" type="password" value={values.password} onChange={set("password")} placeholder="••••••••" autoComplete="new-password" aria-invalid={!!errors.password} />
        <ul className="mt-2 grid gap-1 sm:grid-cols-2">
          {passwordRules.map((rule) => {
            const ok = values.password.length > 0 && !failedRules.has(rule.key);
            return (
              <li
                key={rule.key}
                className={
                  "flex items-center gap-2 font-mono text-xs " +
                  (ok ? "text-[var(--color-accent)]" : "text-[var(--color-fg-dim)]")
                }
              >
                <span aria-hidden="true">{ok ? "✓" : "○"}</span>
                {rule.label}
              </li>
            );
          })}
        </ul>
        <FieldError>{errors.password}</FieldError>
      </div>

      <div>
        <label className="flex cursor-pointer items-start gap-3 text-sm text-[var(--color-fg-muted)]">
          <input
            type="checkbox"
            checked={terms}
            onChange={(e) => setTerms(e.target.checked)}
            className="mt-0.5 h-4 w-4 accent-[var(--color-accent)]"
            aria-invalid={!!errors.terms}
          />
          <span>
            I accept the{" "}
            <a href="/legal/terminos" className="text-[var(--color-accent)] underline">terms</a>{" "}
            and the{" "}
            <a href="/legal/privacidad" className="text-[var(--color-accent)] underline">privacy policy</a>.
          </span>
        </label>
        <FieldError>{errors.terms}</FieldError>
      </div>

      <button
        type="submit"
        disabled={status === "sending"}
        className="inline-flex w-full items-center justify-center rounded-[var(--radius-md)] bg-[var(--color-accent)] px-6 py-3.5 text-sm font-medium text-black transition-colors hover:bg-[var(--color-accent-dim)] disabled:opacity-60 sm:w-auto"
      >
        {status === "sending" ? "Creating account…" : "Create account →"}
      </button>

      {formError && (
        <p role="alert" className="text-sm text-[var(--color-danger)]">{formError}</p>
      )}

      <p className="text-sm text-[var(--color-fg-muted)]">
        Already have an account?{" "}
        <a href="/acceder" className="text-[var(--color-accent)] underline">Log in</a>.
      </p>
    </form>
  );
}
