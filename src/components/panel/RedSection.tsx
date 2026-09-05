"use client";

import { useCallback, useEffect, useState } from "react";
import { useTranslations } from "next-intl";
import type { PanelService } from "@/lib/panel/types";
import type { VpsNetwork } from "@/lib/provisioner/client";
import { CARD, SECTION_INDEX } from "./ui";

/** Fila etiqueta/valor, como en la tabla de información. */
function Row({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="grid grid-cols-1 gap-1 border-t border-[var(--color-line)] px-6 py-3.5 first:border-0 sm:grid-cols-[minmax(9rem,14rem)_1fr] sm:items-center sm:gap-4">
      <dt className="mono-label text-[0.6rem]">{label}</dt>
      <dd className="min-w-0 text-sm break-words text-[var(--color-fg)]">{children}</dd>
    </div>
  );
}

const CAMPO =
  "mt-1 w-full min-w-0 rounded-[var(--radius-md)] border border-[var(--color-line-strong)] bg-[var(--color-bg-base)] px-3 py-2.5 text-sm focus:border-[var(--color-accent)] focus:outline-none disabled:opacity-40";
const BOTON =
  "inline-flex min-h-11 items-center justify-center rounded-[var(--radius-md)] border border-[var(--color-line-strong)] px-4 text-sm transition-colors hover:border-[var(--color-accent)] hover:text-[var(--color-accent)] disabled:opacity-40";

/**
 * Sección "Red" (Fase 6 informativa + Fase 8 reconfigurable): muestra la
 * interfaz (modelo, bridge, límite, cortafuegos en la NIC) y permite cambiar el
 * modelo, el cortafuegos de la interfaz y los DNS, o restablecer la red tal y
 * como se entregó (IP/gateway del centro de datos). Los cambios de modelo y DNS
 * los aplica cloud-init al reiniciar.
 */
