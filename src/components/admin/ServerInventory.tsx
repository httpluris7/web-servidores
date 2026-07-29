"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import type { InventoryCustomer, InventoryItem } from "@/lib/servidores/inventario";
import type { ManagedServer } from "@/lib/servidores/store";

type Data = {
  configured: boolean;
  items: InventoryItem[];
  huerfanos: ManagedServer[];
  clientes: InventoryCustomer[];
};

/** Colorea el estado del servidor. Cualquier estado desconocido va en neutro. */
function statusTone(status: string): string {
  if (status === "started") return "border-[var(--color-accent)]/40 bg-[var(--color-accent)]/10 text-[var(--color-accent)]";
  if (status === "stopped") return "border-[var(--color-line-strong)] text-[var(--color-fg-muted)]";
  return "border-[var(--color-line-strong)] text-[var(--color-fg)]";
}

/**
 * Inventario de servidores del proveedor y su asignación a clientes.
 *
 * Asignar aquí NO toca nada en el proveedor: solo decide a quién se le muestra
 * cada servidor en su área de cliente. Por eso "olvidar" una ficha huérfana es
 * inofensivo — borra nuestra vinculación, no el VPS.
 */
export function ServerInventory({ initial }: { initial: Data }) {
  const t = useTranslations("admin");
  const [data, setData] = useState(initial);
  const [query, setQuery] = useState("");
  const [busyId, setBusyId] = useState<number | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function reload(refresh: boolean) {
    setError(null);
    setRefreshing(true);
    try {
      const res = await fetch(`/api/admin/servidores${refresh ? "?refresh=1" : ""}`);
      const json = await res.json().catch(() => null);
      if (!res.ok || !json?.ok) {
        setError(json?.error ?? t("servidores.errorLoad"));
        return;
      }
      setData({
        configured: json.configured,
        items: json.items,
        huerfanos: json.huerfanos,
        clientes: json.clientes,
      });
    } catch {
      setError(t("servidores.errorConnection"));
    } finally {
      setRefreshing(false);
    }
  }

  async function assign(remoteId: number, userId: string | null) {
    setError(null);
    setBusyId(remoteId);
    try {
      const res = await fetch("/api/admin/servidores", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ remoteId, userId }),
      });
      const json = await res.json().catch(() => null);
      if (!res.ok || !json?.ok) {
        setError(json?.error ?? t("servidores.errorSave"));
        return;
      }
      await reload(false);
    } catch {
      setError(t("servidores.errorConnection"));
    } finally {
      setBusyId(null);
    }
  }

  async function forget(remoteId: number) {
    setBusyId(remoteId);
    try {
      await fetch("/api/admin/servidores", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ action: "forget", remoteId }),
      });
      await reload(false);
    } catch {
      setError(t("servidores.errorConnection"));
    } finally {
      setBusyId(null);
    }
  }

  if (!data.configured) {
    return (
      <div className="rounded-[var(--radius-lg)] border border-[var(--color-line)] bg-[var(--color-bg-raised)] p-6">
        <p className="text-sm text-[var(--color-fg-muted)]">{t("servidores.notConfigured")}</p>
      </div>
    );
  }

  const q = query.trim().toLowerCase();
  const items = q
    ? data.items.filter((i) =>
        `${i.remote.name} ${i.remote.ipv4.join(" ")} ${i.remote.projectName ?? ""} ${
          i.cliente?.nombre ?? ""
        } ${i.cliente?.email ?? ""}`
          .toLowerCase()
          .includes(q)
      )
    : data.items;

  const asignados = data.items.filter((i) => i.cliente).length;

  return (
    <div className="grid gap-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <h2 className="text-lg font-semibold">
          {t("servidores.heading")}{" "}
          <span className="font-mono text-sm text-[var(--color-fg-muted)]">
            ({asignados}/{data.items.length})
          </span>
        </h2>
        <div className="flex w-full items-center gap-2 sm:w-auto">
          <input
            type="search"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder={t("servidores.searchPlaceholder")}
            className="min-w-0 flex-1 rounded-[var(--radius-md)] border border-[var(--color-line-strong)] bg-[var(--color-bg-base)] px-3 py-2.5 text-sm placeholder:text-[var(--color-fg-dim)] focus:border-[var(--color-accent)] focus:outline-none sm:w-64 sm:flex-none sm:py-2"
          />
          <button
            type="button"
            onClick={() => reload(true)}
            disabled={refreshing}
            className="shrink-0 rounded-[var(--radius-md)] border border-[var(--color-line-strong)] px-3 py-2.5 text-sm transition-colors hover:border-[var(--color-accent)] hover:text-[var(--color-accent)] disabled:opacity-50 sm:py-2"
          >
            {refreshing ? t("servidores.refreshing") : t("servidores.refresh")}
          </button>
        </div>
      </div>

      {error && (
        <p role="alert" className="text-sm text-[var(--color-danger)]">
          {error}
        </p>
      )}

      {items.length === 0 ? (
        <p className="text-sm text-[var(--color-fg-muted)]">
          {q ? t("servidores.noMatch") : t("servidores.none")}
        </p>
      ) : (
        <div className="rounded-[var(--radius-lg)] border border-[var(--color-line)] md:overflow-x-auto">
          <table className="table-cards w-full border-collapse text-sm md:min-w-[760px]">
            <thead>
              <tr className="border-b border-[var(--color-line)] text-left">
                <th className="px-4 py-3 mono-label text-[0.6rem]">{t("servidores.colServer")}</th>
                <th className="px-4 py-3 mono-label text-[0.6rem]">{t("servidores.colStatus")}</th>
                <th className="px-4 py-3 mono-label text-[0.6rem]">{t("servidores.colSpecs")}</th>
                <th className="px-4 py-3 mono-label text-[0.6rem]">{t("servidores.colCustomer")}</th>
              </tr>
            </thead>
            <tbody>
              {items.map(({ remote, cliente }) => (
                <tr
                  key={remote.id}
                  className="border-b border-[var(--color-line)] transition-colors last:border-0 hover:bg-white/[0.02]"
                >
                  <td data-label={t("servidores.colServer")} className="px-4 py-3">
                    <p className="font-medium text-[var(--color-fg)]">{remote.name || `#${remote.id}`}</p>
                    <p className="font-mono text-xs text-[var(--color-fg-muted)]">
                      {remote.ipv4[0] ?? "—"}
                    </p>
                    {remote.projectName && (
                      <p className="mt-0.5 text-xs text-[var(--color-fg-dim)]">{remote.projectName}</p>
                    )}
                  </td>

                  <td data-label={t("servidores.colStatus")} className="px-4 py-3">
                    <span
                      className={`inline-block rounded-full border px-2.5 py-0.5 font-mono text-xs ${statusTone(
                        remote.status
                      )}`}
                    >
                      {remote.status}
                    </span>
                    {remote.isProcessing && (
                      <p className="mt-1 text-xs text-[var(--color-fg-muted)]">
                        {t("servidores.statusProcessing")}
                        {remote.progress !== null ? ` ${remote.progress}%` : ""}
                      </p>
                    )}
                    {remote.isSuspended && (
                      <p className="mt-1 text-xs text-[var(--color-danger)]">
                        {t("servidores.statusSuspended")}
                      </p>
                    )}
                  </td>

                  <td
                    data-label={t("servidores.colSpecs")}
                    className="px-4 py-3 font-mono text-xs text-[var(--color-fg-muted)]"
                  >
                    {[
                      remote.vcpu !== null ? `${remote.vcpu} vCPU` : null,
                      remote.ramMb !== null ? `${Math.round(remote.ramMb / 1024)} GB` : null,
                      remote.diskGb !== null ? `${remote.diskGb} GB` : null,
                    ]
                      .filter(Boolean)
                      .join(" · ") || "—"}
                    {remote.location && (
                      <p className="mt-0.5 text-[var(--color-fg-dim)]">{remote.location}</p>
                    )}
                  </td>

                  <td data-label={t("servidores.colCustomer")} className="px-4 py-3">
                    <select
                      value={cliente?.id ?? ""}
                      disabled={busyId === remote.id}
                      onChange={(e) => assign(remote.id, e.target.value || null)}
                      className="w-full min-w-0 rounded-[var(--radius-md)] border border-[var(--color-line-strong)] bg-[var(--color-bg-base)] px-3 py-2 text-sm focus:border-[var(--color-accent)] focus:outline-none disabled:opacity-50 md:max-w-[220px]"
                    >
                      <option value="">{t("servidores.unassigned")}</option>
                      {data.clientes.map((c) => (
                        <option key={c.id} value={c.id}>
                          {c.nombre} — {c.email}
                        </option>
                      ))}
                    </select>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {data.huerfanos.length > 0 && (
        <section className="rounded-[var(--radius-lg)] border border-[var(--color-line)] bg-[var(--color-bg-raised)] p-6">
          <h3 className="text-sm font-semibold">{t("servidores.orphansHeading")}</h3>
          <p className="mt-1 mb-4 text-xs text-[var(--color-fg-muted)]">
            {t("servidores.orphansIntro")}
          </p>
          <ul className="grid gap-2">
            {data.huerfanos.map((h) => (
              <li
                key={h.id}
                className="flex min-w-0 flex-wrap items-center justify-between gap-3 border-t border-[var(--color-line)] pt-2 text-sm first:border-0 first:pt-0"
              >
                <span className="min-w-0 font-mono text-xs break-words text-[var(--color-fg-muted)]">
                  #{h.remoteId} · {h.etiqueta || "—"}
                </span>
                <button
                  type="button"
                  onClick={() => forget(h.remoteId)}
                  disabled={busyId === h.remoteId}
                  className="shrink-0 text-xs text-[var(--color-fg-muted)] transition-colors hover:text-[var(--color-danger)] disabled:opacity-50"
                >
                  {t("servidores.forget")}
                </button>
              </li>
            ))}
          </ul>
        </section>
      )}
    </div>
  );
}
