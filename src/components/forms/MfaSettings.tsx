"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { useRouter } from "@/i18n/navigation";
import { Label, Input, FieldError } from "./Field";

type Estado = { enabled: boolean; enabledAt: string | null; recoveryLeft: number };
type Fase = "idle" | "password" | "scan" | "recovery" | "disable";

const botonPrimario =
  "inline-flex w-full items-center justify-center rounded-[var(--radius-md)] bg-[var(--color-accent)] px-6 py-3.5 text-sm font-medium text-black transition-colors hover:bg-[var(--color-accent-dim)] disabled:opacity-60 sm:w-auto";
const botonSecundario =
  "inline-flex w-full items-center justify-center rounded-[var(--radius-md)] border border-[var(--color-line-strong)] px-6 py-3.5 text-sm font-medium text-[var(--color-fg)] transition-colors hover:bg-white/5 disabled:opacity-60 sm:w-auto";

/**
 * Alta/baja de la verificación en dos pasos (TOTP) del propio usuario.
 * Alta: contraseña → QR + código de la app → códigos de recuperación (una sola vez).
 * Baja: contraseña + código vigente.
 */
export function MfaSettings({ initial, forced }: { initial: Estado; forced: boolean }) {
  const t = useTranslations("auth");
  const router = useRouter();
  const [estado, setEstado] = useState<Estado>(initial);
  const [fase, setFase] = useState<Fase>("idle");
  const [password, setPassword] = useState("");
  const [code, setCode] = useState("");
  const [alta, setAlta] = useState<{ secret: string; uri: string; qr: string } | null>(null);
  const [recovery, setRecovery] = useState<string[]>([]);
  const [errors, setErrors] = useState<{ password?: string; code?: string }>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [copiado, setCopiado] = useState(false);

  function reset(next: Fase) {
    setPassword("");
    setCode("");
    setErrors({});
    setFormError(null);
    setFase(next);
  }

  async function llamar(body: Record<string, unknown>) {
    setBusy(true);
    setFormError(null);
    setErrors({});
    try {
      const res = await fetch("/api/cuenta/mfa", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(body),
      });
      const data = await res.json().catch(() => null);
      if (!res.ok) {
        const e: { password?: string; code?: string } = {};
        if (data?.errors?.password) e.password = t("mfa.errorPassword");
        if (data?.errors?.code) e.code = data.errors.code === "caducado" ? t("mfa.errorExpired") : t("mfa.errorCode");
        setErrors(e);
        if (!e.password && !e.code) setFormError(data?.error ?? t("mfa.errorGeneric"));
        return null;
      }
      return data;
    } catch {
      setFormError(t("mfa.errorConnection"));
      return null;
    } finally {
      setBusy(false);
    }
  }

  async function empezar(ev: React.FormEvent) {
    ev.preventDefault();
    if (!password) return setErrors({ password: t("mfa.errorPassword") });
    const data = await llamar({ op: "start", password });
    if (data) {
      setAlta({ secret: data.secret, uri: data.uri, qr: data.qr });
      setPassword("");
      setFase("scan");
    }
  }

  async function confirmar(ev: React.FormEvent) {
    ev.preventDefault();
    if (!code.trim()) return setErrors({ code: t("mfa.errorCode") });
    const data = await llamar({ op: "confirm", code });
    if (data) {
      setRecovery(data.recoveryCodes as string[]);
      setEstado({ enabled: true, enabledAt: new Date().toISOString(), recoveryLeft: data.recoveryCodes.length });
      setCode("");
      setFase("recovery");
    }
  }

  async function desactivar(ev: React.FormEvent) {
    ev.preventDefault();
    const e: { password?: string; code?: string } = {};
    if (!password) e.password = t("mfa.errorPassword");
    if (!code.trim()) e.code = t("mfa.errorCode");
    if (e.password || e.code) return setErrors(e);
    const data = await llamar({ op: "disable", password, code });
    if (data) {
      setEstado({ enabled: false, enabledAt: null, recoveryLeft: 0 });
      reset("idle");
      router.refresh();
    }
  }

  async function copiar() {
    try {
      await navigator.clipboard.writeText(recovery.join("\n"));
      setCopiado(true);
      setTimeout(() => setCopiado(false), 2000);
    } catch {
      // sin portapapeles (http, permisos): el usuario los copia a mano
    }
  }

  const estadoPill = (
    <p className="text-sm">
      <span
        className={
          "mr-2 inline-block rounded-full px-2 py-0.5 font-mono text-xs " +
          (estado.enabled ? "bg-[var(--color-accent)]/15 text-[var(--color-accent)]" : "bg-white/5 text-[var(--color-fg-muted)]")
        }
      >
        {estado.enabled ? t("mfa.statusOn") : t("mfa.statusOff")}
      </span>
      {estado.enabled && (
        <span className="text-[var(--color-fg-muted)]">{t("mfa.recoveryLeft", { count: estado.recoveryLeft })}</span>
      )}
    </p>
  );

  /* ------------------------------ vistas ------------------------------ */

  if (fase === "recovery") {
    return (
      <div className="max-w-md space-y-5">
        {estadoPill}
        <div>
          <p className="font-medium">{t("mfa.recoveryTitle")}</p>
          <p className="mt-1 text-sm text-[var(--color-fg-muted)]">{t("mfa.recoveryHelp")}</p>
        </div>
        <ul className="grid grid-cols-2 gap-2 rounded-[var(--radius-md)] border border-[var(--color-line)] bg-[var(--color-bg-base)] p-4 font-mono text-sm">
          {recovery.map((c) => (
            <li key={c}>{c}</li>
          ))}
        </ul>
        <div className="flex flex-wrap gap-3">
          <button type="button" onClick={copiar} className={botonSecundario}>
            {copiado ? t("mfa.copied") : t("mfa.copy")}
          </button>
          <button
            type="button"
            onClick={() => {
              setRecovery([]);
              reset("idle");
              router.refresh();
            }}
            className={botonPrimario}
          >
            {t("mfa.done")}
          </button>
        </div>
      </div>
    );
  }

  if (fase === "scan" && alta) {
    return (
      <form onSubmit={confirmar} noValidate className="max-w-md space-y-5">
        <div>
          <p className="font-medium">{t("mfa.scanTitle")}</p>
          <p className="mt-1 text-sm text-[var(--color-fg-muted)]">{t("mfa.scanHelp")}</p>
        </div>
        <div
          className="w-48 overflow-hidden rounded-[var(--radius-md)] bg-white p-1 [&>svg]:block [&>svg]:h-auto [&>svg]:w-full"
          // SVG generado en el servidor por nuestro propio codificador (lib/qr.ts), sin datos del usuario en el markup.
          dangerouslySetInnerHTML={{ __html: alta.qr }}
        />
        <p className="text-xs text-[var(--color-fg-muted)]">
          {t("mfa.manualKey")}{" "}
          <code className="select-all break-all font-mono text-[var(--color-fg)]">{alta.secret}</code>
        </p>
        <div>
          <Label htmlFor="mfaConfirmCode" required>{t("mfa.codeLabel")}</Label>
          <Input
            id="mfaConfirmCode"
            type="text"
            inputMode="numeric"
            value={code}
            onChange={(e) => setCode(e.target.value)}
            placeholder="123456"
            autoComplete="one-time-code"
            maxLength={8}
            aria-invalid={!!errors.code}
          />
          <FieldError>{errors.code}</FieldError>
        </div>
        <div className="flex flex-wrap gap-3">
          <button type="submit" disabled={busy} className={botonPrimario}>
            {busy ? t("mfa.saving") : t("mfa.confirm")}
          </button>
          <button type="button" onClick={() => reset("idle")} className={botonSecundario}>
            {t("mfa.cancel")}
          </button>
        </div>
        {formError && <p role="alert" className="text-sm text-[var(--color-danger)]">{formError}</p>}
      </form>
    );
  }

  if (fase === "password") {
    return (
      <form onSubmit={empezar} noValidate className="max-w-md space-y-5">
        {estadoPill}
        <div>
          <Label htmlFor="mfaPassword" required>{t("mfa.passwordLabel")}</Label>
          <Input
            id="mfaPassword"
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="••••••••"
            autoComplete="current-password"
            aria-invalid={!!errors.password}
          />
          <FieldError>{errors.password}</FieldError>
        </div>
        <div className="flex flex-wrap gap-3">
          <button type="submit" disabled={busy} className={botonPrimario}>
            {busy ? t("mfa.saving") : t("mfa.continue")}
          </button>
          <button type="button" onClick={() => reset("idle")} className={botonSecundario}>
            {t("mfa.cancel")}
          </button>
        </div>
        {formError && <p role="alert" className="text-sm text-[var(--color-danger)]">{formError}</p>}
      </form>
    );
  }

  if (fase === "disable") {
    return (
      <form onSubmit={desactivar} noValidate className="max-w-md space-y-5">
        {estadoPill}
        <p className="text-sm text-[var(--color-fg-muted)]">{t("mfa.disableHelp")}</p>
        <div>
          <Label htmlFor="mfaPassword" required>{t("mfa.passwordLabel")}</Label>
          <Input
            id="mfaPassword"
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="••••••••"
            autoComplete="current-password"
            aria-invalid={!!errors.password}
          />
          <FieldError>{errors.password}</FieldError>
        </div>
        <div>
          <Label htmlFor="mfaDisableCode" required>{t("mfa.codeLabel")}</Label>
          <Input
            id="mfaDisableCode"
            type="text"
            inputMode="numeric"
            value={code}
            onChange={(e) => setCode(e.target.value)}
            placeholder="123456"
            autoComplete="one-time-code"
            maxLength={20}
            aria-invalid={!!errors.code}
          />
          <FieldError>{errors.code}</FieldError>
        </div>
        <div className="flex flex-wrap gap-3">
          <button type="submit" disabled={busy} className={botonPrimario}>
            {busy ? t("mfa.saving") : t("mfa.disable")}
          </button>
          <button type="button" onClick={() => reset("idle")} className={botonSecundario}>
            {t("mfa.cancel")}
          </button>
        </div>
        {formError && <p role="alert" className="text-sm text-[var(--color-danger)]">{formError}</p>}
      </form>
    );
  }

  return (
    <div className="max-w-md space-y-5">
      {forced && !estado.enabled && (
        <p role="alert" className="rounded-[var(--radius-md)] border border-[var(--color-accent)]/40 bg-[var(--color-accent)]/10 p-3 text-sm">
          {t("mfa.adminForced")}
        </p>
      )}
      {estadoPill}
      {estado.enabled ? (
        <button type="button" onClick={() => reset("disable")} className={botonSecundario}>
          {t("mfa.disable")}
        </button>
      ) : (
        <button type="button" onClick={() => reset("password")} className={botonPrimario}>
          {t("mfa.enable")}
        </button>
      )}
    </div>
  );
}
