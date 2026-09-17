"use client";

import { useState } from "react";
import { useLocale, useTranslations } from "next-intl";
import { Link } from "@/i18n/navigation";
import { AI_DEVELOPER_OS } from "@/lib/provisioner/os";

type Creds = {
  usuario: string;
  password: string;
  ip: string | null;
  ipv6?: string | null;
  hostname: string | null;
  os: string | null;
  ubicacion: string | null;
  pais?: string | null;
  recursos?: { vcores: number; ram_mb: number; disco_gb: number } | null;
};

/** Bandera emoji a partir del ISO de dos letras del país. */
function bandera(pais: string): string {
  if (!/^[A-Za-z]{2}$/.test(pais)) return "";
  return String.fromCodePoint(...[...pais.toUpperCase()].map((c) => 0x1f1e6 + c.charCodeAt(0) - 65));
}

/** "Germany 🇩🇪 (Frankfurt)" en el idioma de la página; sin país, solo la ciudad. */
function ubicacionConPais(ubicacion: string, pais: string | null | undefined, locale: string): string {
  if (!pais || !/^[A-Za-z]{2}$/.test(pais)) return ubicacion;
  try {
    const nombre = new Intl.DisplayNames([locale], { type: "region" }).of(pais.toUpperCase());
    return nombre ? `${nombre} ${bandera(pais)} (${ubicacion})` : ubicacion;
  } catch {
    return ubicacion;
  }
}

type Estado =
  | { fase: "idle" }
  | { fase: "loading" }
  | { fase: "ok"; creds: Creds }
  | { fase: "error"; motivo: string };

/** Campo con botón de copiar. */
function CopyRow({ label, value, mono = true }: { label: string; value: string; mono?: boolean }) {
  const t = useTranslations("delivery");
  const [copied, setCopied] = useState(false);
  async function copy() {
    try {
      await navigator.clipboard.writeText(value);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      /* sin portapapeles: el valor sigue visible para copiar a mano */
    }
  }
  return (
    <div className="flex items-center justify-between gap-4 border-t border-[var(--color-line)] py-3 first:border-t-0">
      <span className="mono-label text-[0.6rem] text-[var(--color-fg-muted)]">{label}</span>
      <div className="flex items-center gap-2">
        <code className={mono ? "text-sm text-[var(--color-fg)]" : "text-sm"}>{value}</code>
        <button
          type="button"
          onClick={copy}
          className="rounded border border-[var(--color-line-strong)] px-2 py-0.5 font-mono text-[0.6rem] text-[var(--color-fg-muted)] transition-colors hover:border-[var(--color-accent)] hover:text-[var(--color-accent)]"
        >
          {copied ? t("copied") : t("copy")}
        </button>
      </div>
    </div>
  );
}

