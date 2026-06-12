import Link from "next/link";
import { listUsers } from "@/lib/auth";
import { listInvoices, invoiceStats } from "@/lib/facturas";
import { eur, fmtDate } from "@/lib/utils";
import { StatusBadge } from "@/components/admin/StatusBadge";
import { InvoiceActions } from "@/components/admin/InvoiceActions";
import { InvoiceForm } from "@/components/admin/InvoiceForm";

export const dynamic = "force-dynamic";

export default async function FacturasPage() {
  const [usuarios, facturas] = await Promise.all([listUsers(), listInvoices()]);
  const stats = invoiceStats(facturas);

  const clientes = usuarios.map((u) => ({
    id: u.id,
    nombre: u.nombre,
    apellidos: u.apellidos,
    email: u.email,
  }));

  return (
    <div className="grid gap-10">
      <section>
        <details className="group rounded-[var(--radius-lg)] border border-[var(--color-line)] bg-[var(--color-bg-raised)]">
          <summary className="flex cursor-pointer list-none items-center justify-between px-5 py-4">
            <span className="font-medium">Nueva factura</span>
            <span className="font-mono text-xs text-[var(--color-fg-muted)] transition-transform group-open:rotate-180">
              ▾
            </span>
          </summary>
          <div className="border-t border-[var(--color-line)] p-5 md:p-6">
            <InvoiceForm clientes={clientes} />
          </div>
        </details>
      </section>

      <section>
        <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
          <h2 className="text-lg font-semibold">
            Facturas{" "}
            <span className="font-mono text-sm text-[var(--color-fg-muted)]">({stats.total})</span>
          </h2>
          <p className="font-mono text-xs text-[var(--color-fg-muted)]">
            Facturado <span className="text-[var(--color-fg)]">{eur(stats.facturado, 2)}</span> ·
            cobrado <span className="text-[var(--color-accent)]">{eur(stats.cobrado, 2)}</span> ·
            pendiente <span className="text-amber-300">{eur(stats.pendiente, 2)}</span>
          </p>
        </div>

        {facturas.length === 0 ? (
          <p className="text-sm text-[var(--color-fg-muted)]">
            Aún no has emitido ninguna factura. Crea la primera arriba.
          </p>
        ) : (
          <div className="overflow-x-auto rounded-[var(--radius-lg)] border border-[var(--color-line)]">
            <table className="w-full min-w-[760px] border-collapse text-sm">
              <thead>
                <tr className="border-b border-[var(--color-line)] text-left">
                  <th className="px-4 py-3 mono-label text-[0.6rem]">Nº</th>
                  <th className="px-4 py-3 mono-label text-[0.6rem]">Cliente</th>
                  <th className="px-4 py-3 mono-label text-[0.6rem]">Concepto</th>
                  <th className="px-4 py-3 mono-label text-[0.6rem]">Emitida</th>
                  <th className="px-4 py-3 mono-label text-[0.6rem]">Estado</th>
                  <th className="px-4 py-3 mono-label text-[0.6rem] text-right">Total</th>
                  <th className="px-4 py-3" />
                </tr>
              </thead>
              <tbody>
                {facturas.map((f) => (
                  <tr
                    key={f.id}
                    className="border-b border-[var(--color-line)] last:border-0 align-top transition-colors hover:bg-white/[0.02]"
                  >
                    <td className="px-4 py-3">
                      <Link
                        href={`/admin/facturas/${f.id}`}
                        className="font-mono text-xs text-[var(--color-fg-muted)] underline-offset-2 hover:text-[var(--color-accent)] hover:underline"
                      >
                        {f.numero}
                      </Link>
                    </td>
                    <td className="px-4 py-3">
                      {f.userId ? (
                        <Link
                          href={`/admin/clientes/${f.userId}`}
                          className="font-medium hover:text-[var(--color-accent)]"
                        >
                          {f.clienteNombre}
                        </Link>
                      ) : (
                        <span className="font-medium">{f.clienteNombre}</span>
                      )}
                      <p className="text-xs text-[var(--color-fg-muted)]">{f.clienteEmail}</p>
                    </td>
                    <td className="px-4 py-3 max-w-[220px]">
                      <p className="truncate text-[var(--color-fg-muted)]" title={f.concepto}>
                        {f.concepto}
                      </p>
                    </td>
                    <td className="px-4 py-3 font-mono text-xs text-[var(--color-fg-muted)]">
                      {fmtDate(f.emitidaAt)}
                    </td>
                    <td className="px-4 py-3">
                      <StatusBadge estado={f.estado} />
                    </td>
                    <td className="px-4 py-3 text-right">
                      <span className="font-mono">{eur(f.total, 2)}</span>
                      <p className="text-[0.65rem] text-[var(--color-fg-dim)]">
                        base {eur(f.base, 2)} · IVA {f.ivaPct}%
                      </p>
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex flex-wrap items-center justify-end gap-1.5">
                        <Link
                          href={`/admin/facturas/${f.id}`}
                          className="rounded-[var(--radius-sm)] border border-[var(--color-line-strong)] px-2.5 py-1 text-xs transition-colors hover:border-[var(--color-accent)] hover:text-[var(--color-accent)]"
                        >
                          PDF
                        </Link>
                        <InvoiceActions id={f.id} estado={f.estado} />
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  );
}
