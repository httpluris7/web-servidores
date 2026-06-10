import Link from "next/link";
import type { Plan } from "@/data/products";
import { eur } from "@/lib/utils";
import { cn } from "@/lib/utils";

const specRows: { key: keyof Plan; label: string }[] = [
  { key: "cpu", label: "CPU" },
  { key: "ram", label: "RAM" },
  { key: "storage", label: "Disco" },
  { key: "bandwidth", label: "Red" },
];

export function PlanCard({ plan }: { plan: Plan }) {
  return (
    <div
      className={cn(
        "relative flex h-full flex-col rounded-[var(--radius-lg)] border bg-[var(--color-bg-raised)] p-6 transition-colors",
        plan.popular
          ? "border-[var(--color-accent)] glow-accent"
          : "border-[var(--color-line)] hover:border-[var(--color-line-strong)]"
      )}
    >
      {plan.popular && (
        <span className="absolute -top-2.5 left-6 rounded bg-[var(--color-accent)] px-2 py-0.5 font-mono text-[0.65rem] font-medium uppercase tracking-wider text-black">
          Popular
        </span>
      )}

      <h3 className="text-xl font-semibold tracking-tight">{plan.name}</h3>

      <div className="mt-4 flex items-baseline gap-1">
        <span className="font-mono text-4xl font-semibold tracking-tight">{eur(plan.price)}</span>
        <span className="text-sm text-[var(--color-fg-muted)]">/mes</span>
      </div>

      <dl className="mt-6 space-y-2.5 border-t border-[var(--color-line)] pt-6 text-sm">
        {specRows.map((row) => (
          <div key={row.key} className="flex items-start justify-between gap-4">
            <dt className="mono-label text-[0.65rem]">{row.label}</dt>
            <dd className="text-right text-[var(--color-fg)]">{plan[row.key] as string}</dd>
          </div>
        ))}
      </dl>

      <Link
        href={plan.orderUrl}
        className={cn(
          "mt-6 inline-flex items-center justify-center rounded-[var(--radius-md)] px-5 py-3 text-sm font-medium transition-all",
          plan.popular
            ? "bg-[var(--color-accent)] text-black hover:bg-[var(--color-accent-dim)]"
            : "border border-[var(--color-line-strong)] hover:border-[var(--color-accent)] hover:text-[var(--color-accent)]"
        )}
      >
        Contratar →
      </Link>
    </div>
  );
}
