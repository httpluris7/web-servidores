"use client";

import { useState } from "react";
import { useLocale, useTranslations } from "next-intl";
import { BankTransfer } from "@/components/ui/BankTransfer";

type Metodo = "tarjeta" | "transferencia";

/**
 * Panel de pago de una factura en el área de cliente.
 *
 * El cliente elige cómo pagar: con tarjeta salta a la pasarela, y con
 * transferencia se le muestran los datos con el número de factura como
 * referencia —que es lo que permite casar el ingreso con su pedido—.
 *
 * La tarjeta solo se ofrece si la pasarela está configurada; si falla al
 * generar el enlace, se avisa y la transferencia sigue disponible, para que
 * nunca quede sin forma de pagar.
 */
export function InvoicePayPanel({
  invoiceId,
  numero,
  amountLabel,
  stripeEnabled,
}: {
  invoiceId: string;
  numero: string;
  amountLabel: string;
  stripeEnabled: boolean;
}) {
  const t = useTranslations("auth");
  const locale = useLocale();
  const [metodo, setMetodo] = useState<Metodo>(stripeEnabled ? "tarjeta" : "transferencia");
  const [status, setStatus] = useState<"idle" | "sending">("idle");
  const [error, setError] = useState<string | null>(null);

  async function pagarConTarjeta() {
    setError(null);
    setStatus("sending");
    try {
      const res = await fetch(`/api/cuenta/facturas/${invoiceId}/pago`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ locale }),
      });
      const data = await res.json().catch(() => null);
      if (!res.ok || !data?.ok) {
        setError(
          data?.error === "card_unavailable"
            ? t("invoiceDetail.cardUnavailable")
            : (data?.error ?? t("invoiceDetail.payError"))
        );
        setStatus("idle");
        return;
      }
      window.location.href = data.url as string;
    } catch {
      setError(t("invoiceDetail.errorConnection"));
      setStatus("idle");
    }
  }

  const opcion = (valor: Metodo, etiqueta: string, nota: string) => (
    <label
      key={valor}
      className={
        "flex cursor-pointer items-start gap-3 rounded-[var(--radius-md)] border p-4 transition-colors " +
        (metodo === valor
          ? "border-[var(--color-accent)] bg-[var(--color-accent)]/5"
          : "border-[var(--color-line-strong)] hover:border-[var(--color-fg-dim)]")
      }
    >
      <input
        type="radio"
        name="metodo-pago"
        value={valor}
        checked={metodo === valor}
        onChange={() => {
          setMetodo(valor);
          setError(null);
        }}
        className="mt-1 h-4 w-4 accent-[var(--color-accent)]"
      />
      <span className="min-w-0">
        <span className="block text-sm font-medium text-[var(--color-fg)]">{etiqueta}</span>
        <span className="mt-0.5 block text-xs text-[var(--color-fg-muted)]">{nota}</span>
      </span>
    </label>
  );

  return (
    <div className="rounded-[var(--radius-lg)] border border-[var(--color-line)] bg-[var(--color-bg-raised)] p-6">
      <h2 className="text-lg font-semibold">{t("invoiceDetail.payHeading")}</h2>
      <p className="mt-1 mb-5 text-sm text-[var(--color-fg-muted)]">
        {t("invoiceDetail.payIntro", { amount: amountLabel })}
      </p>

      <div className="grid gap-3">
        {stripeEnabled &&
          opcion("tarjeta", t("invoiceDetail.methodCard"), t("invoiceDetail.methodCardNote"))}
        {opcion(
          "transferencia",
          t("invoiceDetail.methodTransfer"),
          t("invoiceDetail.methodTransferNote")
        )}
      </div>

      {metodo === "tarjeta" ? (
        <>
          <button
            type="button"
            onClick={pagarConTarjeta}
            disabled={status === "sending"}
            className="mt-6 inline-flex w-full items-center justify-center rounded-[var(--radius-md)] bg-[var(--color-accent)] px-6 py-3.5 text-sm font-medium text-black transition-colors hover:bg-[var(--color-accent-dim)] disabled:opacity-60 sm:w-auto"
          >
            {status === "sending"
              ? t("invoiceDetail.redirecting")
              : t("invoiceDetail.payNow", { amount: amountLabel })}
          </button>
          <p className="mt-3 text-xs text-[var(--color-fg-dim)]">
            {t("invoiceDetail.cardRedirectNote")}
          </p>
        </>
      ) : (
        <div className="mt-6">
          <BankTransfer reference={numero} amountLabel={amountLabel} />
        </div>
      )}

      {error && (
        <p role="alert" className="mt-4 text-sm text-[var(--color-danger)]">
          {error}
        </p>
      )}
    </div>
  );
}
