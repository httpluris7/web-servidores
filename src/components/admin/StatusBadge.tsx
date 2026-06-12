import type { InvoiceStatus } from "@/lib/facturas";

const styles: Record<InvoiceStatus, string> = {
  pendiente: "border-amber-400/30 bg-amber-400/10 text-amber-300",
  pagada: "border-[var(--color-accent)]/30 bg-[var(--color-accent)]/10 text-[var(--color-accent)]",
  cancelada: "border-white/15 bg-white/5 text-[var(--color-fg-dim)] line-through",
};

const labels: Record<InvoiceStatus, string> = {
  pendiente: "Pending",
  pagada: "Paid",
  cancelada: "Cancelled",
};

/** Etiqueta de estado de factura, coloreada según su estado. */
export function StatusBadge({ estado }: { estado: InvoiceStatus }) {
  return (
    <span
      className={`inline-flex items-center rounded-full border px-2.5 py-0.5 font-mono text-[0.65rem] uppercase tracking-wider ${styles[estado]}`}
    >
      {labels[estado]}
    </span>
  );
}
