import { useTranslations } from "next-intl";
import type { ServiceStatus } from "@/lib/panel/types";

/** Badge de estado comercial del servicio: ACTIVO / SUSPENDIDO / CANCELADO. */
export function StatusBadge({ status }: { status: ServiceStatus }) {
  const t = useTranslations("panel");
  const tono: Record<ServiceStatus, string> = {
    activo: "border-[var(--color-accent)]/40 bg-[var(--color-accent)]/10 text-[var(--color-accent)]",
    suspendido: "border-[var(--color-danger)]/40 bg-[var(--color-danger)]/10 text-[var(--color-danger)]",
    cancelado: "border-[var(--color-line-strong)] text-[var(--color-fg-muted)]",
  };
  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-full border px-3 py-1 font-mono text-xs uppercase tracking-wide ${tono[status]}`}
    >
      <span className="inline-block h-1.5 w-1.5 rounded-full bg-current" />
      {t(`header.status.${status}`)}
    </span>
  );
}