export function EntregaReveal({ token }: { token: string }) {
  const t = useTranslations("delivery");
  const locale = useLocale();
  const [estado, setEstado] = useState<Estado>({ fase: "idle" });

  async function reveal() {
    setEstado({ fase: "loading" });
    try {
      const res = await fetch(`/api/entrega/${encodeURIComponent(token)}`, { method: "POST" });
      const data = await res.json().catch(() => null);
      if (res.ok && data?.ok) {
        setEstado({ fase: "ok", creds: data.creds as Creds });
      } else {
        setEstado({ fase: "error", motivo: (data?.reason as string) ?? "error" });
      }
    } catch {
      setEstado({ fase: "error", motivo: "error" });
    }
  }

  if (estado.fase === "ok") {
    const c = estado.creds;
    // AI Developer VPS: además de las credenciales, los recursos contratados y
    // los primeros pasos (SSH → claude → codex), igual que en el correo.
    const esAi = c.os === AI_DEVELOPER_OS;
    return (
      <div className="rounded-[var(--radius-lg)] border border-[var(--color-accent)] bg-[var(--color-bg-raised)] p-8 glow-accent">
        <div className="font-mono text-sm text-[var(--color-accent)]">● {t("readyTag")}</div>
        <h2 className="mt-3 text-2xl font-semibold">{esAi ? t("ai.readyTitle") : t("readyTitle")}</h2>
        <p className="mt-2 text-sm text-[var(--color-danger)]">{t("warnOnce")}</p>

        <div className="mt-6 rounded-[var(--radius-md)] border border-[var(--color-line)] bg-[var(--color-bg-base)] p-5">
          {c.hostname && esAi && <CopyRow label={t("hostname")} value={c.hostname} />}
          {c.ip && <CopyRow label={esAi ? t("ai.ipv4") : t("ip")} value={c.ip} />}
          {esAi && c.ipv6 && <CopyRow label={t("ai.ipv6")} value={c.ipv6} />}
          <CopyRow label={t("user")} value={c.usuario} />
          <CopyRow label={t("password")} value={c.password} />
          {c.hostname && !esAi && <CopyRow label={t("hostname")} value={c.hostname} />}
          {c.os && <CopyRow label={t("os")} value={esAi ? "Ubuntu 24.04 LTS" : c.os} mono={false} />}
          {c.ubicacion && (
            <CopyRow
              label={t("location")}
              value={esAi ? ubicacionConPais(c.ubicacion, c.pais, locale) : c.ubicacion}
              mono={false}
            />
          )}
          {esAi && <CopyRow label={t("ai.access")} value={t("ai.accessValue")} mono={false} />}
          {esAi && c.recursos && (
            <CopyRow
              label={t("ai.resources")}
              value={t("ai.resourcesValue", {
                vcores: c.recursos.vcores,
                ram: Math.round((c.recursos.ram_mb / 1024) * 10) / 10,
                disk: c.recursos.disco_gb,
              })}
              mono={false}
            />
          )}
        </div>

        {c.ip && !esAi && (
          <div className="mt-5">
            <span className="mono-label text-[0.6rem] text-[var(--color-fg-muted)]">{t("sshHint")}</span>
            <CopyRow label="ssh" value={`ssh ${c.usuario}@${c.ip}`} />
          </div>
        )}

        {esAi && (
          <div className="mt-6">
            <h3 className="text-lg font-semibold">{t("ai.stepsTitle")}</h3>
            <ol className="mt-3 space-y-4 text-sm">
              {c.ip && (
                <li>
                  <p className="text-[var(--color-fg-muted)]">1. {t("ai.step1")}</p>
                  <CopyRow label="ssh" value={`ssh ${c.usuario}@${c.ip}`} />
                </li>
              )}
              <li>
                <p className="text-[var(--color-fg-muted)]">
                  2. <strong className="text-[var(--color-fg)]">{t("ai.step2Title")}</strong> — {t("ai.step2")}
                </p>
                <CopyRow label="$" value="claude" />
              </li>
              <li>
                <p className="text-[var(--color-fg-muted)]">
                  3. <strong className="text-[var(--color-fg)]">{t("ai.step3Title")}</strong> — {t("ai.step3")}
                </p>
                <CopyRow label="$" value="codex" />
              </li>
            </ol>
            <p className="mt-4 text-sm text-[var(--color-fg-muted)]">{t("ai.tmuxTip")}</p>
            <p className="mt-3 border-l-2 border-[var(--color-line-strong)] pl-3 text-xs text-[var(--color-fg-muted)]">
              {t("ai.notIncluded")}
            </p>
          </div>
        )}

        <Link
          href="/cuenta"
          className="mt-6 inline-flex items-center justify-center rounded-[var(--radius-md)] bg-[var(--color-accent)] px-6 py-3 text-sm font-medium text-black transition-colors hover:bg-[var(--color-accent-dim)]"
        >
          {t("goToAccount")} →
        </Link>
      </div>
    );
  }

  if (estado.fase === "error") {
    const key =
      estado.motivo === "not_found"
        ? "errNotFound"
        : estado.motivo === "used"
          ? "errUsed"
          : estado.motivo === "expired"
            ? "errExpired"
            : estado.motivo === "unavailable"
              ? "errUnavailable"
              : "errGeneric";
    return (
      <div className="rounded-[var(--radius-lg)] border border-[var(--color-danger)] bg-[var(--color-bg-raised)] p-8">
        <div className="font-mono text-sm text-[var(--color-danger)]">● {t("errTag")}</div>
        <h2 className="mt-3 text-2xl font-semibold">{t("errTitle")}</h2>
        <p className="mt-2 text-sm text-[var(--color-fg-muted)]">{t(key)}</p>
        <Link
          href="/soporte"
          className="mt-6 inline-flex items-center justify-center rounded-[var(--radius-md)] border border-[var(--color-line-strong)] px-6 py-3 text-sm transition-colors hover:border-[var(--color-accent)]"
        >
          {t("contactSupport")} →
        </Link>
      </div>
    );
  }

  // idle / loading
  return (
    <div className="rounded-[var(--radius-lg)] border border-[var(--color-line)] bg-[var(--color-bg-raised)] p-8">
      <p className="text-sm text-[var(--color-fg-muted)]">{t("intro")}</p>
      <button
        type="button"
        onClick={reveal}
        disabled={estado.fase === "loading"}
        className="mt-6 inline-flex items-center justify-center rounded-[var(--radius-md)] bg-[var(--color-accent)] px-6 py-3.5 text-sm font-medium text-black transition-colors hover:bg-[var(--color-accent-dim)] disabled:opacity-60"
      >
        {estado.fase === "loading" ? t("revealing") : t("reveal")}
      </button>
      <p className="mt-4 font-mono text-xs text-[var(--color-fg-dim)]">{t("onceNote")}</p>
    </div>
  );
}
