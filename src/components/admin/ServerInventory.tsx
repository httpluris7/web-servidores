"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { Link } from "@/i18n/navigation";
import type {
  AgentStatus,
  ExternalItem,
  InventoryCustomer,
  InventoryItem,
} from "@/lib/servidores/inventario";
import type { ManagedServer } from "@/lib/servidores/store";

type Data = {
  configured: boolean;
  items: InventoryItem[];
  externos: ExternalItem[];
  huerfanos: ManagedServer[];
  clientes: InventoryCustomer[];
  agentes: Record<string, AgentStatus>;
};

/** Colorea el estado del servidor. Cualquier estado desconocido va en neutro. */
function statusTone(status: string): string {
  if (status === "started") return "border-[var(--color-accent)]/40 bg-[var(--color-accent)]/10 text-[var(--color-accent)]";
  if (status === "stopped") return "border-[var(--color-line-strong)] text-[var(--color-fg-muted)]";
  return "border-[var(--color-line-strong)] text-[var(--color-fg)]";
}

/**
 * Inventario de servidores y su asignación a clientes.
 *
 * Asignar aquí NO toca nada en el proveedor: solo decide a quién se le muestra
 * cada servidor en su área de cliente. Por eso "olvidar" una ficha huérfana es
 * inofensivo — borra nuestra vinculación, no el VPS.
 *
 * Conviven dos clases de máquina: las del proveedor, que llegan de su API, y
 * las externas, que damos de alta a mano porque no hay API a la que preguntar
 * (takehost y demás). De las dos se ven las gráficas si tienen agente.
 */
