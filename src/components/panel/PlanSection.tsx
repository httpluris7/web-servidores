"use client";

import { useCallback, useEffect, useState } from "react";
import { useTranslations } from "next-intl";
import { Link } from "@/i18n/navigation";
import { CARD, SECTION_INDEX } from "./ui";

type Opcion = {
  slug: string;
  nombre: string;
  precio: number;
  cpu: string;
  ram: string;
  storage: string;
  discoGb: number | null;
  tipo: "actual" | "upgrade" | "downgrade";
  permitido: boolean;
  motivo: "disk_kept" | null;
};
type Datos = {
  actual: { slug: string | null; nombre: string; precio: number; cpu: string | null; ram: string | null; storage: string | null };
  opciones: Opcion[];
  pendiente: { invoiceId: string | null; aPlan: string; importe: number } | null;
};

const BOTON =
  "inline-flex min-h-11 items-center justify-center rounded-[var(--radius-md)] border border-[var(--color-line-strong)] px-4 text-sm transition-colors hover:border-[var(--color-accent)] hover:text-[var(--color-accent)] disabled:opacity-40";

/**
 * Sección "Ampliar / Reducir plan". Ampliar → proforma por la diferencia de
 * precio mensual (se aplica al pagar); reducir → inmediato y sin cobro, con
 * confirmación. El disco nunca se reduce: los planes con menos disco que el
 * actual no se pueden elegir.
 */
