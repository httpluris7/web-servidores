"use client";

import { useEffect, useRef, useState } from "react";
import { useTranslations } from "next-intl";
import { Link } from "@/i18n/navigation";

/** Cada cuánto se relee el estado mientras el servidor se aprovisiona. */
const POLL_MS = 3000;

type Estado = "queued" | "provisioning" | "active" | "failed" | "cancelled";

type Snapshot = {
  estado: Estado;
  plan: string | null;
  os: string | null;
  ubicacion: string | null;
};

/**
 * Sigue en vivo el aprovisionamiento de un pedido y muestra su progreso.
 * Sondea la ruta de estado hasta que el pedido queda `active` o `failed`.
 */
export function DeploymentTracker({
  orderId,
  initial,
}: {
  orderId: number;
  initial: Snapshot;
}) {
  const t = useTranslations("auth");
  const [snap, setSnap] = useState<Snapshot>(initial);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    // Estados finales: no seguimos sondeando.
    if (snap.estado === "active" || snap.estado === "failed" || snap.estado === "cancelled") {
      return;
    }
    let cancelado = false;
    const tick = async () => {
      try {
        const res = await fetch(`/api/cuenta/despliegues/${orderId}`);
        if (res.ok) {
          const json = await res.json();
          if (json.ok && !cancelado) {
            setSnap({
              estado: json.estado as Estado,
              plan: json.plan ?? null,
              os: json.os ?? null,
              ubicacion: json.ubicacion ?? null,
            });
          }
        }
      } catch {
        // Fallo puntual de red: reintentamos en el siguiente ciclo.
      }
      if (!cancelado) timer.current = setTimeout(tick, POLL_MS);
    };
    timer.current = setTimeout(tick, POLL_MS);
    return () => {
      cancelado = true;
      if (timer.current) clearTimeout(timer.current);
    };
  }, [snap.estado, orderId]);

  const trabajando = snap.estado === "queued" || snap.estado === "provisioning";
  const statusText =
    snap.estado === "active"
      ? t("deployment.statusActive")
      : snap.estado === "failed" || snap.estado === "cancelled"
        ? t("deployment.statusFailed")
        : snap.estado === "provisioning"
          ? t("deployment.statusProvisioning")
          : t("deployment.statusQueued");

  const card =
    "rounded-[var(--radius-lg)] border border-[var(--color-line)] bg-[var(--color-bg-raised)] p-6 min-w-0";
  const boton =
    "inline-flex min-h-11 items-center justify-center rounded-[var(--radius-md)] border border-[var(--color-line-strong)] px-4 text-sm transition-colors hover:border-[var(--color-accent)] hover:text-[var(--color-accent)]";

  return (
    <div className="grid min-w-0 gap-6">
      <section className={card}>
        <div className="flex items-center gap-3">
          {trabajando && (
            <span
              aria-hidden
              className="inline-block h-4 w-4 animate-spin rounded-full border-2 border-[var(--color-line-strong)] border-t-[var(--color-accent)]"
            />
          )}
          <p
            className={
              snap.estado === "failed"
                ? "text-[var(--color-danger)]"
                : snap.estado === "active"
                  ? "text-[var(--color-accent)]"
                  : "text-[var(--color-fg)]"
            }
          >
            {statusText}
          </p>
        </div>

        <dl className="mt-5 grid grid-cols-2 gap-x-6 gap-y-2 font-mono text-xs text-[var(--color-fg-muted)]">
          <dt>{t("deployment.planLabel")}</dt>
          <dd className="text-right">{snap.plan ?? "—"}</dd>
          <dt>{t("deployment.osLabel")}</dt>
          <dd className="text-right">{snap.os ?? "—"}</dd>
          <dt>{t("deployment.locationLabel")}</dt>
          <dd className="text-right">{snap.ubicacion ?? "—"}</dd>
        </dl>
      </section>

      {snap.estado === "active" && (
        <section className={card}>
          <p className="text-sm text-[var(--color-fg-muted)]">{t("deployment.activeIntro")}</p>
          <Link href="/cuenta/servidores" className={`${boton} mt-4`}>
            {t("deployment.activeCta")}
          </Link>
        </section>
      )}

      {(snap.estado === "failed" || snap.estado === "cancelled") && (
        <section className={card}>
          <p className="text-sm text-[var(--color-fg-muted)]">{t("deployment.failedNote")}</p>
          <Link href="/soporte" className={`${boton} mt-4`}>
            {t("deployment.supportCta")}
          </Link>
        </section>
      )}
    </div>
  );
}
