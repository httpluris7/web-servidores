"use client";

import { useEffect, useState } from "react";
import Link from "next/link";

/**
 * Banner de cookies — hueco preparado, INACTIVO por defecto.
 * El sitio no carga analítica todavía, así que no se muestra. Cuando se añada
 * analítica, pon `enabled` a true (idealmente leyendo una env/flag) y conecta
 * el consentimiento al cargador de scripts.
 */
const enabled = true; // Activo. Al integrar analítica, inicialízala en decide("accepted").
const STORAGE_KEY = "viahost.cookie-consent";

export function CookieBanner() {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    if (!enabled) return;
    try {
      if (!localStorage.getItem(STORAGE_KEY)) setVisible(true);
    } catch {
      /* localStorage no disponible */
    }
  }, []);

  const decide = (value: "accepted" | "rejected") => {
    try {
      localStorage.setItem(STORAGE_KEY, value);
    } catch {
      /* noop */
    }
    setVisible(false);
    // TODO: si value === "accepted", inicializar aquí los scripts de analítica.
  };

  if (!enabled || !visible) return null;

  return (
    <div
      role="dialog"
      aria-label="Aviso de cookies"
      className="fixed inset-x-4 bottom-4 z-[70] mx-auto max-w-2xl rounded-[var(--radius-lg)] border border-[var(--color-line-strong)] bg-[var(--color-bg-overlay)] p-5 shadow-2xl shadow-black/50 md:flex md:items-center md:gap-6"
    >
      <p className="text-sm text-[var(--color-fg-muted)]">
        Usamos cookies para mejorar tu experiencia. Consulta nuestra{" "}
        <Link href="/legal/cookies" className="text-[var(--color-accent)] underline">
          política de cookies
        </Link>
        .
      </p>
      <div className="mt-4 flex gap-3 md:mt-0 md:shrink-0">
        <button
          type="button"
          onClick={() => decide("rejected")}
          className="rounded-[var(--radius-md)] border border-[var(--color-line-strong)] px-4 py-2 text-sm transition-colors hover:border-[var(--color-accent)]"
        >
          Rechazar
        </button>
        <button
          type="button"
          onClick={() => decide("accepted")}
          className="rounded-[var(--radius-md)] bg-[var(--color-accent)] px-4 py-2 text-sm font-medium text-black"
        >
          Aceptar
        </button>
      </div>
    </div>
  );
}
