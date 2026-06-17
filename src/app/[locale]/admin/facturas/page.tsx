import { getTranslations, setRequestLocale } from "next-intl/server";
import { Link } from "@/i18n/navigation";
import { listUsers } from "@/lib/auth";
import { listInvoices, invoiceStats } from "@/lib/facturas";
import { eur, fmtDate } from "@/lib/utils";
import { StatusBadge } from "@/components/admin/StatusBadge";
import { InvoiceActions } from "@/components/admin/InvoiceActions";
import { InvoiceForm } from "@/components/admin/InvoiceForm";

export const dynamic = "force-dynamic";

export default async function FacturasPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);
  const t = await getTranslations("admin");

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
            <span className="font-medium">{t("facturas.newInvoice")}</span>
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
            {t("facturas.heading")}{" "}
            <span className="font-mono text-sm text-[var(--color-fg-muted)]">({stats.total})</span>
          </h2>
          <p className="font-mono text-xs text-[var(--color-fg-muted)]">
            {t.rich("facturas.invoicedCollectedOutstanding", {
              invoiced: () => <span className="text-[var(--color-fg)]">{eur(stats.facturado, 2)}</span>,
              collected: () => <span className="text-[var(--color-accent)]">{eur(stats.cobrado, 2)}</span>,
              outstanding: () => <span className="text-amber-300">{eur(stats.pendiente, 2)}</span>,
            })}
          </p>
        </div>

        {facturas.length === 0 ? (
          <p className="text-sm text-[var(--color-fg-muted)]">
            {t("facturas.noInvoices")}
          </p>
        ) : (
          <div className="overflow-x-auto rounded-[var(--radius-lg)] border border-[var(--color-line)]">
            <table className="w-full min-w-[760px] border-collapse text-sm">
              <thead>
                <tr className="border-b border-[var(--color-line)] text-left">
                  <th className="px-4 py-3 mono-label text-[0.6rem]">{t("facturas.colNumber")}</th>
                  <th className="px-4 py-3 mono-label text-[0.6rem]">{t("facturas.colCustomer")}</th>
                  <th className="px-4 py-3 mono-label text-[0.6rem]">{t("facturas.colDescription")}</th>
                  <th className="px-4 py-3 mono-label text-[0.6rem]">{t("facturas.colIssued")}</th>
                  <th className="px-4 py-3 mono-label text-[0.6rem]">{t("facturas.colStatus")}</th>
                  <th className="px-4 py-3 mono-label text-[0.6rem] text-right">{t("facturas.colTotal")}</th>
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
                        {t("facturas.netVat", { net: eur(f.base, 2), vat: f.ivaPct })}
                      </p>
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex flex-wrap items-center justify-end gap-1.5">
                        <Link
                          href={`/admin/facturas/${f.id}`}
                          className="rounded-[var(--radius-sm)] border border-[var(--color-line-strong)] px-2.5 py-1 text-xs transition-colors hover:border-[var(--color-accent)] hover:text-[var(--color-accent)]"
                        >
                          {t("facturas.pdf")}
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
