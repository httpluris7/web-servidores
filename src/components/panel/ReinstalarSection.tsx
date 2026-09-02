"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { useRouter } from "@/i18n/navigation";
import { ofertablesParaDisco } from "@/lib/provisioner/os";
import { CARD_PAD, SECTION_INDEX } from "./ui";

/**
 * Sección "Reinstalación" (Fase 6). Destructivo total: borra el disco y reinstala
 * el SO elegido. Confirmación por hostname, como "Parar". El SO se limita a los
 * que caben en el disco de ESTE servidor. El aprovisionador la encola; el
 * progreso se ve en el historial de tareas.
 */
export function ReinstalarSection({
  id,
  nombre,
  diskGb,
}: {
  id: string;
  nombre: string;
  diskGb: number | null;
}) {
  const t = useTranslations("panel");
  const router = useRouter();
  const opciones = ofertablesParaDisco(diskGb);
  const [os, setOs] = useState(opciones[0]?.slug ?? "");
  const [confirmacion, setConfirmacion] = useState("");
  const [abierto, setAbierto] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  async function reinstalar() {
    setError(null);
    setNotice(null);
    setBusy(true);
    try {
      const res = await fetch(`/api/panel/servicios/${id}/reinstalar`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ os, confirmacion }),
      });
      const j = await res.json().catch(() => null);
      if (!res.ok || !j?.ok) {
        setError(
          j?.error === "confirmation_mismatch"
            ? t("power.errorConfirmation")
            : j?.error === "invalid_os"
              ? t("reinstalar.invalidOs")
              : j?.error === "busy"
                ? t("power.errorBusy")
                : t("power.errorGeneric"),
        );
        return;
      }
      setAbierto(false);
      setConfirmacion("");
      setNotice(t("reinstalar.started"));
      window.dispatchEvent(new CustomEvent("panel:refresh-tasks"));
      router.refresh();
    } catch {
      setError(t("power.errorConnection"));
    } finally {
      setBusy(false);
    }
  }

  const boton =
    "inline-flex min-h-11 items-center justify-center rounded-[var(--radius-md)] border border-[var(--color-line-strong)] px-4 text-sm transition-colors hover:border-[var(--color-accent)] hover:text-[var(--color-accent)] disabled:opacity-40";

  return (
    <section id="reinstalar" className={`${CARD_PAD} border-[var(--color-danger)]/30 scroll-mt-28`}>
      <p className={SECTION_INDEX}>/12</p>
      <h2 className="mt-2 text-lg font-semibold">{t("reinstalar.heading")}</h2>
      <p className="mt-1 mb-5 text-sm text-[var(--color-fg-muted)]">{t("reinstalar.intro")}</p>

      {error && (
        <p role="alert" className="mb-4 text-sm text-[var(--color-danger)]">
          {error}
        </p>
      )}
      {notice && <p className="mb-4 text-sm text-[var(--color-accent)]">{notice}</p>}

      {!abierto ? (
        <button type="button" className={boton} disabled={busy} onClick={() => setAbierto(true)}>
          {t("reinstalar.open")}
        </button>
      ) : (
        <div className="grid gap-5">
          <div>
            <label htmlFor="reinstall-os" className="mono-label text-[0.6rem]">
              {t("reinstalar.os")}
            </label>
            <select
              id="reinstall-os"
              value={os}
              onChange={(e) => setOs(e.target.value)}
              className="mt-2 w-full min-w-0 rounded-[var(--radius-md)] border border-[var(--color-line-strong)] bg-[var(--color-bg-base)] px-3 py-2.5 text-sm focus:border-[var(--color-accent)] focus:outline-none"
            >
              {opciones.map((o) => (
                <option key={o.slug} value={o.slug}>
                  {o.label}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label htmlFor="reinstall-confirm" className="mono-label text-[0.6rem]">
              {t("power.confirmLabel")}
            </label>
            <p className="mt-1 mb-2 text-xs text-[var(--color-fg-muted)]">
              {t("reinstalar.confirmBody")}{" "}
              <span className="font-mono break-all text-[var(--color-fg)]">{nombre}</span>
            </p>
            <input
              id="reinstall-confirm"
              type="text"
              value={confirmacion}
              onChange={(e) => setConfirmacion(e.target.value)}
              autoComplete="off"
              className="w-full min-w-0 rounded-[var(--radius-md)] border border-[var(--color-line-strong)] bg-[var(--color-bg-base)] px-3 py-2.5 font-mono text-sm focus:border-[var(--color-danger)] focus:outline-none"
            />
          </div>
          <div className="flex flex-wrap gap-3">
            <button
              type="button"
              disabled={busy || confirmacion.trim() !== nombre || !os}
              onClick={reinstalar}
              className="inline-flex min-h-11 items-center justify-center rounded-[var(--radius-md)] bg-[var(--color-danger)] px-5 text-sm font-medium text-white transition-opacity hover:opacity-90 disabled:opacity-40"
            >
              {t("reinstalar.confirm")}
            </button>
            <button
              type="button"
              onClick={() => {
                setAbierto(false);
                setConfirmacion("");
              }}
              className="text-sm text-[var(--color-fg-muted)] transition-colors hover:text-[var(--color-fg)]"
            >
              {t("power.cancel")}
            </button>
          </div>
        </div>
      )}
    </section>
  );
}
