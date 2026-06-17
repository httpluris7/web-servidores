"use client";

import { useMemo, useState } from "react";
import { useTranslations } from "next-intl";
import { useRouter, Link } from "@/i18n/navigation";
import { Label, Input, FieldError } from "./Field";
import { emailRe, isPhoneValid, passwordRules, failedPasswordRules } from "@/lib/password";

type FieldKey =
  | "nombre"
  | "apellidos"
  | "direccion"
  | "ciudad"
  | "estado"
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
  estado: "",
  pais: "",
  telefono: "",
  codigoPostal: "",
  email: "",
  password: "",
};

export function RegisterForm({ next }: { next?: string }) {
  const t = useTranslations("auth");
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
    if (values.nombre.trim().length < 2) e.nombre = t("registerForm.errorNombre");
    if (values.apellidos.trim().length < 2) e.apellidos = t("registerForm.errorApellidos");
    if (values.direccion.trim().length < 3) e.direccion = t("registerForm.errorDireccion");
    if (values.ciudad.trim().length < 2) e.ciudad = t("registerForm.errorCiudad");
    if (values.estado.trim().length < 2) e.estado = t("registerForm.errorEstado");
    if (values.pais.trim().length < 2) e.pais = t("registerForm.errorPais");
    if (!isPhoneValid(values.telefono)) e.telefono = t("registerForm.errorTelefono");
    if (values.codigoPostal.trim().length < 3) e.codigoPostal = t("registerForm.errorCodigoPostal");
    if (!emailRe.test(values.email)) e.email = t("registerForm.errorEmail");
    if (failedPasswordRules(values.password).length > 0) e.password = t("registerForm.errorPassword");
    if (!terms) e.terms = t("registerForm.errorTerms");
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
        setFormError(data?.error ?? t("registerForm.errorGeneric"));
        setStatus("idle");
        return;
      }
      // Registro correcto: ya hay sesión iniciada → volvemos a `next` (p. ej. el
      // carrito para completar el pedido) o, por defecto, al área de cuenta.
      router.push(next || "/cuenta");
      router.refresh();
    } catch {
      setFormError(t("registerForm.errorConnection"));
      setStatus("idle");
    }
  }

  return (
    <form onSubmit={onSubmit} noValidate className="space-y-5">
      <div className="grid gap-5 sm:grid-cols-2">
        <div>
          <Label htmlFor="nombre" required>{t("registerForm.nombreLabel")}</Label>
          <Input id="nombre" value={values.nombre} onChange={set("nombre")} placeholder={t("registerForm.nombrePlaceholder")} autoComplete="given-name" aria-invalid={!!errors.nombre} />
          <FieldError>{errors.nombre}</FieldError>
        </div>
        <div>
          <Label htmlFor="apellidos" required>{t("registerForm.apellidosLabel")}</Label>
          <Input id="apellidos" value={values.apellidos} onChange={set("apellidos")} placeholder={t("registerForm.apellidosPlaceholder")} autoComplete="family-name" aria-invalid={!!errors.apellidos} />
          <FieldError>{errors.apellidos}</FieldError>
        </div>
      </div>

      <div>
        <Label htmlFor="direccion" required>{t("registerForm.direccionLabel")}</Label>
        <Input id="direccion" value={values.direccion} onChange={set("direccion")} placeholder={t("registerForm.direccionPlaceholder")} autoComplete="street-address" aria-invalid={!!errors.direccion} />
        <FieldError>{errors.direccion}</FieldError>
      </div>

      <div className="grid gap-5 sm:grid-cols-2">
        <div>
          <Label htmlFor="ciudad" required>{t("registerForm.ciudadLabel")}</Label>
          <Input id="ciudad" value={values.ciudad} onChange={set("ciudad")} placeholder={t("registerForm.ciudadPlaceholder")} autoComplete="address-level2" aria-invalid={!!errors.ciudad} />
          <FieldError>{errors.ciudad}</FieldError>
        </div>
        <div>
          <Label htmlFor="estado" required>{t("registerForm.estadoLabel")}</Label>
          <Input id="estado" value={values.estado} onChange={set("estado")} placeholder={t("registerForm.estadoPlaceholder")} autoComplete="address-level1" aria-invalid={!!errors.estado} />
          <FieldError>{errors.estado}</FieldError>
        </div>
      </div>

      <div className="grid gap-5 sm:grid-cols-2">
        <div>
          <Label htmlFor="codigoPostal" required>{t("registerForm.codigoPostalLabel")}</Label>
          <Input id="codigoPostal" value={values.codigoPostal} onChange={set("codigoPostal")} placeholder={t("registerForm.codigoPostalPlaceholder")} autoComplete="postal-code" aria-invalid={!!errors.codigoPostal} />
          <FieldError>{errors.codigoPostal}</FieldError>
        </div>
        <div>
          <Label htmlFor="pais" required>{t("registerForm.paisLabel")}</Label>
          <Input id="pais" value={values.pais} onChange={set("pais")} placeholder={t("registerForm.paisPlaceholder")} autoComplete="country-name" aria-invalid={!!errors.pais} />
          <FieldError>{errors.pais}</FieldError>
        </div>
      </div>

      <div className="grid gap-5 sm:grid-cols-2">
        <div>
          <Label htmlFor="telefono" required>{t("registerForm.telefonoLabel")}</Label>
          <Input id="telefono" type="tel" value={values.telefono} onChange={set("telefono")} placeholder={t("registerForm.telefonoPlaceholder")} autoComplete="tel" aria-invalid={!!errors.telefono} />
          <FieldError>{errors.telefono}</FieldError>
        </div>
        <div>
          <Label htmlFor="email" required>{t("registerForm.emailLabel")}</Label>
          <Input id="email" type="email" value={values.email} onChange={set("email")} placeholder={t("registerForm.emailPlaceholder")} autoComplete="email" aria-invalid={!!errors.email} />
          <FieldError>{errors.email}</FieldError>
        </div>
      </div>

      <div>
        <Label htmlFor="password" required>{t("registerForm.passwordLabel")}</Label>
        <Input id="password" type="password" value={values.password} onChange={set("password")} placeholder={t("registerForm.passwordPlaceholder")} autoComplete="new-password" aria-invalid={!!errors.password} />
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
                {t(`passwordRules.${rule.key}`)}
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
            {t("registerForm.termsAccept")}{" "}
            <Link href="/legal/terminos" className="text-[var(--color-accent)] underline">{t("registerForm.termsLink")}</Link>{" "}
            {t("registerForm.termsAnd")}{" "}
            <Link href="/legal/privacidad" className="text-[var(--color-accent)] underline">{t("registerForm.privacyLink")}</Link>.
          </span>
        </label>
        <FieldError>{errors.terms}</FieldError>
      </div>

      <button
        type="submit"
        disabled={status === "sending"}
        className="inline-flex w-full items-center justify-center rounded-[var(--radius-md)] bg-[var(--color-accent)] px-6 py-3.5 text-sm font-medium text-black transition-colors hover:bg-[var(--color-accent-dim)] disabled:opacity-60 sm:w-auto"
      >
        {status === "sending" ? t("registerForm.submitting") : t("registerForm.submit")}
      </button>

      {formError && (
        <p role="alert" className="text-sm text-[var(--color-danger)]">{formError}</p>
      )}

      <p className="text-sm text-[var(--color-fg-muted)]">
        {t("registerForm.haveAccount")}{" "}
        <Link
          href={next ? `/acceder?next=${encodeURIComponent(next)}` : "/acceder"}
          className="text-[var(--color-accent)] underline"
        >
          {t("registerForm.logIn")}
        </Link>
        .
      </p>
    </form>
  );
}
