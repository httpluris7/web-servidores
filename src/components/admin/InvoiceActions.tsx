"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import type { InvoiceStatus } from "@/lib/facturas";

type Props = { id: string; estado: InvoiceStatus };

/** Acciones por factura: cobrar / reabrir / anular / eliminar (panel admin). */
export function InvoiceActions({ id, estado }: Props) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);

  async function patch(nuevo: InvoiceStatus) {
    setBusy(true);
    try {
      await fetch(`/api/admin/facturas/${id}`, {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ estado: nuevo }),
      });
      router.refresh();
    } finally {
      setBusy(false);
    }
  }

  async function remove() {
    if (!confirm("¿Eliminar esta factura de forma permanente?")) return;
    setBusy(true);
    try {
      await fetch(`/api/admin/facturas/${id}`, { method: "DELETE" });
      router.refresh();
    } finally {
      setBusy(false);
    }
  }

  const btn =
    "rounded-[var(--radius-sm)] border border-[var(--color-line-strong)] px-2.5 py-1 text-xs transition-colors disabled:opacity-50";

  return (
    <div className="flex flex-wrap items-center justify-end gap-1.5">
      {estado !== "pagada" && (
        <button
          type="button"
          onClick={() => patch("pagada")}
          disabled={busy}
          className={btn + " hover:border-[var(--color-accent)] hover:text-[var(--color-accent)]"}
        >
          Marcar pagada
        </button>
      )}
      {estado !== "pendiente" && (
        <button
          type="button"
          onClick={() => patch("pendiente")}
          disabled={busy}
          className={btn + " hover:border-[var(--color-fg)] hover:text-[var(--color-fg)]"}
        >
          Reabrir
        </button>
      )}
      {estado !== "cancelada" && (
        <button
          type="button"
          onClick={() => patch("cancelada")}
          disabled={busy}
          className={btn + " hover:border-[var(--color-fg)] hover:text-[var(--color-fg)]"}
        >
          Anular
        </button>
      )}
      <button
        type="button"
        onClick={remove}
        disabled={busy}
        aria-label="Eliminar factura"
        className={btn + " hover:border-[var(--color-danger)] hover:text-[var(--color-danger)]"}
      >
        Eliminar
      </button>
    </div>
  );
}
