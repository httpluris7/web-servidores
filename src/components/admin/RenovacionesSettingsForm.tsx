"use client";

import { useState } from "react";

export type RenovacionesPublicSettings = { enabled: boolean; diasAviso: number };

type Vencimiento = {
  servidorId: string;
  remoteId: number;
  userId: string | null;
  etiqueta: string;
  periodoHasta: string | null;
  origen: "renovacion" | "alta" | "ficha";
  pendiente: { invoiceId: string; importe: number; periodoHasta: string } | null;
  emitiriaHoy: boolean;
};

/**
 * Renovaciones mensuales de VPS. Interno del panel: textos en español fijo.
 * Apagado por defecto; la vista previa muestra los vencimientos calculados y
 * qué proformas se emitirían en el próximo barrido, para revisarlo antes de
 * encender el interruptor.
 */
export function RenovacionesSettingsForm({ initial }: { initial: RenovacionesPublicSettings }) {
  const [settings, setSettings] = useState(initial);
  const [dias, setDias] = useState(String(initial.diasAviso));
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [vista, setVista] = useState<Vencimiento[] | null>(null);

  async function save(patch: Record<string, unknown>) {
    setError(null);
    setNotice(null);
    setBusy(true);
    try {
      const res = await fetch("/api/admin/ajustes", {
        method: "PUT",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ section: "renovaciones", ...patch }),
      });
      const data = await res.json().catch(() => null);
      if (!res.ok || !data?.ok) {
        setError(data?.error ?? "No se pudo guardar.");
        return;
      }
      setSettings(data.renovaciones);
      setDias(String(data.renovaciones.diasAviso));
      setNotice("Guardado.");
    } catch {
      setError("Error de conexión.");
    } finally {
      setBusy(false);
    }
  }

  async function previsualizar() {
    setError(null);
    setNotice(null);
    setBusy(true);
    try {
      const res = await fetch("/api/admin/ajustes?target=renovaciones", { method: "POST" });
      const data = await res.json().catch(() => null);
      if (!res.ok || !data?.ok) {
        setError(data?.error ?? "No se pudo calcular la vista previa.");
        return;
      }
      setVista(data.vencimientos as Vencimiento[]);
    } catch {
      setError("Error de conexión.");
    } finally {
      setBusy(false);
    }
  }

  async function barrer() {
    if (!confirm("Se emitirán ahora las proformas de renovación que toquen (y se enviarán por correo a los clientes). ¿Continuar?")) return;
    setError(null);
    setNotice(null);
    setBusy(true);
    try {
      const res = await fetch("/api/admin/ajustes?target=renovaciones-barrido", { method: "POST" });
      const data = await res.json().catch(() => null);
      if (!res.ok || !data?.ok) {
        setError(data?.error ?? "El barrido falló.");
        return;
      }
      setNotice(`Barrido ejecutado: ${data.emitidas} proforma(s) emitida(s).`);
      await previsualizar();
    } catch {
      setError("Error de conexión.");
    } finally {
      setBusy(false);
    }
  }

  const fecha = (iso: string | null) => (iso ? new Date(iso).toLocaleDateString("es-ES", { dateStyle: "medium" }) : "—");
  const ORIGEN: Record<Vencimiento["origen"], string> = { renovacion: "última renovación pagada", alta: "pago del alta + 1 mes", ficha: "fecha de la ficha + 1 mes" };

  return (
    <section className="rounded-[var(--radius-lg)] border border-[var(--color-line)] bg-[var(--color-bg-raised)] p-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h2 className="text-lg font-semibold">Renovaciones mensuales de VPS</h2>
          <p className="mt-1 max-w-2xl text-sm text-[var(--color-fg-muted)]">
            Cada VPS cubre un mes desde el pago de su alta; cada renovación pagada añade otro mes al fin de
            periodo. Los días indicados antes de vencer se emite al cliente una proforma de renovación al
            precio actual del plan (transferencia, PDF por correo). No hay suspensión automática por impago.
          </p>
        </div>
        <span
          className={
            "rounded-full border px-3 py-1 font-mono text-xs " +
            (settings.enabled
              ? "border-[var(--color-accent)]/40 bg-[var(--color-accent)]/10 text-[var(--color-accent)]"
              : "border-[var(--color-line-strong)] text-[var(--color-fg-muted)]")
          }
        >
          {settings.enabled ? "Activo" : "Inactivo"}
        </span>
      </div>

      <div className="mt-5 flex flex-wrap items-end gap-6">
        <label className="flex items-center gap-3 text-sm">
          <input
            type="checkbox"
            checked={settings.enabled}
            disabled={busy}
            onChange={(e) => save({ enabled: e.target.checked })}
            className="h-4 w-4 accent-[var(--color-accent)]"
          />
          Emitir proformas de renovación automáticamente (1 barrido al día)
        </label>
        <div className="flex items-end gap-3">
          <div>
            <label htmlFor="renov-dias" className="mono-label block text-[0.6rem]">Días de aviso</label>
            <input
              id="renov-dias"
              type="number"
              min={1}
              max={30}
              value={dias}
              onChange={(e) => setDias(e.target.value)}
              className="mt-1 w-24 rounded-[var(--radius-md)] border border-[var(--color-line-strong)] bg-[var(--color-bg-base)] px-3 py-2 text-sm focus:border-[var(--color-accent)] focus:outline-none"
            />
          </div>
          <button
            type="button"
            disabled={busy || Number(dias) === settings.diasAviso}
            onClick={() => save({ diasAviso: Number(dias) })}
            className="rounded-[var(--radius-md)] border border-[var(--color-line-strong)] px-4 py-2 text-sm transition-colors hover:bg-white/5 disabled:opacity-40"
          >
            Guardar días
          </button>
          <button
            type="button"
            disabled={busy}
            onClick={previsualizar}
            className="rounded-[var(--radius-md)] border border-[var(--color-line-strong)] px-4 py-2 text-sm transition-colors hover:bg-white/5 disabled:opacity-40"
          >
            Vista previa de vencimientos
          </button>
          <button
            type="button"
            disabled={busy}
            onClick={barrer}
            className="rounded-[var(--radius-md)] border border-[var(--color-accent)]/50 px-4 py-2 text-sm text-[var(--color-accent)] transition-colors hover:bg-[var(--color-accent)]/10 disabled:opacity-40"
          >
            Emitir renovaciones ahora
          </button>
        </div>
      </div>

      {error && <p role="alert" className="mt-4 text-sm text-[var(--color-danger)]">{error}</p>}
      {notice && <p role="status" className="mt-4 text-sm text-[var(--color-accent)]">{notice}</p>}

      {vista && (
        <div className="mt-5 overflow-x-auto">
          {vista.length === 0 ? (
            <p className="text-sm text-[var(--color-fg-muted)]">No hay VPS con cliente.</p>
          ) : (
            <table className="w-full text-sm">
              <thead className="mono-label text-left text-[0.6rem]">
                <tr>
                  <th className="py-2 pr-4">VPS</th>
                  <th className="py-2 pr-4">Fin de periodo</th>
                  <th className="py-2 pr-4">Base del cálculo</th>
                  <th className="py-2 pr-4">Renovación pendiente</th>
                  <th className="py-2">Se emitiría hoy</th>
                </tr>
              </thead>
              <tbody>
                {vista.map((v) => (
                  <tr key={v.servidorId} className="border-t border-[var(--color-line)]">
                    <td className="py-2 pr-4 font-mono text-xs">#{v.remoteId} {v.etiqueta || ""}</td>
                    <td className="py-2 pr-4">{fecha(v.periodoHasta)}</td>
                    <td className="py-2 pr-4 text-[var(--color-fg-muted)]">{ORIGEN[v.origen]}</td>
                    <td className="py-2 pr-4">{v.pendiente ? `${v.pendiente.importe.toFixed(2)} € hasta ${fecha(v.pendiente.periodoHasta)}` : "—"}</td>
                    <td className={"py-2 " + (v.emitiriaHoy ? "text-[var(--color-accent)]" : "text-[var(--color-fg-dim)]")}>{v.emitiriaHoy ? "Sí" : "No"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      )}
    </section>
  );
}
