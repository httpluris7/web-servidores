"use client";

import { useState } from "react";
import { Label, Input } from "@/components/forms/Field";

/**
 * Configuración del hosting web (WHM/cPanel del nodo web01). Interno del panel:
 * textos en español fijo. El TOKEN es secreto: del servidor solo llega su
 * versión enmascarada, así que el campo nace vacío (dejarlo así = conservar); el
 * botón de borrado manda `null`. El host y el dominio base no son secretos y se
 * precargan.
 */
export type HostingPublicSettings = {
  enabled: boolean;
  whmHost: string;
  baseDomain: string;
  hasToken: boolean;
  tokenMask: string;
};

export function HostingSettingsForm({ initial }: { initial: HostingPublicSettings }) {
  const [settings, setSettings] = useState(initial);
  const [whmToken, setWhmToken] = useState("");
  const [whmHost, setWhmHost] = useState(initial.whmHost);
  const [baseDomain, setBaseDomain] = useState(initial.baseDomain);
  const [status, setStatus] = useState<"idle" | "saving" | "testing">("idle");
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  async function save(patch: Record<string, unknown>) {
    setError(null);
    setNotice(null);
    setStatus("saving");
    try {
      const res = await fetch("/api/admin/ajustes", {
        method: "PUT",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ section: "hosting", ...patch }),
      });
      const data = await res.json().catch(() => null);
      if (!res.ok || !data?.ok) {
        setError(data?.error ?? "No se pudo guardar.");
        return;
      }
      setSettings(data.hosting);
      setWhmHost(data.hosting.whmHost);
      setBaseDomain(data.hosting.baseDomain);
      setWhmToken("");
      setNotice(data.warning ?? "Guardado.");
    } catch {
      setError("Error de conexión.");
    } finally {
      setStatus("idle");
    }
  }

  async function test() {
    setError(null);
    setNotice(null);
    setStatus("testing");
    try {
      const res = await fetch("/api/admin/ajustes?target=hosting", { method: "POST" });
      const data = await res.json().catch(() => null);
      if (!res.ok || !data?.ok) {
        setError(data?.error ?? "La prueba falló.");
        return;
      }
      setNotice(`Conexión con WHM correcta. Cuentas en el nodo: ${data.accounts}.`);
    } catch {
      setError("Error de conexión.");
    } finally {
      setStatus("idle");
    }
  }

  const busy = status !== "idle";
  const activo = settings.enabled && settings.hasToken;
  const cambiosNoSecretos =
    whmHost.trim() !== settings.whmHost || baseDomain.trim() !== settings.baseDomain;
  const haySecretoNuevo = !!whmToken;

  return (
    <div className="grid gap-8">
      <section className="rounded-[var(--radius-lg)] border border-[var(--color-line)] bg-[var(--color-bg-raised)] p-6">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <h2 className="text-lg font-semibold">Hosting web (cPanel / WHM)</h2>
            <p className="mt-1 max-w-2xl text-sm text-[var(--color-fg-muted)]">
              Alta automática de cuentas de cPanel en el nodo web01 al pagar la proforma. La cuenta
              se crea con un dominio temporal (<span className="font-mono">&lt;usuario&gt;.{settings.baseDomain}</span>)
              y las credenciales se envían al cliente por correo. Usa un{" "}
              <span className="font-mono">API token de root</span> con ACL acotada (create-acct,
              list-accts, passwd).
            </p>
          </div>
          <span
            className={
              "rounded-full border px-3 py-1 font-mono text-xs " +
              (activo
                ? "border-[var(--color-accent)]/40 bg-[var(--color-accent)]/10 text-[var(--color-accent)]"
                : "border-[var(--color-line-strong)] text-[var(--color-fg-muted)]")
            }
          >
            {activo ? "Activo" : "Inactivo"}
          </span>
        </div>

        <label className="mt-5 flex items-center gap-3 text-sm">
          <input
            type="checkbox"
            checked={settings.enabled}
            disabled={busy}
            onChange={(e) => save({ enabled: e.target.checked })}
            className="h-4 w-4 accent-[var(--color-accent)]"
          />
          Crear cuentas de cPanel automáticamente al pagar
        </label>
      </section>

      <section className="rounded-[var(--radius-lg)] border border-[var(--color-line)] bg-[var(--color-bg-raised)] p-6">
        <h2 className="text-lg font-semibold">Nodo y credenciales</h2>
        <p className="mt-1 mb-5 max-w-2xl text-sm text-[var(--color-fg-muted)]">
          El host es el hostname del WHM (por nombre, no por IP, para que valide el certificado). El
          dominio base es el sufijo del dominio temporal de cada cuenta.
        </p>

        <div className="grid gap-5">
          <div className="grid gap-5 sm:grid-cols-2">
            <div>
              <Label htmlFor="whmHost">Host del WHM</Label>
              <Input
                id="whmHost"
                autoComplete="off"
                spellCheck={false}
                value={whmHost}
                onChange={(e) => setWhmHost(e.target.value)}
                placeholder="web01.viahost.top"
              />
              <p className="mt-1.5 text-xs text-[var(--color-fg-dim)]">Se conecta a este host por HTTPS :2087.</p>
            </div>
            <div>
              <Label htmlFor="baseDomain">Dominio base (temporal)</Label>
              <Input
                id="baseDomain"
                autoComplete="off"
                spellCheck={false}
                value={baseDomain}
                onChange={(e) => setBaseDomain(e.target.value)}
                placeholder="web01.viahost.top"
              />
              <p className="mt-1.5 text-xs text-[var(--color-fg-dim)]">
                Cada cuenta nace como <span className="font-mono">&lt;usuario&gt;.{baseDomain || "…"}</span>.
              </p>
            </div>
          </div>

          <div>
            <Label htmlFor="whmToken">API token de root (WHM)</Label>
            <Input
              id="whmToken"
              type="password"
              autoComplete="off"
              spellCheck={false}
              value={whmToken}
              onChange={(e) => setWhmToken(e.target.value)}
              placeholder={settings.hasToken ? settings.tokenMask : "whmapi1 api_token_create"}
            />
            <p className="mt-1.5 text-xs text-[var(--color-fg-dim)]">
              {settings.hasToken
                ? "Déjalo en blanco para conservar el guardado."
                : "Token de root del WHM con ACL create-acct, list-accts y passwd."}
            </p>
          </div>
        </div>

        <div className="mt-6 flex flex-wrap items-center gap-3">
          <button
            type="button"
            disabled={busy || (!haySecretoNuevo && !cambiosNoSecretos)}
            onClick={() =>
              save({
                whmHost: whmHost.trim() || undefined,
                baseDomain: baseDomain.trim() || undefined,
                whmToken: whmToken || undefined,
              })
            }
            className="inline-flex items-center justify-center rounded-[var(--radius-md)] bg-[var(--color-accent)] px-5 py-2.5 text-sm font-medium text-black transition-colors hover:bg-[var(--color-accent-dim)] disabled:opacity-50"
          >
            {status === "saving" ? "Guardando…" : "Guardar"}
          </button>

          <button
            type="button"
            disabled={busy || !settings.hasToken}
            onClick={test}
            className="inline-flex items-center justify-center rounded-[var(--radius-md)] border border-[var(--color-line-strong)] px-5 py-2.5 text-sm transition-colors hover:border-[var(--color-accent)] disabled:opacity-50"
          >
            {status === "testing" ? "Probando…" : "Probar conexión"}
          </button>

          {settings.hasToken && (
            <button
              type="button"
              disabled={busy}
              onClick={() => save({ whmToken: null, enabled: false })}
              className="text-sm text-[var(--color-fg-muted)] transition-colors hover:text-[var(--color-danger)] disabled:opacity-50"
            >
              Borrar token
            </button>
          )}
        </div>

        {error && (
          <p role="alert" className="mt-4 text-sm text-[var(--color-danger)]">
            {error}
          </p>
        )}
        {notice && <p className="mt-4 text-sm text-[var(--color-accent)]">{notice}</p>}
      </section>
    </div>
  );
}