export function RedSection({ service }: { service: PanelService }) {
  const t = useTranslations("panel");
  const dash = <span className="text-[var(--color-fg-dim)]">—</span>;
  const [net, setNet] = useState<VpsNetwork | null>(null);
  const [model, setModel] = useState("virtio");
  const [firewall, setFirewall] = useState(false);
  const [dns, setDns] = useState("");
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<{ tipo: "ok" | "error"; texto: string } | null>(null);
  const [confirmReset, setConfirmReset] = useState(false);

  const cargar = useCallback(async () => {
    try {
      const res = await fetch(`/api/panel/servicios/${service.id}/red`);
      const j = await res.json().catch(() => null);
      if (j?.ok) {
        setNet(j as VpsNetwork);
        setModel(j.nic.model);
        setFirewall(!!j.nic.firewall);
        setDns((j.nameserver as string[]).join(" "));
      }
    } catch {
      /* se queda con la información del servidor (service.*) */
    }
  }, [service.id]);

  useEffect(() => {
    void cargar();
  }, [cargar]);

  async function guardar() {
    setBusy(true);
    setMsg(null);
    const nameserver = dns.split(/[\s,]+/).filter(Boolean);
    try {
      const res = await fetch(`/api/panel/servicios/${service.id}/red`, {
        method: "PUT",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ model, firewall, ...(nameserver.length ? { nameserver } : {}) }),
      });
      const j = await res.json().catch(() => null);
      if (!res.ok || !j?.ok) {
        setMsg({ tipo: "error", texto: j?.error === "invalid_dns" ? t("red.invalidDns") : res.status === 409 ? t("power.errorBusy") : t("power.errorGeneric") });
        return;
      }
      setMsg({ tipo: "ok", texto: j.requiereReinicio ? t("red.savedRestart") : t("red.saved") });
      await cargar();
    } catch {
      setMsg({ tipo: "error", texto: t("power.errorConnection") });
    } finally {
      setBusy(false);
    }
  }

  async function restablecer() {
    setBusy(true);
    setMsg(null);
    try {
      const res = await fetch(`/api/panel/servicios/${service.id}/red/reset`, { method: "POST" });
      const j = await res.json().catch(() => null);
      if (!res.ok || !j?.ok) {
        setMsg({ tipo: "error", texto: res.status === 409 ? t("power.errorBusy") : t("power.errorGeneric") });
        return;
      }
      setConfirmReset(false);
      setMsg({ tipo: "ok", texto: t("red.resetDone") });
      await cargar();
    } catch {
      setMsg({ tipo: "error", texto: t("power.errorConnection") });
    } finally {
      setBusy(false);
    }
  }

  const nicModel = net?.nic.model ?? service.nicModel;
  const nicBridge = net?.nic.bridge ?? service.nicBridge;
  const nicFirewall = net?.nic.firewall ?? service.nicFirewall;
  const rate = net?.nic.rate_mbps ?? service.tasaRedMbps;

  return (
    <section id="red" className={`${CARD} scroll-mt-28`}>
      <div className="px-6 pt-6">
        <p className={SECTION_INDEX}>/11</p>
        <h2 className="mt-2 text-lg font-semibold">{t("red.heading")}</h2>
        <p className="mt-1 text-sm text-[var(--color-fg-muted)]">{t("red.intro")}</p>
      </div>
      <dl className="mt-4">
        <Row label={t("red.model")}>{nicModel ? <span className="font-mono">{nicModel}</span> : dash}</Row>
        <Row label={t("red.bridge")}>{nicBridge ? <span className="font-mono">{nicBridge}</span> : dash}</Row>
        <Row label={t("red.rate")}>
          {rate != null ? <span className="font-mono">{rate} Mbps</span> : <span className="text-[var(--color-fg-muted)]">{t("red.noLimit")}</span>}
        </Row>
        <Row label={t("red.nicFirewall")}>
          <span className={nicFirewall ? "text-[var(--color-accent)]" : "text-[var(--color-fg-muted)]"}>
            {nicFirewall ? t("red.on") : t("red.off")}
          </span>
        </Row>
        <Row label={t("red.dns")}>
          {net && net.nameserver.length > 0 ? <span className="font-mono">{net.nameserver.join(", ")}</span> : dash}
        </Row>
        <Row label={t("info.numIps")}>
          <span className="font-mono">{service.ips.length}</span>
        </Row>
      </dl>

      <div className="border-t border-[var(--color-line)] px-6 py-5">
        <h3 className="text-base font-semibold">{t("red.configureHeading")}</h3>
        <p className="mt-1 text-sm text-[var(--color-fg-muted)]">{t("red.configureIntro")}</p>
        <div className="mt-4 grid gap-4 sm:grid-cols-3">
          <div>
            <label htmlFor="red-model" className="mono-label block text-[0.6rem]">{t("red.model")}</label>
            <select id="red-model" value={model} disabled={!net || busy} onChange={(e) => setModel(e.target.value)} className={CAMPO}>
              {(net?.models ?? ["virtio"]).map((m) => (
                <option key={m} value={m}>{m}</option>
              ))}
            </select>
          </div>
          <div>
            <label htmlFor="red-dns" className="mono-label block text-[0.6rem]">{t("red.dns")}</label>
            <input
              id="red-dns"
              type="text"
              value={dns}
              disabled={!net || busy}
              onChange={(e) => setDns(e.target.value)}
              placeholder="1.1.1.1 8.8.8.8"
              autoComplete="off"
              className={`${CAMPO} font-mono`}
            />
          </div>
          <label className="flex items-end gap-3 pb-3 text-sm">
            <input type="checkbox" checked={firewall} disabled={!net || busy} onChange={(e) => setFirewall(e.target.checked)} className="h-4 w-4 accent-[var(--color-accent)]" />
            {t("red.nicFirewall")}
          </label>
        </div>
        <div className="mt-4 flex flex-wrap items-center gap-4">
          <button type="button" className={BOTON} disabled={!net || busy} onClick={guardar}>
            {busy ? t("red.saving") : t("red.save")}
          </button>
          <button
            type="button"
            disabled={!net || busy}
            onClick={() => setConfirmReset((v) => !v)}
            className="text-sm text-[var(--color-fg-muted)] transition-colors hover:text-[var(--color-danger)] disabled:opacity-40"
          >
            {t("red.reset")}
          </button>
        </div>
        {confirmReset && (
          <div className="mt-4 rounded-[var(--radius-md)] border border-[var(--color-danger)]/40 bg-[var(--color-danger)]/5 p-4">
            <p className="text-sm">{t("red.resetBody")}</p>
            {net?.ipconfig && (
              <p className="mt-1 font-mono text-xs text-[var(--color-fg-muted)]">
                {net.ipconfig.ip}/{net.ipconfig.cidr} · gw {net.ipconfig.gateway}
              </p>
            )}
            <div className="mt-3 flex flex-wrap gap-3">
              <button
                type="button"
                disabled={busy}
                onClick={restablecer}
                className="inline-flex min-h-11 items-center justify-center rounded-[var(--radius-md)] bg-[var(--color-danger)] px-5 text-sm font-medium text-white transition-opacity hover:opacity-90 disabled:opacity-40"
              >
                {t("red.resetConfirm")}
              </button>
              <button type="button" onClick={() => setConfirmReset(false)} className="text-sm text-[var(--color-fg-muted)] transition-colors hover:text-[var(--color-fg)]">
                {t("power.cancel")}
              </button>
            </div>
          </div>
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
