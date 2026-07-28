"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { Label, Input } from "@/components/forms/Field";

export type StripePublicSettings = {
  enabled: boolean;
  hasSecretKey: boolean;
  secretKeyMask: string;
  hasWebhookSecret: boolean;
  webhookSecretMask: string;
  mode: "test" | "live" | "unknown";
};

type Account = { id: string; email: string | null; country: string | null };

/**
 * Configuración de la pasarela.
 *
 * Los secretos NO viajan al navegador: del servidor solo llega su versión
 * enmascarada. Por eso los campos nacen vacíos y dejarlos así significa
 * "conserva la clave que ya hay"; para quitar una clave está su botón de
 * borrado, que manda `null` explícito.
 */
export function StripeSettingsForm({
  initial,
  webhookUrl,
  webhookEvents,
}: {
  initial: StripePublicSettings;
  webhookUrl: string;
  webhookEvents: string[];
}) {
  const t = useTranslations("admin");
  const [settings, setSettings] = useState(initial);
  const [secretKey, setSecretKey] = useState("");
  const [webhookSecret, setWebhookSecret] = useState("");
  const [status, setStatus] = useState<"idle" | "saving" | "testing">("idle");
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [account, setAccount] = useState<Account | null>(null);
  const [copied, setCopied] = useState(false);

  async function save(patch: Record<string, unknown>) {
    setError(null);
    setNotice(null);
    setAccount(null);
    setStatus("saving");
    try {
      const res = await fetch("/api/admin/ajustes", {
        method: "PUT",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(patch),
      });
      const data = await res.json().catch(() => null);
      if (!res.ok || !data?.ok) {
        setError(data?.error ?? t("settings.errorSave"));
        return;
      }
      setSettings(data.stripe);
      setSecretKey("");
      setWebhookSecret("");
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
      const res = await fetch("/api/admin/ajustes", { method: "POST" });
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

  async function copyWebhook() {
    try {
      await navigator.clipboard.writeText(webhookUrl);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // Sin permiso de portapapeles: el campo es seleccionable a mano.
    }
  }

  const busy = status !== "idle";
  const live = settings.mode === "live";

  return (
    <div className="grid gap-8">
      {/* Estado actual */}
      <section className="rounded-[var(--radius-lg)] border border-[var(--color-line)] bg-[var(--color-bg-raised)] p-6">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <h2 className="text-lg font-semibold">{t("settings.stripeHeading")}</h2>
            <p className="mt-1 text-sm text-[var(--color-fg-muted)]">{t("settings.stripeIntro")}</p>
          </div>
          <span
            className={
              "rounded-full border px-3 py-1 font-mono text-xs " +
              (settings.enabled && settings.hasSecretKey
                ? "border-[var(--color-accent)]/40 bg-[var(--color-accent)]/10 text-[var(--color-accent)]"
                : "border-[var(--color-line-strong)] text-[var(--color-fg-muted)]")
            }
          >
            {settings.enabled && settings.hasSecretKey
              ? t("settings.statusActive")
              : t("settings.statusInactive")}
          </span>
        </div>

        {settings.hasSecretKey && (
          <p className="mt-4 font-mono text-xs text-[var(--color-fg-muted)]">
            {t("settings.modeLabel")}:{" "}
            <span className={live ? "text-[var(--color-danger)]" : "text-[var(--color-fg)]"}>
              {settings.mode === "unknown" ? t("settings.modeUnknown") : settings.mode}
            </span>
            {live && ` — ${t("settings.modeLiveWarning")}`}
          </p>
        )}

        <label className="mt-5 flex items-center gap-3 text-sm">
          <input
            type="checkbox"
            checked={settings.enabled}
            disabled={busy}
            onChange={(e) => save({ enabled: e.target.checked })}
            className="h-4 w-4 accent-[var(--color-accent)]"
          />
          {t("settings.enableLabel")}
        </label>
      </section>

      {/* Claves */}
      <section className="rounded-[var(--radius-lg)] border border-[var(--color-line)] bg-[var(--color-bg-raised)] p-6">
        <h2 className="text-lg font-semibold">{t("settings.keysHeading")}</h2>
        <p className="mt-1 mb-5 text-sm text-[var(--color-fg-muted)]">{t("settings.keysIntro")}</p>

        <div className="grid gap-5">
          <div>
            <Label htmlFor="secretKey">{t("settings.secretKeyLabel")}</Label>
            <Input
              id="secretKey"
              type="password"
              autoComplete="off"
              spellCheck={false}
              value={secretKey}
              onChange={(e) => setSecretKey(e.target.value)}
              placeholder={settings.hasSecretKey ? settings.secretKeyMask : "sk_live_…"}
            />
            <p className="mt-1.5 text-xs text-[var(--color-fg-dim)]">
              {settings.hasSecretKey ? t("settings.keepHint") : t("settings.secretKeyHint")}
            </p>
          </div>

          <div>
            <Label htmlFor="webhookSecret">{t("settings.webhookSecretLabel")}</Label>
            <Input
              id="webhookSecret"
              type="password"
              autoComplete="off"
              spellCheck={false}
              value={webhookSecret}
              onChange={(e) => setWebhookSecret(e.target.value)}
              placeholder={settings.hasWebhookSecret ? settings.webhookSecretMask : "whsec_…"}
            />
            <p className="mt-1.5 text-xs text-[var(--color-fg-dim)]">
              {settings.hasWebhookSecret ? t("settings.keepHint") : t("settings.webhookSecretHint")}
            </p>
          </div>
        </div>

        <div className="mt-6 flex flex-wrap items-center gap-3">
          <button
            type="button"
            disabled={busy || (!secretKey && !webhookSecret)}
            onClick={() => save({ secretKey: secretKey || undefined, webhookSecret: webhookSecret || undefined })}
            className="inline-flex items-center justify-center rounded-[var(--radius-md)] bg-[var(--color-accent)] px-5 py-2.5 text-sm font-medium text-black transition-colors hover:bg-[var(--color-accent-dim)] disabled:opacity-50"
          >
            {status === "saving" ? t("settings.saving") : t("settings.save")}
          </button>

          <button
            type="button"
            disabled={busy || !settings.hasSecretKey}
            onClick={test}
            className="inline-flex items-center justify-center rounded-[var(--radius-md)] border border-[var(--color-line-strong)] px-5 py-2.5 text-sm transition-colors hover:border-[var(--color-accent)] disabled:opacity-50"
          >
            {status === "testing" ? t("settings.testing") : t("settings.test")}
          </button>

          {(settings.hasSecretKey || settings.hasWebhookSecret) && (
            <button
              type="button"
              disabled={busy}
              onClick={() => save({ secretKey: null, webhookSecret: null, enabled: false })}
              className="text-sm text-[var(--color-fg-muted)] transition-colors hover:text-[var(--color-danger)] disabled:opacity-50"
            >
              {t("settings.clearKeys")}
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
            <p className="mt-1 font-mono text-xs text-[var(--color-fg-muted)]">
              {account.id}
              {account.email ? ` · ${account.email}` : ""}
              {account.country ? ` · ${account.country}` : ""}
            </p>
          </div>
        )}
      </section>

      {/* Webhook */}
      <section className="rounded-[var(--radius-lg)] border border-[var(--color-line)] bg-[var(--color-bg-raised)] p-6">
        <h2 className="text-lg font-semibold">{t("settings.webhookHeading")}</h2>
        <p className="mt-1 mb-5 text-sm text-[var(--color-fg-muted)]">{t("settings.webhookIntro")}</p>

        <Label htmlFor="webhookUrl">{t("settings.webhookUrlLabel")}</Label>
        <div className="flex flex-wrap gap-3">
          <Input
            id="webhookUrl"
            readOnly
            value={webhookUrl}
            onFocus={(e) => e.currentTarget.select()}
            className="flex-1 font-mono text-xs"
          />
          <button
            type="button"
            onClick={copyWebhook}
            className="shrink-0 rounded-[var(--radius-md)] border border-[var(--color-line-strong)] px-4 py-2.5 text-sm transition-colors hover:border-[var(--color-accent)]"
          >
            {copied ? t("settings.copied") : t("settings.copy")}
          </button>
        </div>

        <p className="mt-5 mono-label text-[0.6rem]">{t("settings.webhookEventsLabel")}</p>
        <ul className="mt-2 grid gap-1">
          {webhookEvents.map((ev) => (
            <li key={ev} className="font-mono text-xs text-[var(--color-fg-muted)]">
              · {ev}
            </li>
          ))}
        </ul>
      </section>
    </div>
  );
}
