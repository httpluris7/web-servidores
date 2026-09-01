"use client";

import { useState } from "react";
import { Label, Input } from "@/components/forms/Field";

/**
 * Configuración de la conciliación de transferencias por Wise.
 *
 * Interno del panel: los textos van en español fijo (como el módulo de copias),
 * no por `messages/`. Los SECRETOS (token de API y clave privada RSA) nunca
 * viajan al navegador: del servidor solo llega su versión enmascarada, así que
 * los campos nacen vacíos y dejarlos así = "conserva lo que ya hay"; el botón de
 * borrado manda `null` explícito. El perfil y el balance no son secretos y se
 * precargan.
 */
export type WisePublicSettings = {
  enabled: boolean;
  sandbox: boolean;
  profileId: string;
  balanceId: string;
  hasApiToken: boolean;
  apiTokenMask: string;
  hasPrivateKey: boolean;
};

export function WiseSettingsForm({ initial }: { initial: WisePublicSettings }) {
  const [settings, setSettings] = useState(initial);
  const [apiToken, setApiToken] = useState("");
  const [privateKey, setPrivateKey] = useState("");
  const [profileId, setProfileId] = useState(initial.profileId);
  const [balanceId, setBalanceId] = useState(initial.balanceId);
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
        body: JSON.stringify({ section: "wise", ...patch }),
      });
      const data = await res.json().catch(() => null);
      if (!res.ok || !data?.ok) {
        setError(data?.error ?? "No se pudo guardar.");
        return;
      }
      setSettings(data.wise);
      setProfileId(data.wise.profileId);
      setBalanceId(data.wise.balanceId);
      setApiToken("");
      setPrivateKey("");
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
      const res = await fetch("/api/admin/ajustes?target=wise", { method: "POST" });
      const data = await res.json().catch(() => null);
      if (!res.ok || !data?.ok) {
        setError(data?.error ?? "La prueba falló.");
        return;
      }
      setNotice(
        `Conexión correcta (${data.mode}). Movimientos en las últimas 24 h: ${data.transactions}.`
      );
    } catch {
      setError("Error de conexión.");
    } finally {
      setStatus("idle");
    }
  }

  const busy = status !== "idle";
  const activo = settings.enabled && settings.hasApiToken && settings.hasPrivateKey && !!settings.profileId && !!settings.balanceId;
  const idsCambiados = profileId.trim() !== settings.profileId || balanceId.trim() !== settings.balanceId;
  const haySecretoNuevo = !!apiToken || !!privateKey;

  return (
    <div className="grid gap-8">
      {/* Estado */}
      <section className="rounded-[var(--radius-lg)] border border-[var(--color-line)] bg-[var(--color-bg-raised)] p-6">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <h2 className="text-lg font-semibold">Transferencias por Wise</h2>
            <p className="mt-1 max-w-2xl text-sm text-[var(--color-fg-muted)]">
              Sondea cada 5 min los ingresos del balance en EUR y, cuando llega una
              transferencia cuya referencia coincide con una proforma pendiente (p. ej.{" "}
              <span className="font-mono">VH00016</span>), la marca pagada y entrega el VPS —el
              mismo camino que un pago con tarjeta.
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

        <p className="mt-4 font-mono text-xs text-[var(--color-fg-muted)]">
          Entorno:{" "}
          <span className={settings.sandbox ? "text-[var(--color-fg)]" : "text-[var(--color-danger)]"}>
            {settings.sandbox ? "sandbox (pruebas)" : "producción (dinero real)"}
          </span>
        </p>

        <label className="mt-5 flex items-center gap-3 text-sm">
          <input
            type="checkbox"
            checked={settings.enabled}
            disabled={busy}
            onChange={(e) => save({ enabled: e.target.checked })}
            className="h-4 w-4 accent-[var(--color-accent)]"
          />
          Sondear Wise automáticamente cada 5 minutos
        </label>

        <label className="mt-3 flex items-center gap-3 text-sm">
          <input
            type="checkbox"
            checked={settings.sandbox}
            disabled={busy}
            onChange={(e) => save({ sandbox: e.target.checked })}
            className="h-4 w-4 accent-[var(--color-accent)]"
          />
          Usar el entorno sandbox de Wise (pruebas, sin mover dinero real)
        </label>
      </section>

      {/* Credenciales */}
      <section className="rounded-[var(--radius-lg)] border border-[var(--color-line)] bg-[var(--color-bg-raised)] p-6">
        <h2 className="text-lg font-semibold">Credenciales</h2>
        <p className="mt-1 mb-5 max-w-2xl text-sm text-[var(--color-fg-muted)]">
          Token de API de Wise y la clave privada RSA que firma el reto SCA (su clave pública se
          sube en Wise → Settings → API tokens → Manage public keys). El perfil y el balance EUR
          son los ids numéricos de tu cuenta de negocio.
        </p>

        <div className="grid gap-5">
          <div className="grid gap-5 sm:grid-cols-2">
            <div>
              <Label htmlFor="wiseProfile">Profile ID</Label>
              <Input
                id="wiseProfile"
                inputMode="numeric"
                autoComplete="off"
                spellCheck={false}
                value={profileId}
                onChange={(e) => setProfileId(e.target.value)}
                placeholder="12345678"
              />
            </div>
            <div>
              <Label htmlFor="wiseBalance">Balance ID (EUR)</Label>
              <Input
                id="wiseBalance"
                inputMode="numeric"
                autoComplete="off"
                spellCheck={false}
                value={balanceId}
                onChange={(e) => setBalanceId(e.target.value)}
                placeholder="87654321"
              />
            </div>
          </div>

          <div>
            <Label htmlFor="wiseToken">Token de API</Label>
            <Input
              id="wiseToken"
              type="password"
              autoComplete="off"
              spellCheck={false}
              value={apiToken}
              onChange={(e) => setApiToken(e.target.value)}
              placeholder={settings.hasApiToken ? settings.apiTokenMask : "token de API de Wise"}
            />
            <p className="mt-1.5 text-xs text-[var(--color-fg-dim)]">
              {settings.hasApiToken ? "Déjalo en blanco para conservar el guardado." : "Basta un token de lectura."}
            </p>
          </div>

          <div>
            <Label htmlFor="wiseKey">Clave privada RSA (PEM)</Label>
            <textarea
              id="wiseKey"
              autoComplete="off"
              spellCheck={false}
              rows={4}
              value={privateKey}
              onChange={(e) => setPrivateKey(e.target.value)}
              placeholder={
                settings.hasPrivateKey
                  ? "•••••  (hay una clave guardada; pega una nueva para reemplazarla)"
                  : "-----BEGIN PRIVATE KEY-----\n…\n-----END PRIVATE KEY-----"
              }
              className="mt-1.5 w-full rounded-[var(--radius-md)] border border-[var(--color-line-strong)] bg-[var(--color-bg-base)] px-3 py-2 font-mono text-xs outline-none focus:border-[var(--color-accent)]"
            />
            <p className="mt-1.5 text-xs text-[var(--color-fg-dim)]">
              {settings.hasPrivateKey ? "Déjalo en blanco para conservar la guardada." : "Necesaria para el reto SCA de lectura de movimientos."}
            </p>
          </div>
        </div>

        <div className="mt-6 flex flex-wrap items-center gap-3">
          <button
            type="button"
            disabled={busy || (!haySecretoNuevo && !idsCambiados)}
            onClick={() =>
              save({
                profileId: profileId.trim(),
                balanceId: balanceId.trim(),
                apiToken: apiToken || undefined,
                privateKey: privateKey || undefined,
              })
            }
            className="inline-flex items-center justify-center rounded-[var(--radius-md)] bg-[var(--color-accent)] px-5 py-2.5 text-sm font-medium text-black transition-colors hover:bg-[var(--color-accent-dim)] disabled:opacity-50"
          >
            {status === "saving" ? "Guardando…" : "Guardar"}
          </button>

          <button
            type="button"
            disabled={busy || !settings.hasApiToken || !settings.hasPrivateKey || !settings.profileId || !settings.balanceId}
            onClick={test}
            className="inline-flex items-center justify-center rounded-[var(--radius-md)] border border-[var(--color-line-strong)] px-5 py-2.5 text-sm transition-colors hover:border-[var(--color-accent)] disabled:opacity-50"
          >
            {status === "testing" ? "Probando…" : "Probar conexión"}
          </button>

          {(settings.hasApiToken || settings.hasPrivateKey) && (
            <button
              type="button"
              disabled={busy}
              onClick={() => save({ apiToken: null, privateKey: null, enabled: false })}
              className="text-sm text-[var(--color-fg-muted)] transition-colors hover:text-[var(--color-danger)] disabled:opacity-50"
            >
              Borrar credenciales
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
