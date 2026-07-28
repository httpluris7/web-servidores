"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { useRouter } from "@/i18n/navigation";
import type { InvoiceStatus } from "@/lib/facturas";

type Props = {
  id: string;
  estado: InvoiceStatus;
  /** ¿Hay pasarela configurada? Sin ella no se ofrece el cobro con tarjeta. */
  stripeReady?: boolean;
  /** ¿La factura ya tiene un enlace de pago generado? */
  hasPayLink?: boolean;
};

/** Acciones por factura: cobrar / reabrir / anular / eliminar (panel admin). */
export function InvoiceActions({ id, estado, stripeReady = false, hasPayLink = false }: Props) {
  const t = useTranslations("admin");
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [payUrl, setPayUrl] = useState<string | null>(null);
  const [payError, setPayError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [sent, setSent] = useState(false);

  /** Pide (o reutiliza) el enlace de pago y lo deja copiado en el portapapeles. */
  async function charge(opts: { regenerar?: boolean; enviar?: boolean } = {}) {
    setBusy(true);
    setPayError(null);
    setSent(false);
    try {
      const res = await fetch(`/api/admin/facturas/${id}/cobro`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(opts),
      });
      const data = await res.json().catch(() => null);
      if (!res.ok || !data?.ok) {
        setPayError(data?.error ?? t("invoiceActions.payError"));
        return;
      }
      setPayUrl(data.url as string);
      if (opts.enviar) setSent(data.sent === true);
      try {
        await navigator.clipboard.writeText(data.url as string);
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
      } catch {
        // Sin portapapeles: el enlace queda visible para copiarlo a mano.
      }
      router.refresh();
    } catch {
      setPayError(t("invoiceActions.payError"));
    } finally {
      setBusy(false);
    }
  }

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
    if (!confirm(t("invoiceActions.confirmDelete"))) return;
    setBusy(true);
    try {
      await fetch(`/api/admin/facturas/${id}`, { method: "DELETE" });
      router.refresh();
    } finally {
      setBusy(false);
    }
  }

  // En móvil los botones necesitan alto de dedo; desde sm vuelven a ser
  // compactos para que quepan varios en la celda de acciones.
  const btn =
    "inline-flex min-h-11 items-center rounded-[var(--radius-sm)] border border-[var(--color-line-strong)] px-3 py-2 text-xs transition-colors disabled:opacity-50 md:min-h-0 md:px-2.5 md:py-1";

  return (
    <div className="flex flex-wrap items-center justify-end gap-1.5">
      {estado === "pendiente" && stripeReady && (
        <button
          type="button"
          onClick={() => charge()}
          disabled={busy}
          className={btn + " hover:border-[var(--color-accent)] hover:text-[var(--color-accent)]"}
        >
          {hasPayLink || payUrl
            ? t("invoiceActions.copyPayLink")
            : t("invoiceActions.chargeCard")}
        </button>
      )}
      {estado !== "pagada" && (
        <button
          type="button"
          onClick={() => patch("pagada")}
          disabled={busy}
          className={btn + " hover:border-[var(--color-accent)] hover:text-[var(--color-accent)]"}
        >
          {t("invoiceActions.markPaid")}
        </button>
      )}
      {estado !== "pendiente" && (
        <button
          type="button"
          onClick={() => patch("pendiente")}
          disabled={busy}
          className={btn + " hover:border-[var(--color-fg)] hover:text-[var(--color-fg)]"}
        >
          {t("invoiceActions.reopen")}
        </button>
      )}
      {estado !== "cancelada" && (
        <button
          type="button"
          onClick={() => patch("cancelada")}
          disabled={busy}
          className={btn + " hover:border-[var(--color-fg)] hover:text-[var(--color-fg)]"}
        >
          {t("invoiceActions.cancel")}
        </button>
      )}
      <button
        type="button"
        onClick={remove}
        disabled={busy}
        aria-label={t("invoiceActions.deleteAria")}
        className={btn + " hover:border-[var(--color-danger)] hover:text-[var(--color-danger)]"}
      >
        {t("invoiceActions.delete")}
      </button>

      {/* Enlace recién generado: copiar, reenviar por correo o pedir uno nuevo. */}
      {payUrl && (
        <div className="mt-2 w-full rounded-[var(--radius-sm)] border border-[var(--color-line)] bg-[var(--color-bg-base)] p-2 text-left">
          <p className="mono-label text-[0.55rem]">
            {copied ? t("invoiceActions.payLinkCopied") : t("invoiceActions.payLink")}
          </p>
          <input
            readOnly
            value={payUrl}
            onFocus={(e) => e.currentTarget.select()}
            className="mt-1 w-full bg-transparent font-mono text-[0.65rem] text-[var(--color-fg-muted)] outline-none"
          />
          <div className="mt-1 flex flex-wrap gap-3">
            <button
              type="button"
              onClick={() => charge({ enviar: true })}
              disabled={busy}
              className="text-[0.65rem] text-[var(--color-accent)] hover:underline disabled:opacity-50"
            >
              {sent ? t("invoiceActions.payLinkSent") : t("invoiceActions.sendPayLink")}
            </button>
            <button
              type="button"
              onClick={() => charge({ regenerar: true })}
              disabled={busy}
              className="text-[0.65rem] text-[var(--color-fg-muted)] hover:underline disabled:opacity-50"
            >
              {t("invoiceActions.newPayLink")}
            </button>
          </div>
        </div>
      )}
      {payError && (
        <p role="alert" className="mt-1 w-full text-right text-[0.65rem] text-[var(--color-danger)]">
          {payError}
        </p>
      )}
    </div>
  );
}
