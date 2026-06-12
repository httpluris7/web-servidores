import Link from "next/link";
import { notFound } from "next/navigation";
import { getPublicUserById } from "@/lib/auth";
import { listInvoicesByUser, invoiceStats } from "@/lib/facturas";
import { readLeads } from "@/lib/leads";
import { eur, fmtDate } from "@/lib/utils";
import { StatusBadge } from "@/components/admin/StatusBadge";
import { InvoiceActions } from "@/components/admin/InvoiceActions";
import { InvoiceForm } from "@/components/admin/InvoiceForm";

export const dynamic = "force-dynamic";

const fields: { key: string; label: string }[] = [
  { key: "email", label: "Correo electrónico" },
  { key: "telefono", label: "Teléfono" },
  { key: "direccion", label: "Dirección" },
  { key: "codigoPostal", label: "Código postal" },
  { key: "ciudad", label: "Ciudad" },
  { key: "pais", label: "País" },
];

export default async function ClienteDetallePage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const cliente = await getPublicUserById(id);
  if (!cliente) notFound();

  const [facturas, pedidos] = await Promise.all([
    listInvoicesByUser(cliente.id, cliente.email),
    readLeads("pedido"),
  ]);
  const stats = invoiceStats(facturas);
  const pedidosCliente = pedidos.filter(
    (p) => String(p.email ?? "").toLowerCase() === cliente.email.toLowerCase()
  );

  const record = cliente as unknown as Record<string, string>;

  return (
    <div className="grid gap-10">
      <div>
        <Link href="/admin/clientes" className="text-xs text-[var(--color-fg-muted)] hover:text-[var(--color-fg)]">
          ← Clientes
        </Link>
        <h2 className="mt-2 text-2xl font-semibold tracking-tight">
          {cliente.nombre} {cliente.apellidos}
        </h2>
        <p className="mt-1 font-mono text-xs text-[var(--color-fg-muted)]">
          Cliente desde {fmtDate(cliente.createdAt)} · ID {cliente.id}
        </p>
      </div>

      {/* Datos del cliente */}
      <section>
        <h3 className="mono-label mb-4">Datos de la cuenta</h3>
        <dl className="grid gap-px overflow-hidden rounded-[var(--radius-lg)] border border-[var(--color-line)] bg-[var(--color-line)] sm:grid-cols-2">
          {fields.map((f) => (
            <div key={f.key} className="bg-[var(--color-bg-raised)] px-5 py-4">
              <dt className="mono-label text-[0.6rem]">{f.label}</dt>
              <dd className="mt-1 text-sm break-words">{record[f.key] || "—"}</dd>
            </div>
          ))}
        </dl>
      </section>

      {/* Resumen de facturación */}
      <section>
        <h3 className="mono-label mb-4">Facturación</h3>
        <div className="mb-4 grid grid-cols-3 gap-3">
          <div className="rounded-[var(--radius-md)] border border-[var(--color-line)] bg-[var(--color-bg-raised)] px-4 py-3">
            <p className="mono-label text-[0.6rem]">Facturado</p>
            <p className="mt-1 font-mono text-lg">{eur(stats.facturado, 2)}</p>
          </div>
          <div className="rounded-[var(--radius-md)] border border-[var(--color-line)] bg-[var(--color-bg-raised)] px-4 py-3">
            <p className="mono-label text-[0.6rem]">Cobrado</p>
            <p className="mt-1 font-mono text-lg text-[var(--color-accent)]">{eur(stats.cobrado, 2)}</p>
          </div>
          <div className="rounded-[var(--radius-md)] border border-[var(--color-line)] bg-[var(--color-bg-raised)] px-4 py-3">
            <p className="mono-label text-[0.6rem]">Pendiente</p>
            <p className="mt-1 font-mono text-lg">{eur(stats.pendiente, 2)}</p>
          </div>
        </div>

        {facturas.length === 0 ? (
          <p className="text-sm text-[var(--color-fg-muted)]">Este cliente no tiene facturas.</p>
        ) : (
          <ul className="divide-y divide-[var(--color-line)] rounded-[var(--radius-lg)] border border-[var(--color-line)]">
            {facturas.map((f) => (
              <li key={f.id} className="flex flex-wrap items-center justify-between gap-3 px-4 py-3">
                <div className="min-w-0">
                  <p className="text-sm">
                    <Link
                      href={`/admin/facturas/${f.id}`}
                      className="font-mono text-xs text-[var(--color-fg-muted)] underline-offset-2 hover:text-[var(--color-accent)] hover:underline"
                    >
                      {f.numero}
                    </Link>{" "}
                    · {f.concepto}
                  </p>
                  <p className="text-xs text-[var(--color-fg-muted)]">
                    Emitida {fmtDate(f.emitidaAt)} · vence {fmtDate(f.vencimientoAt)}
                  </p>
                </div>
                <div className="flex items-center gap-3">
                  <StatusBadge estado={f.estado} />
                  <span className="font-mono text-sm">{eur(f.total, 2)}</span>
                  <InvoiceActions id={f.id} estado={f.estado} />
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>

      {/* Pedidos del cliente */}
      {pedidosCliente.length > 0 && (
        <section>
          <h3 className="mono-label mb-4">Pedidos ({pedidosCliente.length})</h3>
          <ul className="divide-y divide-[var(--color-line)] rounded-[var(--radius-lg)] border border-[var(--color-line)]">
            {pedidosCliente.map((p, i) => (
              <li key={i} className="flex items-center justify-between gap-3 px-4 py-3 text-sm">
                <span>
                  {String(p.planName ?? p.planId ?? "—")}{" "}
                  <span className="text-[var(--color-fg-muted)]">· {String(p.region ?? "—")}</span>
                </span>
                <span className="font-mono text-xs text-[var(--color-fg-muted)]">
                  {fmtDate(typeof p.receivedAt === "string" ? p.receivedAt : null, true)}
                </span>
              </li>
            ))}
          </ul>
        </section>
      )}

      {/* Emitir factura para este cliente */}
      <section>
        <h3 className="mono-label mb-4">Emitir factura a este cliente</h3>
        <div className="rounded-[var(--radius-lg)] border border-[var(--color-line)] bg-[var(--color-bg-raised)] p-5 md:p-6">
          <InvoiceForm
            clientes={[]}
            preset={{
              id: cliente.id,
              nombre: cliente.nombre,
              apellidos: cliente.apellidos,
              email: cliente.email,
            }}
          />
        </div>
      </section>
    </div>
  );
}