export function ServerInventory({ initial }: { initial: Data }) {
  const t = useTranslations("admin");
  const [data, setData] = useState(initial);
  const [query, setQuery] = useState("");
  const [busyId, setBusyId] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [alta, setAlta] = useState(false);
  const [nuevo, setNuevo] = useState({ etiqueta: "", host: "", userId: "" });

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
        externos: json.externos ?? [],
        huerfanos: json.huerfanos,
        clientes: json.clientes,
        agentes: json.agentes ?? {},
      });
    } catch {
      setError(t("servidores.errorConnection"));
    } finally {
      setRefreshing(false);
    }
  }

  async function enviar(cuerpo: Record<string, unknown>, clave: string) {
    setError(null);
    setBusyId(clave);
    try {
      const res = await fetch("/api/admin/servidores", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(cuerpo),
      });
      const json = await res.json().catch(() => null);
      if (!res.ok || !json?.ok) {
        setError(json?.error ?? t("servidores.errorSave"));
        return null;
      }
      await reload(false);
      return json;
    } catch {
      setError(t("servidores.errorConnection"));
      return null;
    } finally {
      setBusyId(null);
    }
  }

  async function crearExterno(e: React.FormEvent) {
    e.preventDefault();
    if (!nuevo.etiqueta.trim()) return;
    const json = await enviar(
      { action: "crear-externo", ...nuevo, userId: nuevo.userId || null },
      "nuevo"
    );
    if (json) {
      setNuevo({ etiqueta: "", host: "", userId: "" });
      setAlta(false);
    }
  }

  const q = query.trim().toLowerCase();
  const coincide = (texto: string) => !q || texto.toLowerCase().includes(q);

  const items = data.items.filter((i) =>
    coincide(
      `${i.remote.name} ${i.remote.ipv4.join(" ")} ${i.remote.projectName ?? ""} ${
        i.cliente?.nombre ?? ""
      } ${i.cliente?.email ?? ""}`
    )
  );
  const externos = data.externos.filter((e) =>
    coincide(`${e.managed.etiqueta} ${e.managed.host} ${e.cliente?.nombre ?? ""} ${e.cliente?.email ?? ""}`)
  );

  const asignados = data.items.filter((i) => i.cliente).length;

  const campo =
    "min-h-11 w-full rounded-[var(--radius-md)] border border-[var(--color-line-strong)] bg-[var(--color-bg-base)] px-3 py-2 text-sm placeholder:text-[var(--color-fg-dim)] focus:border-[var(--color-accent)] focus:outline-none md:min-h-0";
  const boton =
    "inline-flex min-h-11 shrink-0 items-center rounded-[var(--radius-md)] border border-[var(--color-line-strong)] px-3 py-2 text-sm transition-colors hover:border-[var(--color-accent)] hover:text-[var(--color-accent)] disabled:opacity-50 md:min-h-0";

  return (
    <div className="grid gap-8">
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
            className={campo + " sm:w-64 sm:flex-none"}
          />
          <button type="button" onClick={() => reload(true)} disabled={refreshing} className={boton}>
            {refreshing ? t("servidores.refreshing") : t("servidores.refresh")}
          </button>
        </div>
      </div>

      {error && (
        <p role="alert" className="text-sm text-[var(--color-danger)]">
          {error}
        </p>
      )}

      {!data.configured ? (
        <p className="rounded-[var(--radius-lg)] border border-[var(--color-line)] bg-[var(--color-bg-raised)] p-6 text-sm text-[var(--color-fg-muted)]">
          {t("servidores.notConfigured")}
        </p>
      ) : items.length === 0 ? (
        <p className="text-sm text-[var(--color-fg-muted)]">
          {q ? t("servidores.noMatch") : t("servidores.none")}
        </p>
      ) : (
        <div className="rounded-[var(--radius-lg)] border border-[var(--color-line)] md:overflow-x-auto">
          <table className="table-cards w-full border-collapse text-sm md:min-w-[860px]">
            <thead>
              <tr className="border-b border-[var(--color-line)] text-left">
                <th className="px-4 py-3 mono-label text-[0.6rem]">{t("servidores.colServer")}</th>
                <th className="px-4 py-3 mono-label text-[0.6rem]">{t("servidores.colStatus")}</th>
                <th className="px-4 py-3 mono-label text-[0.6rem]">{t("servidores.colSpecs")}</th>
                <th className="px-4 py-3 mono-label text-[0.6rem]">{t("servidores.colMonitor")}</th>
                <th className="px-4 py-3 mono-label text-[0.6rem]">{t("servidores.colCustomer")}</th>
              </tr>
            </thead>
            <tbody>
              {items.map(({ remote, managed, cliente }) => (
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

                  <td data-label={t("servidores.colMonitor")} className="px-4 py-3">
                    <Monitor
                      managed={managed}
                      agente={managed ? data.agentes[managed.id] : undefined}
                      ocupado={busyId === `m${remote.id}`}
                      // Sin ficha no hay a qué colgar el agente: se crea una sin
                      // cliente asignado, que es exactamente lo que hace asignar.
                      onAlta={() => enviar({ remoteId: remote.id, userId: null }, `m${remote.id}`)}
                      t={t}
                    />
                  </td>

                  <td data-label={t("servidores.colCustomer")} className="px-4 py-3">
                    <select
                      value={cliente?.id ?? ""}
                      disabled={busyId === `c${remote.id}`}
                      onChange={(e) =>
                        enviar({ remoteId: remote.id, userId: e.target.value || null }, `c${remote.id}`)
                      }
                      className={campo + " md:max-w-[220px]"}
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

      {/* ------------------------------ Externos ----------------------------- */}
      <section>
        <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 className="text-lg font-semibold">
              {t("servidores.external.heading")}{" "}
              <span className="font-mono text-sm text-[var(--color-fg-muted)]">
                ({data.externos.length})
              </span>
            </h2>
            <p className="mt-0.5 text-xs text-[var(--color-fg-muted)]">
              {t("servidores.external.intro")}
            </p>
          </div>
          <button type="button" onClick={() => setAlta((v) => !v)} className={boton}>
            {alta ? t("servidores.external.cancel") : t("servidores.external.add")}
          </button>
        </div>

        {alta && (
          <form
            onSubmit={crearExterno}
            className="mb-4 grid gap-3 rounded-[var(--radius-lg)] border border-[var(--color-line)] bg-[var(--color-bg-raised)] p-5 sm:grid-cols-2 lg:grid-cols-4"
          >
            <label className="grid gap-1">
              <span className="mono-label text-[0.55rem]">{t("servidores.external.name")}</span>
              <input
                value={nuevo.etiqueta}
                onChange={(e) => setNuevo({ ...nuevo, etiqueta: e.target.value })}
                required
                maxLength={80}
                placeholder={t("servidores.external.namePlaceholder")}
                className={campo}
              />
            </label>
            <label className="grid gap-1">
              <span className="mono-label text-[0.55rem]">{t("servidores.external.host")}</span>
              <input
                value={nuevo.host}
                onChange={(e) => setNuevo({ ...nuevo, host: e.target.value })}
                maxLength={120}
                placeholder="203.0.113.10"
                className={campo}
              />
            </label>
            <label className="grid gap-1">
              <span className="mono-label text-[0.55rem]">{t("servidores.colCustomer")}</span>
              <select
                value={nuevo.userId}
                onChange={(e) => setNuevo({ ...nuevo, userId: e.target.value })}
                className={campo}
              >
                <option value="">{t("servidores.unassigned")}</option>
                {data.clientes.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.nombre} — {c.email}
                  </option>
                ))}
              </select>
            </label>
            <div className="flex items-end">
              <button type="submit" disabled={busyId === "nuevo"} className={boton + " w-full justify-center"}>
                {t("servidores.external.create")}
              </button>
            </div>
          </form>
        )}

        {externos.length === 0 ? (
          <p className="text-sm text-[var(--color-fg-muted)]">
            {q ? t("servidores.noMatch") : t("servidores.external.none")}
          </p>
        ) : (
          <ul className="grid gap-2">
            {externos.map(({ managed, cliente }) => {
              const agente = data.agentes[managed.id];
              return (
                <li
                  key={managed.id}
                  className="flex flex-wrap items-center justify-between gap-3 rounded-[var(--radius-lg)] border border-[var(--color-line)] bg-[var(--color-bg-raised)] p-4"
                >
                  <div className="min-w-0">
                    <Link
                      href={`/admin/servidores/${managed.id}`}
                      className="font-medium break-words hover:text-[var(--color-accent)]"
                    >
                      {managed.etiqueta}
                    </Link>
                    <p className="font-mono text-xs text-[var(--color-fg-muted)]">
                      {managed.host || "—"}
                      {agente?.hostname ? ` · ${agente.hostname}` : ""}
                    </p>
                    <p className="mt-0.5 text-xs text-[var(--color-fg-dim)]">
                      {cliente ? `${cliente.nombre} — ${cliente.email}` : t("servidores.unassigned")}
                    </p>
                  </div>
                  <Monitor
                    managed={managed}
                    agente={agente}
                    ocupado={false}
                    onAlta={() => undefined}
                    t={t}
                  />
                </li>
              );
            })}
          </ul>
        )}
      </section>

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
                  onClick={() => enviar({ action: "forget", remoteId: h.remoteId }, `o${h.remoteId}`)}
                  disabled={busyId === `o${h.remoteId}`}
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

/**
 * Celda de monitorización: el punto verde no dice "está encendido" sino "el
 * agente ha enviado algo hace poco", que es lo único que sabemos de una máquina
 * sin API detrás.
 */
function Monitor({
  managed,
  agente,
  ocupado,
  onAlta,
  t,
}: {
  managed: { id: string } | null;
  agente: AgentStatus | undefined;
  ocupado: boolean;
  onAlta: () => void;
  t: ReturnType<typeof useTranslations<"admin">>;
}) {
  if (!managed) {
    return (
      <button
        type="button"
        onClick={onAlta}
        disabled={ocupado}
        className="text-xs text-[var(--color-fg-muted)] underline-offset-2 transition-colors hover:text-[var(--color-accent)] hover:underline disabled:opacity-50"
      >
        {t("servidores.monitor.enable")}
      </button>
    );
  }

  return (
    <Link
      href={`/admin/servidores/${managed.id}`}
      className="group inline-flex flex-col gap-0.5 text-xs"
    >
      <span className="inline-flex items-center gap-1.5">
        <span
          aria-hidden="true"
          className={`inline-block size-1.5 rounded-full ${
            !agente?.activo
              ? "bg-[var(--color-fg-dim)]"
              : agente.vivo
                ? "bg-[var(--color-accent)]"
                : "bg-[var(--color-danger)]"
          }`}
        />
        <span className="text-[var(--color-fg-muted)] group-hover:text-[var(--color-accent)] group-hover:underline">
          {!agente?.activo
            ? t("servidores.monitor.noAgent")
            : agente.vivo
              ? t("servidores.monitor.live")
              : t("servidores.monitor.stale")}
        </span>
      </span>
      {agente?.vivo && (
        <span className="font-mono text-[0.65rem] text-[var(--color-fg-dim)]">
          {t("servidores.monitor.now", {
            cpu: agente.cpu !== null ? `${agente.cpu.toFixed(0)}%` : "—",
            ram: agente.memPct !== null ? `${agente.memPct.toFixed(0)}%` : "—",
          })}
        </span>
      )}
    </Link>
  );
}
