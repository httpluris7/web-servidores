"use client";

import { useCallback, useEffect, useState } from "react";
import { useTranslations } from "next-intl";

type Record = {
  id: string;
  type: string;
  name: string;
  content: string;
  ttl: number | null;
  prio: number | null;
};

const TIPOS = ["A", "AAAA", "CNAME", "MX", "TXT", "NS", "SRV", "CAA"];

/**
 * Editor de DNS de un dominio del cliente (CP4). Lista, crea y borra registros
 * vía `/api/cuenta/dominios/[domain]/dns` (que comprueba la propiedad). Njalla es
 * el DNS por defecto de los dominios registrados con ellos.
 */
export function DnsEditor({ domain }: { domain: string }) {
  const t = useTranslations("dominios");
  const base = `/api/cuenta/dominios/${encodeURIComponent(domain)}/dns`;
  const [records, setRecords] = useState<Record[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const [type, setType] = useState("A");
  const [name, setName] = useState("");
  const [content, setContent] = useState("");
  const [ttl, setTtl] = useState("3600");
  const [prio, setPrio] = useState("10");

  const cargar = useCallback(async () => {
    try {
      const res = await fetch(base);
      const j = await res.json().catch(() => null);
      if (j?.ok && Array.isArray(j.records)) {
        setRecords(j.records as Record[]);
        setError(null);
      } else {
        setError(t("dns.errorProvider"));
        setRecords([]);
      }
    } catch {
      setError(t("dns.errorProvider"));
      setRecords([]);
    }
  }, [base, t]);

  useEffect(() => {
    void cargar();
  }, [cargar]);

  async function crear(e: React.FormEvent) {
    e.preventDefault();
    if (!content.trim()) return;
    setBusy(true);
    setError(null);
    try {
      const b: { type: string; name: string; content: string; ttl?: number; prio?: number } = {
        type,
        name: name.trim(),
        content: content.trim(),
        ttl: Number(ttl) || 3600,
      };
      if (type === "MX" || type === "SRV") b.prio = Number(prio) || 10;
      const res = await fetch(base, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(b),
      });
      const j = await res.json().catch(() => null);
      if (!res.ok || !j?.ok) {
        setError(res.status === 422 ? t("dns.invalid") : t("dns.errorProvider"));
        return;
      }
      setName("");
      setContent("");
      await cargar();
    } catch {
      setError(t("dns.errorProvider"));
    } finally {
      setBusy(false);
    }
  }

  async function borrar(recordId: string) {
    setBusy(true);
    setError(null);
    try {
      const res = await fetch(`${base}?record=${encodeURIComponent(recordId)}`, { method: "DELETE" });
      const j = await res.json().catch(() => null);
      if (!res.ok || !j?.ok) setError(t("dns.errorProvider"));
      else await cargar();
    } catch {
      setError(t("dns.errorProvider"));
    } finally {
      setBusy(false);
    }
  }

  const field =
    "min-w-0 rounded-[var(--radius-md)] border border-[var(--color-line-strong)] bg-[var(--color-bg-base)] px-3 py-2.5 text-sm focus:border-[var(--color-accent)] focus:outline-none";
  const card =
    "rounded-[var(--radius-lg)] border border-[var(--color-line)] bg-[var(--color-bg-raised)]";

  return (
    <div className="grid gap-6">
      {/* Alta de registro */}
      <form onSubmit={crear} className={`${card} grid gap-4 p-6`}>
        <h2 className="text-lg font-semibold">{t("dns.add")}</h2>
        <div className="grid gap-3 sm:grid-cols-[7rem_1fr_1fr]">
          <label className="grid gap-1">
            <span className="mono-label text-[0.6rem]">{t("dns.type")}</span>
            <select value={type} onChange={(e) => setType(e.target.value)} className={field}>
              {TIPOS.map((x) => (
                <option key={x} value={x}>{x}</option>
              ))}
            </select>
          </label>
          <label className="grid gap-1">
            <span className="mono-label text-[0.6rem]">{t("dns.name")}</span>
            <input value={name} onChange={(e) => setName(e.target.value)} placeholder="@" className={field} />
          </label>
          <label className="grid gap-1">
            <span className="mono-label text-[0.6rem]">{t("dns.content")}</span>
            <input value={content} onChange={(e) => setContent(e.target.value)} className={field} />
          </label>
        </div>
        <div className="flex flex-wrap items-end gap-3">
          <label className="grid gap-1">
            <span className="mono-label text-[0.6rem]">{t("dns.ttl")}</span>
            <input value={ttl} onChange={(e) => setTtl(e.target.value)} className={`${field} w-28`} inputMode="numeric" />
          </label>
          {(type === "MX" || type === "SRV") && (
            <label className="grid gap-1">
              <span className="mono-label text-[0.6rem]">{t("dns.priority")}</span>
              <input value={prio} onChange={(e) => setPrio(e.target.value)} className={`${field} w-24`} inputMode="numeric" />
            </label>
          )}
          <button
            type="submit"
            disabled={busy || !content.trim()}
            className="inline-flex min-h-11 items-center justify-center rounded-[var(--radius-md)] border border-[var(--color-line-strong)] px-5 text-sm transition-colors hover:border-[var(--color-accent)] hover:text-[var(--color-accent)] disabled:opacity-40"
          >
            {t("dns.addButton")}
          </button>
        </div>
      </form>

      {error && <p role="alert" className="text-sm text-[var(--color-danger)]">{error}</p>}

      {/* Registros */}
      <div className={card}>
        <div className="px-6 pt-6">
          <h2 className="text-lg font-semibold">{t("dns.records")}</h2>
        </div>
        {records === null ? (
          <div className="space-y-3 px-6 py-6" aria-hidden="true">
            {Array.from({ length: 3 }).map((_, i) => (
              <span key={i} className="block h-5 animate-pulse rounded bg-[var(--color-bg-overlay)]" />
            ))}
          </div>
        ) : records.length === 0 ? (
          <p className="px-6 py-6 text-sm text-[var(--color-fg-dim)]">{t("dns.noRecords")}</p>
        ) : (
          <div className="mt-4 overflow-x-auto">
            <table className="w-full min-w-[40rem] border-collapse text-sm">
              <thead>
                <tr className="border-t border-[var(--color-line)] text-left">
                  {["type", "name", "content", "ttl", ""].map((c, i) => (
                    <th key={i} className="px-6 py-3 mono-label text-[0.6rem] font-normal">
                      {c ? t(`dns.${c}`) : ""}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {records.map((r) => (
                  <tr key={r.id} className="border-t border-[var(--color-line)]">
                    <td className="px-6 py-3 font-mono text-xs">{r.type}</td>
                    <td className="px-6 py-3 font-mono text-xs break-all">{r.name || "@"}</td>
                    <td className="px-6 py-3 font-mono text-xs break-all text-[var(--color-fg-muted)]">
                      {r.prio != null ? `${r.prio} ` : ""}{r.content}
                    </td>
                    <td className="px-6 py-3 font-mono text-xs text-[var(--color-fg-muted)]">{r.ttl ?? "—"}</td>
                    <td className="px-6 py-3 text-right">
                      <button
                        type="button"
                        disabled={busy}
                        onClick={() => borrar(r.id)}
                        className="text-xs text-[var(--color-fg-muted)] transition-colors hover:text-[var(--color-danger)] disabled:opacity-40"
                      >
                        {t("dns.delete")}
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
