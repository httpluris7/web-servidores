"use client";

import { useCallback, useEffect, useState } from "react";
import { useTranslations } from "next-intl";
import type { VpsFirewallOptions, VpsFirewallRule } from "@/lib/provisioner/client";
import { Icon } from "./icons";
import { CARD, SECTION_INDEX } from "./ui";

const POLICIES = ["ACCEPT", "DROP", "REJECT"] as const;
const PROTOS = ["", "tcp", "udp", "icmp"] as const;

/**
 * Sección "Cortafuegos" (Fase 6). Habilitar/deshabilitar, políticas por defecto
 * de entrada/salida y reglas (crear/borrar). Aviso claro de bloqueo: con el
 * cortafuegos activo y política de entrada DROP, sin una regla que permita tu
 * acceso (p. ej. SSH/RDP) te quedas fuera.
 */
export function FirewallSection({ id }: { id: string }) {
  const t = useTranslations("panel");
  const [options, setOptions] = useState<VpsFirewallOptions | null>(null);
  const [rules, setRules] = useState<VpsFirewallRule[]>([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Formulario de nueva regla.
  const [type, setType] = useState("in");
  const [action, setAction] = useState("ACCEPT");
  const [proto, setProto] = useState("");
  const [dport, setDport] = useState("");
  const [source, setSource] = useState("");

  const cargar = useCallback(async () => {
    try {
      const res = await fetch(`/api/panel/servicios/${id}/firewall`);
      const j = await res.json().catch(() => null);
      if (j?.ok) {
        setOptions(j.options as VpsFirewallOptions);
        setRules(Array.isArray(j.rules) ? (j.rules as VpsFirewallRule[]) : []);
        setError(null);
      } else {
        setError(t("power.errorGeneric"));
      }
    } catch {
      setError(t("power.errorConnection"));
    }
  }, [id, t]);

  useEffect(() => {
    void cargar();
  }, [cargar]);

  const enviar = useCallback(
    async (method: string, path: string, body?: unknown): Promise<boolean> => {
      setError(null);
      setBusy(true);
      try {
        const res = await fetch(`/api/panel/servicios/${id}/firewall${path}`, {
          method,
          headers: body ? { "Content-Type": "application/json" } : undefined,
          body: body ? JSON.stringify(body) : undefined,
        });
        const j = await res.json().catch(() => null);
        if (!res.ok || !j?.ok) {
          setError(res.status === 429 ? t("power.errorTooMany") : t("power.errorGeneric"));
          return false;
        }
        return true;
      } catch {
        setError(t("power.errorConnection"));
        return false;
      } finally {
        setBusy(false);
      }
    },
    [id, t],
  );

  async function cambiarOpciones(patch: Record<string, unknown>) {
    if (await enviar("PUT", "", patch)) await cargar();
  }
  async function crearRegla() {
    const body: Record<string, string> = { type, action };
    if (proto) body.proto = proto;
    if (dport.trim()) body.dport = dport.trim();
    if (source.trim()) body.source = source.trim();
    if (await enviar("POST", "/rules", body)) {
      setDport("");
      setSource("");
      await cargar();
    }
  }
  async function borrarRegla(pos: number | null) {
    if (pos == null) return;
    if (await enviar("DELETE", `/rules?pos=${pos}`)) await cargar();
  }

  const activo = options?.enable === 1;
  const control =
    "rounded-[var(--radius-md)] border border-[var(--color-line-strong)] bg-[var(--color-bg-base)] px-3 py-2.5 text-sm focus:border-[var(--color-accent)] focus:outline-none";
  const boton =
    "inline-flex min-h-11 items-center justify-center rounded-[var(--radius-md)] border border-[var(--color-line-strong)] px-4 text-sm transition-colors hover:border-[var(--color-accent)] hover:text-[var(--color-accent)] disabled:opacity-40";

  return (
    <section id="firewall" className={`${CARD} scroll-mt-28`}>
      <div className="px-6 pt-6">
        <p className={SECTION_INDEX}>/14</p>
        <h2 className="mt-2 text-lg font-semibold">{t("firewall.heading")}</h2>
        <p className="mt-1 text-sm text-[var(--color-fg-muted)]">{t("firewall.intro")}</p>
      </div>

      <div className="px-6 py-5">
        {error && (
          <p role="alert" className="mb-4 text-sm text-[var(--color-danger)]">
            {error}
          </p>
        )}

        {options === null ? (
          <div className="space-y-3" aria-hidden="true">
            {Array.from({ length: 3 }).map((_, i) => (
              <span key={i} className="block h-6 animate-pulse rounded bg-[var(--color-bg-overlay)]" />
            ))}
          </div>
        ) : (
          <>
            {/* Estado + políticas */}
            <div className="flex flex-wrap items-end gap-4">
              <button
                type="button"
                disabled={busy}
                onClick={() => cambiarOpciones({ enable: activo ? 0 : 1 })}
                className={boton}
              >
                {activo ? t("firewall.disable") : t("firewall.enable")}
              </button>
              <span
                className={`inline-flex items-center gap-1.5 rounded-full border px-3 py-1 font-mono text-xs ${
                  activo
                    ? "border-[var(--color-accent)]/40 bg-[var(--color-accent)]/10 text-[var(--color-accent)]"
                    : "border-[var(--color-line-strong)] text-[var(--color-fg-muted)]"
                }`}
              >
                {activo ? t("firewall.stateOn") : t("firewall.stateOff")}
              </span>

              <label className="grid gap-1">
                <span className="mono-label text-[0.6rem]">{t("firewall.policyIn")}</span>
                <select
                  value={options.policy_in}
                  disabled={busy}
                  onChange={(e) => cambiarOpciones({ policy_in: e.target.value })}
                  className={control}
                >
                  {POLICIES.map((p) => (
                    <option key={p} value={p}>
                      {p}
                    </option>
                  ))}
                </select>
              </label>
              <label className="grid gap-1">
                <span className="mono-label text-[0.6rem]">{t("firewall.policyOut")}</span>
                <select
                  value={options.policy_out}
                  disabled={busy}
                  onChange={(e) => cambiarOpciones({ policy_out: e.target.value })}
                  className={control}
                >
                  {POLICIES.map((p) => (
                    <option key={p} value={p}>
                      {p}
                    </option>
                  ))}
                </select>
              </label>
            </div>

            {activo && options.policy_in === "DROP" && (
              <p className="mt-4 flex items-start gap-2 rounded-[var(--radius-md)] border border-[var(--color-danger)]/40 bg-[var(--color-danger)]/10 px-4 py-2.5 text-xs text-[var(--color-fg-muted)]">
                <Icon name="shield" size={16} className="mt-0.5 shrink-0 text-[var(--color-danger)]" />
                {t("firewall.lockoutWarning")}
              </p>
            )}

            {/* Reglas */}
            <h3 className="mt-7 text-sm font-semibold">{t("firewall.rulesHeading")}</h3>
            {rules.length === 0 ? (
              <p className="mt-3 text-sm text-[var(--color-fg-dim)]">{t("firewall.rulesEmpty")}</p>
            ) : (
              <div className="mt-3 overflow-x-auto">
                <table className="w-full min-w-[38rem] border-collapse text-sm">
                  <thead>
                    <tr className="border-t border-[var(--color-line)] text-left">
                      {["dir", "action", "proto", "dport", "source", ""].map((c, i) => (
                        <th key={i} className="px-3 py-2 mono-label text-[0.6rem] font-normal">
                          {c ? t(`firewall.col.${c}`) : ""}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {rules.map((r) => (
                      <tr key={r.pos} className="border-t border-[var(--color-line)]">
                        <td className="px-3 py-2 font-mono text-xs">{r.type ?? "—"}</td>
                        <td className="px-3 py-2 font-mono text-xs">{r.action ?? "—"}</td>
                        <td className="px-3 py-2 font-mono text-xs">{r.proto ?? "—"}</td>
                        <td className="px-3 py-2 font-mono text-xs">{r.dport ?? "—"}</td>
                        <td className="px-3 py-2 font-mono text-xs break-all">{r.source ?? "—"}</td>
                        <td className="px-3 py-2 text-right">
                          <button
                            type="button"
                            disabled={busy}
                            onClick={() => borrarRegla(r.pos)}
                            className="text-xs text-[var(--color-fg-muted)] transition-colors hover:text-[var(--color-danger)] disabled:opacity-40"
                          >
                            {t("firewall.delete")}
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}

            {/* Nueva regla */}
            <div className="mt-5 flex flex-wrap items-end gap-3">
              <label className="grid gap-1">
                <span className="mono-label text-[0.6rem]">{t("firewall.col.dir")}</span>
                <select value={type} onChange={(e) => setType(e.target.value)} className={control}>
                  <option value="in">in</option>
                  <option value="out">out</option>
                </select>
              </label>
              <label className="grid gap-1">
                <span className="mono-label text-[0.6rem]">{t("firewall.col.action")}</span>
                <select value={action} onChange={(e) => setAction(e.target.value)} className={control}>
                  {POLICIES.map((p) => (
                    <option key={p} value={p}>
                      {p}
                    </option>
                  ))}
                </select>
              </label>
              <label className="grid gap-1">
                <span className="mono-label text-[0.6rem]">{t("firewall.col.proto")}</span>
                <select value={proto} onChange={(e) => setProto(e.target.value)} className={control}>
                  {PROTOS.map((p) => (
                    <option key={p} value={p}>
                      {p || "—"}
                    </option>
                  ))}
                </select>
              </label>
              <label className="grid gap-1">
                <span className="mono-label text-[0.6rem]">{t("firewall.col.dport")}</span>
                <input
                  value={dport}
                  onChange={(e) => setDport(e.target.value)}
                  placeholder="22"
                  className={`${control} w-24`}
                />
              </label>
              <label className="grid gap-1">
                <span className="mono-label text-[0.6rem]">{t("firewall.col.source")}</span>
                <input
                  value={source}
                  onChange={(e) => setSource(e.target.value)}
                  placeholder="0.0.0.0/0"
                  className={`${control} w-40`}
                />
              </label>
              <button type="button" className={boton} disabled={busy} onClick={crearRegla}>
                {t("firewall.addRule")}
              </button>
            </div>
          </>
        )}
      </div>
    </section>
  );
}
