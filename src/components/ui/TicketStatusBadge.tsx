import { useTranslations } from "next-intl";
import type { TicketStatus } from "@/lib/tickets";

const styles: Record<TicketStatus, string> = {
  abierto: "border-amber-400/30 bg-amber-400/10 text-amber-300",
  respondido:
    "border-[var(--color-accent)]/30 bg-[var(--color-accent)]/10 text-[var(--color-accent)]",
  cerrado: "border-white/15 bg-white/5 text-[var(--color-fg-dim)]",
};

/**
 * Estado de un ticket. Los textos viven en `common.ticketStatus` para que el
 * área de cliente y el panel digan lo mismo sin duplicar traducciones.
 */
export function TicketStatusBadge({ estado }: { estado: TicketStatus }) {
  const t = useTranslations("common");
  return (
    <span
      className={`inline-flex items-center rounded-full border px-2.5 py-0.5 font-mono text-[0.65rem] uppercase tracking-wider ${styles[estado]}`}
    >
      {t(`ticketStatus.${estado}`)}
    </span>
  );
}