export function PlanSection({ id }: { id: string }) {
  const t = useTranslations("panel");
  const [datos, setDatos] = useState<Datos | null>(null);
  const [elegido, setElegido] = useState<string | null>(null);
  const [confirmar, setConfirmar] = useState(false);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<{ tipo: "ok" | "error"; texto: string; invoiceId?: string } | null>(null);

  const cargar = useCallback(async () => {
    try {
      const res = await fetch(`/api/panel/servicios/${id}/plan`);
      const j = await res.json().catch(() => null);
      if (j?.ok) setDatos(j as Datos);
    } catch {
      /* se muestra vacío */
    }
  }, [id]);

  useEffect(() => {
    void cargar();
  }, [cargar]);

  const opcion = datos?.opciones.find((o) => o.slug === elegido) ?? null;

  async function enviar() {
    if (!opcion) return;
    setBusy(true);
    setMsg(null);
    try {
      const res = await fetch(`/api/panel/servicios/${id}/plan`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ plan: opcion.slug }),
      });
      const j = await res.json().catch(() => null);
      if (!res.ok || !j?.ok) {
        setMsg({ tipo: "error", texto: j?.error === "pending" ? t("plan.errorPending") : j?.error === "busy" ? t("plan.errorBusy") : t("power.errorGeneric") });
        return;
      }
      setConfirmar(false);
      setElegido(null);
      if (j.aplicado) {
        setMsg({ tipo: "ok", texto: t("plan.downgradeDone") });
        window.dispatchEvent(new CustomEvent("panel:refresh-tasks"));
      } else {
        setMsg({ tipo: "ok", texto: t("plan.upgradeDone", { numero: j.numero, importe: Number(j.importe).toFixed(2) }), invoiceId: j.invoiceId });
      }
      await cargar();
    } catch {
      setMsg({ tipo: "error", texto: t("power.errorConnection") });
    } finally {
      setBusy(false);
    }
  }

  return (
    <section id="plan" className={`${CARD} scroll-mt-28`}>
      <div className="px-6 pt-6">
        <p className={SECTION_INDEX}>/07</p>
        <h2 className="mt-2 text-lg font-semibold">{t("plan.heading")}</h2>
        <p className="mt-1 text-sm text-[var(--color-fg-muted)]">{t("plan.intro")}</p>
      </div>
      <div className="px-6 py-5">
        {datos === null ? (
          <span className="block h-5 w-1/2 animate-pulse rounded bg-[var(--color-bg-overlay)]" aria-hidden="true" />
        ) : (
          <>
            <p className="text-sm">
              <span className="mono-label text-[0.6rem]">{t("plan.current")}</span>{" "}
              <span className="font-medium">{datos.actual.nombre}</span>{" "}
              <span className="font-mono text-[var(--color-fg-muted)]">
                {datos.actual.precio.toFixed(2)} {t("plan.perMonth")}
              </span>
            </p>

            {datos.pendiente && (
              <p className="mt-3 rounded-[var(--radius-md)] border border-[var(--color-accent)]/40 bg-[var(--color-accent)]/10 p-3 text-sm">
                {t("plan.pending", { importe: datos.pendiente.importe.toFixed(2) })}{" "}
                {datos.pendiente.invoiceId && (
                  <Link href={`/cuenta/facturas/${datos.pendiente.invoiceId}`} className="text-[var(--color-accent)] underline">
                    {t("plan.payLink")}
                  </Link>
                )}
              </p>
            )}

            <ul className="mt-4 grid gap-2 sm:grid-cols-2">
              {datos.opciones.map((o) => {
                const activo = elegido === o.slug;
                return (
                  <li key={o.slug}>
                    <button
                      type="button"
                      disabled={!o.permitido || busy || !!datos.pendiente}
                      onClick={() => {
                        setElegido(activo ? null : o.slug);
                        setConfirmar(false);
                        setMsg(null);
                      }}
                      className={
                        "w-full rounded-[var(--radius-md)] border p-3 text-left transition-colors disabled:cursor-not-allowed disabled:opacity-50 " +
                        (o.tipo === "actual"
                          ? "border-[var(--color-accent)]/60 bg-[var(--color-accent)]/5"
                          : activo
                            ? "border-[var(--color-accent)] bg-[var(--color-bg-base)]"
                            : "border-[var(--color-line)] bg-[var(--color-bg-base)] hover:border-[var(--color-line-strong)]")
                      }
                    >
                      <span className="flex items-center justify-between gap-3">
                        <span className="font-medium">{o.nombre}</span>
                        <span className="font-mono text-xs text-[var(--color-fg-muted)]">
                          {o.precio.toFixed(2)} {t("plan.perMonth")}
                        </span>
                      </span>
                      <span className="mt-1 block font-mono text-xs text-[var(--color-fg-muted)]">
                        {o.cpu} · {o.ram} · {o.storage}
                      </span>
                      <span className="mt-1 block text-[0.65rem] uppercase tracking-wide">
                        {o.tipo === "actual" ? (
                          <span className="text-[var(--color-accent)]">{t("plan.same")}</span>
                        ) : o.motivo === "disk_kept" ? (
                          <span className="text-[var(--color-fg-muted)]">{t("plan.downgrade")} · {t("plan.diskKept", { size: datos.actual.storage ?? "" })}</span>
                        ) : (
                          <span className="text-[var(--color-fg-muted)]">{o.tipo === "upgrade" ? t("plan.upgrade") : t("plan.downgrade")}</span>
                        )}
                      </span>
                    </button>
                  </li>
                );
              })}
            </ul>

            {opcion && opcion.tipo === "upgrade" && (
              <div className="mt-4 flex flex-wrap items-center gap-4">
                <button type="button" className={BOTON} disabled={busy} onClick={enviar}>
                  {t("plan.requestUpgrade")} · +{(opcion.precio - datos.actual.precio).toFixed(2)} €
                </button>
              </div>
            )}
            {opcion && opcion.tipo === "downgrade" && !confirmar && (
              <div className="mt-4">
                <button type="button" className={BOTON} disabled={busy} onClick={() => setConfirmar(true)}>
                  {t("plan.downgrade")}: {opcion.nombre}
                </button>
              </div>
            )}
            {opcion && opcion.tipo === "downgrade" && confirmar && (
              <div className="mt-4 rounded-[var(--radius-md)] border border-[var(--color-danger)]/40 bg-[var(--color-danger)]/5 p-4">
                <p className="text-sm">{t("plan.downgradeBody", { cpu: opcion.cpu, ram: opcion.ram, storage: datos.actual.storage ?? "" })}</p>
                <div className="mt-3 flex flex-wrap gap-3">
                  <button
                    type="button"
                    disabled={busy}
                    onClick={enviar}
                    className="inline-flex min-h-11 items-center justify-center rounded-[var(--radius-md)] bg-[var(--color-danger)] px-5 text-sm font-medium text-white transition-opacity hover:opacity-90 disabled:opacity-40"
                  >
                    {t("plan.confirmDowngrade")}
                  </button>
                  <button type="button" onClick={() => setConfirmar(false)} className="text-sm text-[var(--color-fg-muted)] transition-colors hover:text-[var(--color-fg)]">
                    {t("power.cancel")}
                  </button>
                </div>
              </div>
            )}
            {msg && (
              <p role={msg.tipo === "error" ? "alert" : "status"} className={`mt-4 text-sm ${msg.tipo === "error" ? "text-[var(--color-danger)]" : "text-[var(--color-accent)]"}`}>
                {msg.texto}{" "}
                {msg.invoiceId && (
                  <Link href={`/cuenta/facturas/${msg.invoiceId}`} className="underline">
                    {t("plan.payLink")}
                  </Link>
                )}
              </p>
            )}
          </>
        )}
      </div>
    </section>
  );
}
