import { getTranslations, setRequestLocale } from "next-intl/server";
import { Link } from "@/i18n/navigation";
import { listUsers } from "@/lib/auth";
import { listInvoices, invoiceStats, invoiceConcepto } from "@/lib/facturas";
import { filtrarFacturas, parseInvoiceFilter } from "@/lib/facturas-filtro";
import { eur, fmtDate } from "@/lib/utils";
import { StatusBadge } from "@/components/admin/StatusBadge";
import { InvoiceActions } from "@/components/admin/InvoiceActions";
import { InvoiceFilters } from "@/components/admin/InvoiceFilters";
import { InvoiceForm } from "@/components/admin/InvoiceForm";
import { getInvoiceCatalog } from "@/data/products";
import { stripeIsReady } from "@/lib/ajustes";

export const dynamic = "force-dynamic";

export default async function FacturasPage({
  params,
  searchParams,
}: {
  params: Promise<{ locale: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);
  const t = await getTranslations("admin");

  const [usuarios, todas, stripeReady, sp] = await Promise.all([
    listUsers(),
    listInvoices(),
    stripeIsReady(),
    searchParams,
  ]);

  // Un único filtro para la tabla y para la descarga en lote: lo que se ve en
  // pantalla es exactamente lo que entra en el zip.
  const filtro = parseInvoiceFilter(sp);
  const facturas = filtrarFacturas(todas, filtro);
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
            <InvoiceForm clientes={clientes} productos={await getInvoiceCatalog()} />
          </div>
        </details>
      </section>

      <section>
        <InvoiceFilters filtro={filtro} resultados={facturas.length} />
      </section>

      <section>
        <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
          <h2 className="text-lg font-semibold">
            {t("facturas.heading")}{" "}
            <span className="font-mono text-sm text-[var(--color-fg-muted)]">
              ({stats.total === todas.length ? stats.total : `${stats.total}/${todas.length}`})
            </span>
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
            {todas.length === 0 ? t("facturas.noInvoices") : t("facturas.filters.noResults")}
          </p>
        ) : (
          <div className="rounded-[var(--radius-lg)] border border-[var(--color-line)] md:overflow-x-auto">
            <table className="table-cards w-full border-collapse text-sm md:min-w-[760px]">
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
                    <td data-label={t("facturas.colNumber")} className="px-4 py-3">
                      <Link
                        href={`/admin/facturas/${f.id}`}
                        className="font-mono text-xs text-[var(--color-fg-muted)] underline-offset-2 hover:text-[var(--color-accent)] hover:underline"
                      >
                        {f.numero}
                      </Link>
                    </td>
                    <td data-label={t("facturas.colCustomer")} className="px-4 py-3">
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
                    <td data-label={t("facturas.colDescription")} className="px-4 py-3 max-w-[220px]">
                      <p className="truncate text-[var(--color-fg-muted)]" title={invoiceConcepto(f)}>
                        {invoiceConcepto(f)}
                      </p>
                    </td>
                    <td data-label={t("facturas.colIssued")} className="px-4 py-3 font-mono text-xs text-[var(--color-fg-muted)]">
                      {fmtDate(f.emitidaAt)}
                    </td>
                    <td data-label={t("facturas.colStatus")} className="px-4 py-3">
                      <StatusBadge estado={f.estado} />
                    </td>
                    <td data-label={t("facturas.colTotal")} className="px-4 py-3 text-right">
                      <span className="font-mono">{eur(f.total, 2)}</span>
                      <p className="text-[0.65rem] text-[var(--color-fg-dim)]">
                        {t("facturas.netVat", { net: eur(f.base, 2), vat: f.ivaPct })}
                      </p>
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex flex-wrap items-center justify-end gap-1.5">
                        <Link
                          href={`/admin/facturas/${f.id}`}
                          className="inline-flex min-h-11 items-center rounded-[var(--radius-sm)] border border-[var(--color-line-strong)] px-3 py-2 text-xs transition-colors hover:border-[var(--color-accent)] hover:text-[var(--color-accent)] md:min-h-0 md:px-2.5 md:py-1"
                        >
                          {t("facturas.pdf")}
                        </Link>
                        <InvoiceActions
                          id={f.id}
                          estado={f.estado}
                          stripeReady={stripeReady}
                          hasPayLink={!!f.pago}
                        />
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
