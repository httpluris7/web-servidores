"use client";

import { useState } from "react";
import { Label, Input } from "@/components/forms/Field";

/**
 * Configuración del registrador de dominios (Njalla). Interno del panel: textos
 * en español fijo. Los TOKENS son secretos: del servidor solo llega su versión
 * enmascarada, así que los campos nacen vacíos (dejarlos así = conservar); el
 * botón de borrado manda `null`. El margen y el saldo mínimo no son secretos y se
 * precargan.
 */
export type NjallaPublicSettings = {
  enabled: boolean;
  margenPct: number;
  saldoMinimo: number;
  hasApiToken: boolean;
  apiTokenMask: string;
  hasRegisterToken: boolean;
  registerTokenMask: string;
};

export function NjallaSettingsForm({ initial }: { initial: NjallaPublicSettings }) {
  const [settings, setSettings] = useState(initial);
  const [apiToken, setApiToken] = useState("");
  const [registerToken, setRegisterToken] = useState("");
  const [margen, setMargen] = useState(String(initial.margenPct));
  const [saldoMin, setSaldoMin] = useState(String(initial.saldoMinimo));
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
        body: JSON.stringify({ section: "njalla", ...patch }),
      });
      const data = await res.json().catch(() => null);
      if (!res.ok || !data?.ok) {
        setError(data?.error ?? "No se pudo guardar.");
        return;
      }
      setSettings(data.njalla);
      setMargen(String(data.njalla.margenPct));
      setSaldoMin(String(data.njalla.saldoMinimo));
      setApiToken("");
      setRegisterToken("");
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
      const res = await fetch("/api/admin/ajustes?target=njalla", { method: "POST" });
      const data = await res.json().catch(() => null);
      if (!res.ok || !data?.ok) {
        setError(data?.error ?? "La prueba falló.");
        return;
      }
      setNotice(`Conexión correcta. Saldo del monedero: ${data.balance} €.`);
    } catch {
      setError("Error de conexión.");
    } finally {
      setStatus("idle");
    }
  }

  const busy = status !== "idle";
  const activo = settings.enabled && settings.hasApiToken;
  const cambiosNoSecretos =
    margen.trim() !== String(settings.margenPct) || saldoMin.trim() !== String(settings.saldoMinimo);
  const haySecretoNuevo = !!apiToken || !!registerToken;

  return (
    <div className="grid gap-8">
      <section className="rounded-[var(--radius-lg)] border border-[var(--color-line)] bg-[var(--color-bg-raised)] p-6">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <h2 className="text-lg font-semibold">Dominios (Njalla)</h2>
            <p className="mt-1 max-w-2xl text-sm text-[var(--color-fg-muted)]">
              Reventa de dominios con privacidad. Búsqueda con precios (margen aplicado), registro
              automático al pagar la proforma, editor de DNS en el área de cliente y aviso de saldo
              bajo del monedero. Njalla acota los tokens por método y dominio: usa un token{" "}
              <span className="font-mono">sin restricciones</span> (o dos: lectura/DNS y registro).
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
          Vender y gestionar dominios (búsqueda, registro, DNS, renovaciones)
        </label>
      </section>

      <section className="rounded-[var(--radius-lg)] border border-[var(--color-line)] bg-[var(--color-bg-raised)] p-6">
        <h2 className="text-lg font-semibold">Tokens y parámetros</h2>
        <p className="mt-1 mb-5 max-w-2xl text-sm text-[var(--color-fg-muted)]">
          El token de lectura/DNS es imprescindible (búsqueda, DNS, saldo). El de registro permite
          registrar/renovar (mueve dinero del monedero); si usas un token sin restricciones, pon el
          mismo en los dos.
        </p>

        <div className="grid gap-5">
          <div className="grid gap-5 sm:grid-cols-2">
            <div>
              <Label htmlFor="njMargen">Margen sobre Njalla (%)</Label>
              <Input
                id="njMargen"
                inputMode="numeric"
                autoComplete="off"
                spellCheck={false}
                value={margen}
                onChange={(e) => setMargen(e.target.value)}
                placeholder="25"
              />
              <p className="mt-1.5 text-xs text-[var(--color-fg-dim)]">
                Precio al cliente = coste Njalla × (1 + margen/100), redondeo al alza.
              </p>
            </div>
            <div>
              <Label htmlFor="njSaldo">Aviso de saldo bajo (€)</Label>
              <Input
                id="njSaldo"
                inputMode="numeric"
                autoComplete="off"
                spellCheck={false}
                value={saldoMin}
                onChange={(e) => setSaldoMin(e.target.value)}
                placeholder="50"
              />
              <p className="mt-1.5 text-xs text-[var(--color-fg-dim)]">
                Si el monedero baja de este saldo, se avisa al admin.
              </p>
            </div>
          </div>

          <div>
            <Label htmlFor="njToken">Token de lectura / DNS</Label>
            <Input
              id="njToken"
              type="password"
              autoComplete="off"
              spellCheck={false}
              value={apiToken}
              onChange={(e) => setApiToken(e.target.value)}
              placeholder={settings.hasApiToken ? settings.apiTokenMask : "token de API de Njalla"}
            />
            <p className="mt-1.5 text-xs text-[var(--color-fg-dim)]">
              {settings.hasApiToken ? "Déjalo en blanco para conservar el guardado." : "Búsqueda, DNS y saldo."}
            </p>
          </div>

          <div>
            <Label htmlFor="njReg">Token de registro / renovación</Label>
            <Input
              id="njReg"
              type="password"
              autoComplete="off"
              spellCheck={false}
              value={registerToken}
              onChange={(e) => setRegisterToken(e.target.value)}
              placeholder={settings.hasRegisterToken ? settings.registerTokenMask : "token con permiso de registro"}
            />
            <p className="mt-1.5 text-xs text-[var(--color-fg-dim)]">
              {settings.hasRegisterToken
                ? "Déjalo en blanco para conservar el guardado."
                : "Sin este token, la búsqueda y el DNS funcionan, pero no se registran dominios."}
            </p>
          </div>
        </div>

        <div className="mt-6 flex flex-wrap items-center gap-3">
          <button
            type="button"
            disabled={busy || (!haySecretoNuevo && !cambiosNoSecretos)}
            onClick={() =>
              save({
                margenPct: Number(margen) || 0,
                saldoMinimo: Number(saldoMin) || 0,
                apiToken: apiToken || undefined,
                registerToken: registerToken || undefined,
              })
            }
            className="inline-flex items-center justify-center rounded-[var(--radius-md)] bg-[var(--color-accent)] px-5 py-2.5 text-sm font-medium text-black transition-colors hover:bg-[var(--color-accent-dim)] disabled:opacity-50"
          >
            {status === "saving" ? "Guardando…" : "Guardar"}
          </button>

          <button
            type="button"
            disabled={busy || !settings.hasApiToken}
            onClick={test}
            className="inline-flex items-center justify-center rounded-[var(--radius-md)] border border-[var(--color-line-strong)] px-5 py-2.5 text-sm transition-colors hover:border-[var(--color-accent)] disabled:opacity-50"
          >
            {status === "testing" ? "Probando…" : "Probar (ver saldo)"}
          </button>

          {(settings.hasApiToken || settings.hasRegisterToken) && (
            <button
              type="button"
              disabled={busy}
              onClick={() => save({ apiToken: null, registerToken: null, enabled: false })}
              className="text-sm text-[var(--color-fg-muted)] transition-colors hover:text-[var(--color-danger)] disabled:opacity-50"
            >
              Borrar tokens
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
