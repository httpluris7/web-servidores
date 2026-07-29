"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { Label, Input } from "@/components/forms/Field";

export type ProviderPublicSettings = {
  enabled: boolean;
  apiUrl: string;
  hasToken: boolean;
  tokenMask: string;
};

type Account = { id: number | null; email: string | null; status: string | null };

/**
 * Credenciales del proveedor de servidores.
 *
 * Mismo trato que la clave de Stripe: el token no viaja nunca al navegador,
 * solo su versión enmascarada, y el campo vacío significa "conserva el que
 * hay". Este token permite encender, reinstalar y borrar VPS, así que la
 * pantalla lo dice en voz alta.
 */
export function ProviderSettingsForm({ initial }: { initial: ProviderPublicSettings }) {
  const t = useTranslations("admin");
  const [settings, setSettings] = useState(initial);
  const [token, setToken] = useState("");
  const [apiUrl, setApiUrl] = useState(initial.apiUrl);
  const [status, setStatus] = useState<"idle" | "saving" | "testing">("idle");
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [account, setAccount] = useState<Account | null>(null);

  async function save(patch: Record<string, unknown>) {
    setError(null);
    setNotice(null);
    setAccount(null);
    setStatus("saving");
    try {
      const res = await fetch("/api/admin/ajustes", {
        method: "PUT",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ section: "provider", ...patch }),
      });
      const data = await res.json().catch(() => null);
      if (!res.ok || !data?.ok) {
        setError(data?.error ?? t("settings.errorSave"));
        return;
      }
      setSettings(data.provider);
      setApiUrl(data.provider.apiUrl);
      setToken("");
      setNotice(data.warning ?? t("settings.saved"));
    } catch {
      setError(t("settings.errorConnection"));
    } finally {
      setStatus("idle");
    }
  }

  async function test() {
    setError(null);
    setNotice(null);
    setAccount(null);
    setStatus("testing");
    try {
      const res = await fetch("/api/admin/ajustes?target=provider", { method: "POST" });
      const data = await res.json().catch(() => null);
      if (!res.ok || !data?.ok) {
        setError(data?.error ?? t("settings.errorTest"));
        return;
      }
      setAccount(data.account as Account);
    } catch {
      setError(t("settings.errorConnection"));
    } finally {
      setStatus("idle");
    }
  }

  const busy = status !== "idle";
  const active = settings.enabled && settings.hasToken;

  return (
    <section className="rounded-[var(--radius-lg)] border border-[var(--color-line)] bg-[var(--color-bg-raised)] p-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div className="min-w-0">
          <h2 className="text-lg font-semibold">{t("settings.providerHeading")}</h2>
          <p className="mt-1 text-sm text-[var(--color-fg-muted)]">
            {t("settings.providerIntro")}
          </p>
        </div>
        <span
          className={
            "rounded-full border px-3 py-1 font-mono text-xs " +
            (active
              ? "border-[var(--color-accent)]/40 bg-[var(--color-accent)]/10 text-[var(--color-accent)]"
              : "border-[var(--color-line-strong)] text-[var(--color-fg-muted)]")
          }
        >
          {active ? t("settings.statusActive") : t("settings.statusInactive")}
        </span>
      </div>

      <label className="mt-5 flex items-center gap-3 text-sm">
        <input
          type="checkbox"
          checked={settings.enabled}
          disabled={busy}
          onChange={(e) => save({ enabled: e.target.checked })}
          className="h-4 w-4 accent-[var(--color-accent)]"
        />
        {t("settings.providerEnableLabel")}
      </label>

      <div className="mt-6 grid gap-5">
        <div>
          <Label htmlFor="providerApiUrl">{t("settings.providerUrlLabel")}</Label>
          <Input
            id="providerApiUrl"
            type="url"
            spellCheck={false}
            value={apiUrl}
            onChange={(e) => setApiUrl(e.target.value)}
            className="font-mono text-xs"
          />
          <p className="mt-1.5 text-xs text-[var(--color-fg-dim)]">
            {t("settings.providerUrlHint")}
          </p>
        </div>

        <div>
          <Label htmlFor="providerToken">{t("settings.providerTokenLabel")}</Label>
          <Input
            id="providerToken"
            type="password"
            autoComplete="off"
            spellCheck={false}
            value={token}
            onChange={(e) => setToken(e.target.value)}
            placeholder={settings.hasToken ? settings.tokenMask : "…"}
          />
          <p className="mt-1.5 text-xs text-[var(--color-fg-dim)]">
            {settings.hasToken ? t("settings.keepHint") : t("settings.providerTokenHint")}
          </p>
        </div>
      </div>

      <p className="mt-5 rounded-[var(--radius-md)] border border-[var(--color-line-strong)] px-4 py-3 text-xs text-[var(--color-fg-muted)]">
        {t("settings.providerWarning")}
      </p>

      <div className="mt-6 flex flex-wrap items-center gap-3">
        <button
          type="button"
          disabled={busy || (!token && apiUrl === settings.apiUrl)}
          onClick={() => save({ token: token || undefined, apiUrl })}
          className="inline-flex items-center justify-center rounded-[var(--radius-md)] bg-[var(--color-accent)] px-5 py-2.5 text-sm font-medium text-black transition-colors hover:bg-[var(--color-accent-dim)] disabled:opacity-50"
        >
          {status === "saving" ? t("settings.saving") : t("settings.save")}
        </button>

        <button
          type="button"
          disabled={busy || !settings.hasToken}
          onClick={test}
          className="inline-flex items-center justify-center rounded-[var(--radius-md)] border border-[var(--color-line-strong)] px-5 py-2.5 text-sm transition-colors hover:border-[var(--color-accent)] disabled:opacity-50"
        >
          {status === "testing" ? t("settings.testing") : t("settings.test")}
        </button>

        {settings.hasToken && (
          <button
            type="button"
            disabled={busy}
            onClick={() => save({ token: null, enabled: false })}
            className="text-sm text-[var(--color-fg-muted)] transition-colors hover:text-[var(--color-danger)] disabled:opacity-50"
          >
            {t("settings.providerClearToken")}
          </button>
        )}
      </div>

      {error && (
        <p role="alert" className="mt-4 text-sm text-[var(--color-danger)]">
          {error}
        </p>
      )}
      {notice && <p className="mt-4 text-sm text-[var(--color-accent)]">{notice}</p>}
      {account && (
        <div className="mt-4 rounded-[var(--radius-md)] border border-[var(--color-accent)]/40 bg-[var(--color-accent)]/5 px-4 py-3 text-sm">
          <p className="text-[var(--color-accent)]">{t("settings.testOk")}</p>
          <p className="mt-1 font-mono text-xs break-words text-[var(--color-fg-muted)]">
            {account.email ?? `#${account.id ?? "?"}`}
            {account.status ? ` · ${account.status}` : ""}
          </p>
        </div>
      )}
    </section>
  );
}
