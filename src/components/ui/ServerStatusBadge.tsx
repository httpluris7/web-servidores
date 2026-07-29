import { useTranslations } from "next-intl";

/**
 * Estado de un servidor. El proveedor devuelve una cadena libre; traducimos las
 * que conocemos y el resto se muestra tal cual, para no ocultar información por
 * no tenerla prevista.
 */
export function ServerStatusBadge({
  status,
  processing = false,
}: {
  status: string;
  processing?: boolean;
}) {
  const t = useTranslations("common");

  const conocidos: Record<string, string> = {
    started: t("serverStatus.started"),
    stopped: t("serverStatus.stopped"),
  };

  const tono = processing
    ? "border-[var(--color-accent)]/40 bg-[var(--color-accent)]/10 text-[var(--color-accent)]"
    : status === "started"
      ? "border-[var(--color-accent)]/40 bg-[var(--color-accent)]/10 text-[var(--color-accent)]"
      : status === "stopped"
        ? "border-[var(--color-line-strong)] text-[var(--color-fg-muted)]"
        : "border-[var(--color-line-strong)] text-[var(--color-fg)]";

  return (
    <span className={`inline-block rounded-full border px-3 py-1 font-mono text-xs ${tono}`}>
      {processing ? t("serverStatus.processing") : (conocidos[status] ?? status)}
    </span>
  );
}
