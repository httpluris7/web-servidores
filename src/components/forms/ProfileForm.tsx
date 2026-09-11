"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { useRouter } from "@/i18n/navigation";
import { Label, Input, FieldError } from "./Field";
import { isPhoneValid } from "@/lib/password";

type FieldKey =
  | "nombre"
  | "apellidos"
  | "telefono"
  | "direccion"
  | "codigoPostal"
  | "ciudad"
  | "estado"
  | "pais";

type Values = Record<FieldKey, string>;
type Errors = Partial<Record<FieldKey, string>>;

const fieldKeys: FieldKey[] = [
  "nombre",
  "apellidos",
  "telefono",
  "direccion",
  "codigoPostal",
  "ciudad",
  "estado",
  "pais",
];

const autoComplete: Record<FieldKey, string> = {
  nombre: "given-name",
  apellidos: "family-name",
  telefono: "tel",
  direccion: "street-address",
  codigoPostal: "postal-code",
  ciudad: "address-level2",
  estado: "address-level1",
  pais: "country-name",
};

export type ProfileFormUser = Values & { email: string };

/**
 * Datos del cliente en /cuenta: se muestran como ficha y, al pulsar "Editar",
 * se convierten en formulario. El email se muestra pero se cambia aparte
 * (ChangeEmailForm): requiere confirmar la dirección nueva por correo.
 */
export function ProfileForm({ user }: { user: ProfileFormUser }) {
  const t = useTranslations("auth");
  const router = useRouter();
  const [editing, setEditing] = useState(false);
  const [values, setValues] = useState<Values>(pick(user));
  const [errors, setErrors] = useState<Errors>({});
  const [status, setStatus] = useState<"idle" | "sending">("idle");
  const [formError, setFormError] = useState<string | null>(null);
  const [done, setDone] = useState(false);

  const set = (k: FieldKey) => (e: React.ChangeEvent<HTMLInputElement>) =>
    setValues((v) => ({ ...v, [k]: e.target.value }));

  function startEditing() {
    setValues(pick(user));
    setErrors({});
    setFormError(null);
    setDone(false);
    setEditing(true);
  }

  function cancel() {
    setValues(pick(user));
    setErrors({});
    setFormError(null);
    setEditing(false);
  }

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
      const res = await fetch("/api/cuenta/perfil", {
        method: "PUT",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(values),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => null);
        if (data?.errors) setErrors(data.errors as Errors);
        setFormError(data?.error ?? t("profileForm.errorGeneric"));
        setStatus("idle");
        return;
      }
      setStatus("idle");
      setEditing(false);
      setDone(true);
      // Refresca el server component para que la ficha muestre los datos nuevos.
      router.refresh();
    } catch {
      setFormError(t("profileForm.errorConnection"));
      setStatus("idle");
    }
  }

  if (!editing) {
    return (
      <div>
        <dl className="grid gap-px overflow-hidden rounded-[var(--radius-lg)] border border-[var(--color-line)] bg-[var(--color-line)] sm:grid-cols-2">
          <Row label={t("account.fields.nombre")} value={user.nombre} />
          <Row label={t("account.fields.apellidos")} value={user.apellidos} />
          <Row label={t("account.fields.email")} value={user.email} />
          <Row label={t("account.fields.telefono")} value={user.telefono} />
          <Row label={t("account.fields.direccion")} value={user.direccion} />
          <Row label={t("account.fields.codigoPostal")} value={user.codigoPostal} />
          <Row label={t("account.fields.ciudad")} value={user.ciudad} />
          <Row label={t("account.fields.estado")} value={user.estado} />
          <Row label={t("account.fields.pais")} value={user.pais} />
        </dl>
        <div className="mt-5 flex flex-wrap items-center gap-4">
          <button
            type="button"
            onClick={startEditing}
            className="inline-flex min-h-11 items-center justify-center rounded-[var(--radius-md)] border border-[var(--color-line-strong)] px-6 text-sm transition-colors hover:border-[var(--color-accent)] hover:text-[var(--color-accent)]"
          >
            {t("profileForm.edit")}
          </button>
          {done && (
            <p role="status" className="text-sm text-[var(--color-accent)]">
              {t("profileForm.success")}
            </p>
          )}
        </div>
      </div>
    );
  }

  return (
    <form onSubmit={onSubmit} noValidate className="space-y-5">
      <div className="grid gap-5 sm:grid-cols-2">
        {fieldKeys.map((key) => (
          <div key={key} className={key === "direccion" ? "sm:col-span-2" : undefined}>
            <Label htmlFor={`perfil-${key}`} required>
              {t(`account.fields.${key}`)}
            </Label>
            <Input
              id={`perfil-${key}`}
              type={key === "telefono" ? "tel" : "text"}
              value={values[key]}
              onChange={set(key)}
              autoComplete={autoComplete[key]}
              aria-invalid={!!errors[key]}
            />
            <FieldError>{errors[key]}</FieldError>
          </div>
        ))}
      </div>

      <p className="text-xs text-[var(--color-fg-muted)]">{t("profileForm.emailHint")}</p>

      <div className="flex flex-wrap items-center gap-3">
        <button
          type="submit"
          disabled={status === "sending"}
          className="inline-flex items-center justify-center rounded-[var(--radius-md)] bg-[var(--color-accent)] px-6 py-3.5 text-sm font-medium text-black transition-colors hover:bg-[var(--color-accent-dim)] disabled:opacity-60"
        >
          {status === "sending" ? t("profileForm.submitting") : t("profileForm.submit")}
        </button>
        <button
          type="button"
          onClick={cancel}
          disabled={status === "sending"}
          className="inline-flex min-h-11 items-center justify-center rounded-[var(--radius-md)] border border-[var(--color-line-strong)] px-6 text-sm transition-colors hover:border-[var(--color-accent)] hover:text-[var(--color-accent)] disabled:opacity-60"
        >
          {t("profileForm.cancel")}
        </button>
      </div>

      {formError && (
        <p role="alert" className="text-sm text-[var(--color-danger)]">
          {formError}
        </p>
      )}
    </form>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="bg-[var(--color-bg-raised)] px-5 py-4">
      <dt className="mono-label text-[0.6rem]">{label}</dt>
      <dd className="mt-1 text-sm text-[var(--color-fg)] break-words">{value || "—"}</dd>
    </div>
  );
}

function pick(user: ProfileFormUser): Values {
  return {
    nombre: user.nombre,
    apellidos: user.apellidos,
    telefono: user.telefono,
    direccion: user.direccion,
    codigoPostal: user.codigoPostal,
    ciudad: user.ciudad,
    estado: user.estado,
    pais: user.pais,
  };
}
