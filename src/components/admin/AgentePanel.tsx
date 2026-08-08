"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { useRouter } from "@/i18n/navigation";
import { site } from "@/data/site";

/**
 * Alta y baja del agente de métricas de un servidor.
 *
 * El token se enseña UNA vez, justo después de generarlo, y no vuelve a estar
 * disponible: en el disco solo queda su hash. Por eso la orden de instalación
 * completa aparece aquí montada y lista para copiar — si el admin cierra la
 * pantalla sin copiarla, la única salida es generar otro token, no recuperar
 * este.
 */
export function AgentePanel({
  id,
  activo,
  altaAt,
  esExterno,
}: {
  id: string;
  activo: boolean;
  altaAt: string | null;
  esExterno: boolean;
}) {
  const t = useTranslations("admin");
  const router = useRouter();
  const [token, setToken] = useState<string | null>(null);
  const [ocupado, setOcupado] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [copiado, setCopiado] = useState<string | null>(null);

  const orden = token
    ? `curl -fsSL ${site.url}/agente.sh -o viahost-agent.sh\nsudo sh viahost-agent.sh --token ${token}`
    : "";

  async function accion(action: string, extra: Record<string, unknown> = {}) {
    setError(null);
    setOcupado(true);
    try {
      const res = await fetch("/api/admin/servidores", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ action, id, ...extra }),
      });
      const json = await res.json().catch(() => null);
      if (!res.ok || !json?.ok) {
        setError(json?.error ?? t("servidores.errorSave"));
        return null;
      }
      return json;
    } catch {
      setError(t("servidores.errorConnection"));
      return null;
    } finally {
      setOcupado(false);
    }
  }

  async function generar() {
    const json = await accion("token");
    if (json?.token) {
      setToken(json.token as string);
      router.refresh();
    }
  }

  async function revocar() {
    if (!confirm(t("servidores.agente.revokeConfirm"))) return;
    if (await accion("revocar-token")) {
      setToken(null);
      router.refresh();
    }
  }

  async function borrar() {
    if (!confirm(t("servidores.agente.deleteConfirm"))) return;
    if (await accion("borrar")) router.push("/admin/servidores");
  }

  async function copiar(texto: string, cual: string) {
    try {
      await navigator.clipboard.writeText(texto);
      setCopiado(cual);
      setTimeout(() => setCopiado(null), 2000);
    } catch {
      setError(t("servidores.agente.copyError"));
    }
  }

  const boton =
    "inline-flex min-h-11 items-center rounded-[var(--radius-sm)] border border-[var(--color-line-strong)] px-3 py-2 text-xs transition-colors hover:border-[var(--color-accent)] hover:text-[var(--color-accent)] disabled:opacity-50 md:min-h-0 md:px-2.5 md:py-1";

  return (
    <section className="rounded-[var(--radius-lg)] border border-[var(--color-line)] bg-[var(--color-bg-raised)] p-5 md:p-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="text-sm font-semibold">{t("servidores.agente.heading")}</h2>
          <p className="mt-1 text-xs text-[var(--color-fg-muted)]">
            {activo
              ? t("servidores.agente.statusActive", {
                  fecha: altaAt ? new Date(altaAt).toLocaleDateString() : "—",
                })
              : t("servidores.agente.statusNone")}
          </p>
        </div>
        <div className="flex flex-wrap gap-1.5">
          <button type="button" onClick={generar} disabled={ocupado} className={boton}>
            {activo ? t("servidores.agente.regenerate") : t("servidores.agente.generate")}
          </button>
          {activo && (
            <button
              type="button"
              onClick={revocar}
              disabled={ocupado}
              className={boton + " text-[var(--color-fg-muted)] hover:border-[var(--color-danger)] hover:text-[var(--color-danger)]"}
            >
              {t("servidores.agente.revoke")}
            </button>
          )}
        </div>
      </div>

      {error && (
        <p role="alert" className="mt-3 text-xs text-[var(--color-danger)]">
          {error}
        </p>
      )}

      {token && (
        <div className="mt-5 border-t border-[var(--color-line)] pt-4">
          <p className="text-xs text-amber-300">{t("servidores.agente.once")}</p>

          <h3 className="mono-label mt-4 text-[0.55rem]">{t("servidores.agente.commandLabel")}</h3>
          <pre className="mt-1.5 overflow-x-auto rounded-[var(--radius-sm)] border border-[var(--color-line)] bg-[var(--color-bg-base)] p-3 font-mono text-[0.7rem] leading-relaxed text-[var(--color-fg)]">
            {orden}
          </pre>
          <div className="mt-2 flex flex-wrap gap-1.5">
            <button type="button" onClick={() => copiar(orden, "orden")} className={boton}>
              {copiado === "orden" ? t("servidores.agente.copied") : t("servidores.agente.copyCommand")}
            </button>
            <button type="button" onClick={() => copiar(token, "token")} className={boton}>
              {copiado === "token" ? t("servidores.agente.copied") : t("servidores.agente.copyToken")}
            </button>
          </div>

          <p className="mt-3 text-xs whitespace-pre-line text-[var(--color-fg-muted)]">
            {t("servidores.agente.help")}
          </p>
        </div>
      )}

      {esExterno && (
        <div className="mt-5 border-t border-[var(--color-line)] pt-4">
          <button
            type="button"
            onClick={borrar}
            disabled={ocupado}
            className="text-xs text-[var(--color-fg-muted)] transition-colors hover:text-[var(--color-danger)] disabled:opacity-50"
          >
            {t("servidores.agente.deleteExternal")}
          </button>
        </div>
      )}
    </section>
  );
}
