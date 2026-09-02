import type { Plan } from "@/data/products";
import { Price } from "@/components/ui/Price";

/**
 * Tabla HTML real (no imagen) con los planes de hosting y sus specs/precio.
 * Se genera desde el catálogo, así que nunca queda desincronizada. Pensada para
 * ser extractable por buscadores y LLMs (GEO): una fila por plan, columnas
 * claras. Scroll horizontal propio en móvil (el body nunca hace scroll-x).
 */
export function HostingPlansTable({
  plans,
  labels,
  perMonth,
  caption,
}: {
  plans: Plan[];
  /** Cabeceras ya traducidas. */
  labels: { plan: string; sites: string; storage: string; email: string; databases: string; price: string };
  perMonth: string;
  caption: string;
}) {
  return (
    <div className="overflow-x-auto rounded-[var(--radius-lg)] border border-[var(--color-line)]">
      <table className="w-full min-w-[640px] border-collapse text-sm">
        <caption className="sr-only">{caption}</caption>
        <thead>
          <tr className="bg-[var(--color-bg-raised)] text-left">
            <th scope="col" className="px-4 py-3 font-semibold">{labels.plan}</th>
            <th scope="col" className="px-4 py-3 font-semibold">{labels.sites}</th>
            <th scope="col" className="px-4 py-3 font-semibold">{labels.storage}</th>
            <th scope="col" className="px-4 py-3 font-semibold">{labels.email}</th>
            <th scope="col" className="px-4 py-3 font-semibold">{labels.databases}</th>
            <th scope="col" className="px-4 py-3 text-right font-semibold">{labels.price}</th>
          </tr>
        </thead>
        <tbody>
          {plans.map((p) => (
            <tr key={p.id} className="border-t border-[var(--color-line)]">
              <th scope="row" className="px-4 py-3 text-left font-medium text-[var(--color-fg)]">
                {p.name}
              </th>
              <td className="px-4 py-3 text-[var(--color-fg-muted)]">{p.cpu}</td>
              <td className="px-4 py-3 text-[var(--color-fg-muted)]">{p.ram}</td>
              <td className="px-4 py-3 text-[var(--color-fg-muted)]">{p.storage}</td>
              <td className="px-4 py-3 text-[var(--color-fg-muted)]">{p.bandwidth}</td>
              <td className="px-4 py-3 text-right font-mono">
                <Price value={p.price} />
                <span className="text-[var(--color-fg-muted)]">{perMonth}</span>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
