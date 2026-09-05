"use client";

import { useCallback, useEffect, useState } from "react";
import { useTranslations } from "next-intl";
import type { VpsDisk } from "@/lib/provisioner/client";
import { CARD, SECTION_INDEX } from "./ui";

const BOTON =
  "inline-flex min-h-11 items-center justify-center rounded-[var(--radius-md)] border border-[var(--color-line-strong)] px-4 text-sm transition-colors hover:border-[var(--color-accent)] hover:text-[var(--color-accent)] disabled:opacity-40";

/**
 * Sección "Discos" (Fase 8): discos de la VM con tamaño, almacenamiento y
 * opciones (TRIM/discard, emulación SSD, IO thread), y "Ajustar al plan" cuando
 * el disco es menor que el contratado (tras ampliar plan). Proxmox solo permite
 * crecer; el sistema de archivos lo extiende el guest al reiniciar.
 */
export function DiscosSection({ id }: { id: string }) {
  const t = useTranslations("panel");
  const [disks, setDisks] = useState<VpsDisk[] | null>(null);
  const [planGb, setPlanGb] = useState<number | null>(null);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<{ tipo: "ok" | "error"; texto: string } | null>(null);

  const cargar = useCallback(async () => {
    try {
      const res = await fetch(`/api/panel/servicios/${id}/discos`);
      const j = await res.json().catch(() => null);
      if (j?.ok) {
        setDisks(j.disks as VpsDisk[]);
        setPlanGb(j.planDiscoGb ?? null);
      } else {
        setDisks([]);
      }
    } catch {
      setDisks([]);
    }
  }, [id]);

  useEffect(() => {
    void cargar();
  }, [cargar]);

  async function opcion(key: string, patch: { discard?: boolean; ssd?: boolean; iothread?: boolean }) {
    setBusy(true);
    setMsg(null);
    try {
      const res = await fetch(`/api/panel/servicios/${id}/discos/${encodeURIComponent(key)}`, {
        method: "PUT",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(patch),
      });
      const j = await res.json().catch(() => null);
      if (!res.ok || !j?.ok) {
        setMsg({ tipo: "error", texto: res.status === 409 ? t("power.errorBusy") : t("power.errorGeneric") });
        return;
      }
      setMsg({ tipo: "ok", texto: j.requiereReinicio ? t("discos.savedRestart") : t("discos.saved") });
      await cargar();
    } catch {
      setMsg({ tipo: "error", texto: t("power.errorConnection") });
    } finally {
      setBusy(false);
    }
  }

  async function ajustar(key: string) {
    setBusy(true);
    setMsg(null);
    try {
      const res = await fetch(`/api/panel/servicios/${id}/discos/${encodeURIComponent(key)}/ajustar`, { method: "POST" });
      const j = await res.json().catch(() => null);
      if (!res.ok || !j?.ok) {
        setMsg({ tipo: "error", texto: j?.error === "already_at_plan" ? t("discos.alreadyAtPlan") : t("power.errorGeneric") });
        return;
      }
      setMsg({ tipo: "ok", texto: t("discos.resized", { size: j.sizeGb }) });
      await cargar();
    } catch {
      setMsg({ tipo: "error", texto: t("power.errorConnection") });
    } finally {
      setBusy(false);
    }
  }

  const toggle = (d: VpsDisk, k: "discard" | "ssd" | "iothread") => (
    <label className="flex items-center gap-2 text-xs">
      <input type="checkbox" checked={d[k]} disabled={busy} onChange={(e) => opcion(d.key, { [k]: e.target.checked })} className="h-4 w-4 accent-[var(--color-accent)]" />
      {t(`discos.${k}`)}
    </label>
  );

  return (
    <section id="discos" className={`${CARD} scroll-mt-28`}>
      <div className="px-6 pt-6">
        <p className={SECTION_INDEX}>/14</p>
        <h2 className="mt-2 text-lg font-semibold">{t("discos.heading")}</h2>
        <p className="mt-1 text-sm text-[var(--color-fg-muted)]">{t("discos.intro")}</p>
      </div>
      <div className="px-6 py-5">
        {disks === null ? (
          <span className="block h-5 w-1/2 animate-pulse rounded bg-[var(--color-bg-overlay)]" aria-hidden="true" />
        ) : disks.length === 0 ? (
          <p className="text-sm text-[var(--color-fg-dim)]">{t("discos.empty")}</p>
        ) : (
          <ul className="grid gap-4">
            {disks.map((d) => {
              const menor = planGb != null && d.sizeGb != null && d.sizeGb < planGb;
              return (
                <li key={d.key} className="rounded-[var(--radius-md)] border border-[var(--color-line)] bg-[var(--color-bg-base)] p-4">
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div className="min-w-0">
                      <p className="font-mono text-sm">
                        {d.key} · {d.sizeGb != null ? `${d.sizeGb} GB` : "—"}
                        {planGb != null && d.key.endsWith("0") && (
                          <span className="ml-2 text-xs text-[var(--color-fg-muted)]">{t("discos.plan", { size: planGb })}</span>
                        )}
                      </p>
                      <p className="mt-1 break-all font-mono text-xs text-[var(--color-fg-muted)]">
                        {d.volume}
                        {d.cache ? ` · cache=${d.cache}` : ""}
                        {!d.backup ? ` · ${t("discos.noBackup")}` : ""}
                      </p>
                    </div>
                    {menor && (
                      <button type="button" className={BOTON} disabled={busy} onClick={() => ajustar(d.key)}>
                        {t("discos.resize", { size: planGb })}
                      </button>
                    )}
                  </div>
                  <div className="mt-3 flex flex-wrap gap-5">
                    {toggle(d, "discard")}
                    {toggle(d, "ssd")}
                    {toggle(d, "iothread")}
                  </div>
                </li>
              );
            })}
          </ul>
        )}
        {msg && (
          <p role={msg.tipo === "error" ? "alert" : "status"} className={`mt-4 text-sm ${msg.tipo === "error" ? "text-[var(--color-danger)]" : "text-[var(--color-accent)]"}`}>
            {msg.texto}
          </p>
        )}
      </div>
    </section>
  );
}
