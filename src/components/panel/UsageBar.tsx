/**
 * Barra "actual / límite" fina, en la línea del sitio. Presentacional: recibe el
 * porcentaje ya calculado y el texto ya formateado.
 */
export function UsageBar({ pct, text }: { pct: number; text: string }) {
  const alto = pct >= 85;
  return (
    <div className="min-w-0">
      <div className="flex items-baseline justify-between gap-3">
        <span className="font-mono text-sm text-[var(--color-fg)]">{text}</span>
        <span className="font-mono text-xs text-[var(--color-fg-muted)]">{pct}%</span>
      </div>
      <div className="mt-1.5 h-1.5 w-full overflow-hidden rounded-full bg-[var(--color-bg-overlay)]">
        <div
          className={`h-full rounded-full ${alto ? "bg-[var(--color-danger)]" : "bg-[var(--color-accent)]"}`}
          style={{ width: `${pct}%` }}
        />
      </div>
    </div>
  );
}
