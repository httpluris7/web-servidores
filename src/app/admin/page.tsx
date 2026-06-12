import Link from "next/link";
import { listUsers } from "@/lib/auth";
import { listInvoices, invoiceStats } from "@/lib/facturas";
import { readLeads } from "@/lib/leads";
import { eur, fmtDate } from "@/lib/utils";
import { StatusBadge } from "@/components/admin/StatusBadge";

export const dynamic = "force-dynamic";

function Stat({ label, value, hint }: { label: string; value: string; hint?: string }) {
  return (
    <div className="rounded-[var(--radius-lg)] border border-[var(--color-line)] bg-[var(--color-bg-raised)] px-5 py-4">
      <p className="mono-label text-[0.6rem]">{label}</p>
      <p className="mt-2 font-mono text-2xl font-semibold text-[var(--color-fg)]">{value}</p>
      {hint && <p className="mt-1 text-xs text-[var(--color-fg-muted)]">{hint}</p>}
    </div>
  );
}

export default async function AdminDashboard() {
  const [clientes, facturas, pedidos, contactos] = await Promise.all([
    listUsers(),
    listInvoices(),
    readLeads("pedido"),
    readLeads("contacto"),
  ]);
  const stats = invoiceStats(facturas);

  return (
    <div className="grid gap-10">
      <section>
        <h2 className="mono-label mb-4">Summary</h2>
        <div className="grid grid-cols-2 gap-3 lg:grid-cols-3">
          <Stat label="Customers" value={String(clientes.length)} hint="registered accounts" />
          <Stat label="Invoices" value={String(stats.total)} hint="issued" />
          <Stat label="Orders" value={String(pedidos.length)} hint="requests received" />
          <Stat label="Invoiced" value={eur(stats.facturado, 2)} hint="VAT included" />
          <Stat label="Outstanding" value={eur(stats.pendiente, 2)} hint="unpaid invoices" />
          <Stat label="Collected" value={eur(stats.cobrado, 2)} hint="paid invoices" />
        </div>
      </section>

      <div className="grid gap-8 lg:grid-cols-2">
        {/* Últimas facturas */}
        <section>
          <div className="mb-4 flex items-center justify-between">
            <h2 className="mono-label">Latest invoices</h2>
            <Link href="/admin/facturas" className="text-xs text-[var(--color-accent)] hover:underline">
              View all →
            </Link>
          </div>
          {facturas.length === 0 ? (
            <p className="text-sm text-[var(--color-fg-muted)]">No invoices yet.</p>
          ) : (
            <ul className="divide-y divide-[var(--color-line)] rounded-[var(--radius-lg)] border border-[var(--color-line)]">
              {facturas.slice(0, 5).map((f) => (
                <li key={f.id} className="flex items-center justify-between gap-3 px-4 py-3">
                  <div className="min-w-0">
                    <p className="truncate text-sm text-[var(--color-fg)]">
                      <span className="font-mono text-xs text-[var(--color-fg-muted)]">{f.numero}</span>{" "}
                      · {f.clienteNombre}
                    </p>
                    <p className="truncate text-xs text-[var(--color-fg-muted)]">{f.concepto}</p>
                  </div>
                  <div className="flex shrink-0 items-center gap-3">
                    <StatusBadge estado={f.estado} />
                    <span className="font-mono text-sm">{eur(f.total, 2)}</span>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </section>

        {/* Últimos clientes */}
        <section>
          <div className="mb-4 flex items-center justify-between">
            <h2 className="mono-label">Latest customers</h2>
            <Link href="/admin/clientes" className="text-xs text-[var(--color-accent)] hover:underline">
              View all →
            </Link>
          </div>
          {clientes.length === 0 ? (
            <p className="text-sm text-[var(--color-fg-muted)]">No customers yet.</p>
          ) : (
            <ul className="divide-y divide-[var(--color-line)] rounded-[var(--radius-lg)] border border-[var(--color-line)]">
              {clientes.slice(0, 5).map((c) => (
                <li key={c.id} className="flex items-center justify-between gap-3 px-4 py-3">
                  <Link href={`/admin/clientes/${c.id}`} className="min-w-0 hover:text-[var(--color-accent)]">
                    <p className="truncate text-sm text-[var(--color-fg)]">
                      {c.nombre} {c.apellidos}
                    </p>
                    <p className="truncate text-xs text-[var(--color-fg-muted)]">{c.email}</p>
                  </Link>
                  <span className="shrink-0 font-mono text-xs text-[var(--color-fg-muted)]">
                    {fmtDate(c.createdAt)}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>

      {contactos.length > 0 && (
        <p className="text-sm text-[var(--color-fg-muted)]">
          You have <span className="text-[var(--color-fg)]">{contactos.length}</span> contact
          message(s).{" "}
          <Link href="/admin/pedidos" className="text-[var(--color-accent)] hover:underline">
            Review →
          </Link>
        </p>
      )}
    </div>
  );
}
