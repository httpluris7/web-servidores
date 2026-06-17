import Link from "next/link";
import { notFound } from "next/navigation";
import { site } from "@/data/site";
import { getInvoiceById } from "@/lib/facturas";
import { eur, fmtDate } from "@/lib/utils";
import { PrintButton } from "@/components/admin/PrintButton";

export const dynamic = "force-dynamic";

const estadoLabel: Record<string, string> = {
  pendiente: "Pending payment",
  pagada: "Paid",
  cancelada: "Cancelled",
};

export default async function FacturaImprimiblePage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const f = await getInvoiceById(id);
  if (!f) notFound();

  const ivaImporte = Math.round((f.total - f.base + Number.EPSILON) * 100) / 100;

  return (
    <div className="grid gap-6">
      {/* Barra de acciones (no se imprime) */}
      <div className="no-print flex flex-wrap items-center justify-between gap-3">
        <Link
          href="/admin/facturas"
          className="text-xs text-[var(--color-fg-muted)] hover:text-[var(--color-fg)]"
        >
          ← Invoices
        </Link>
        <PrintButton />
      </div>

      {/* Hoja de la factura (formato documento, fondo blanco para impresión/PDF) */}
      <article className="invoice-sheet mx-auto w-full max-w-3xl rounded-[var(--radius-lg)] bg-white p-8 text-[#0b0f17] shadow-2xl shadow-black/40 sm:p-12">
        {/* Cabecera: emisor + título */}
        <header className="flex flex-wrap items-start justify-between gap-6 border-b border-[#e5e8ee] pb-6">
          <div>
            <div className="flex items-center gap-2">
              <span className="inline-block h-2.5 w-2.5 rounded-full bg-[#00b886]" />
              <span className="text-lg font-bold tracking-tight">{site.brand}</span>
            </div>
            <div className="mt-3 text-xs leading-relaxed text-[#55607a]">
              <p className="font-medium text-[#0b0f17]">{site.legal.companyName}</p>
              <p>{site.legal.taxId}</p>
              <p>{site.legal.address}</p>
              <p>{site.contact.support}</p>
            </div>
          </div>
          <div className="text-right">
            <h1 className="text-2xl font-bold tracking-tight">INVOICE</h1>
            <p className="mt-1 font-mono text-sm text-[#55607a]">{f.numero}</p>
            <p
              className={
                "mt-3 inline-block rounded-full border px-3 py-1 text-xs font-semibold uppercase tracking-wide " +
                (f.estado === "pagada"
                  ? "border-[#00b886]/40 bg-[#00b886]/10 text-[#00875f]"
                  : f.estado === "cancelada"
                    ? "border-[#cfd6e4] bg-[#f3f5f9] text-[#8a93a6]"
                    : "border-[#e0a100]/40 bg-[#fff7e0] text-[#9a7400]")
              }
            >
              {estadoLabel[f.estado]}
            </p>
          </div>
        </header>

        {/* Receptor + fechas */}
        <section className="grid gap-6 py-6 sm:grid-cols-2">
          <div>
            <p className="text-[0.65rem] font-semibold uppercase tracking-wider text-[#8a93a6]">
              Bill to
            </p>
            <p className="mt-2 text-sm font-medium">{f.clienteNombre}</p>
            <p className="text-sm text-[#55607a]">{f.clienteEmail}</p>
          </div>
          <div className="grid grid-cols-2 gap-y-2 text-sm sm:text-right">
            <span className="text-[#8a93a6]">Issue date</span>
            <span className="font-medium">{fmtDate(f.emitidaAt)}</span>
            <span className="text-[#8a93a6]">Due date</span>
            <span className="font-medium">{fmtDate(f.vencimientoAt)}</span>
            {f.pagadaAt && (
              <>
                <span className="text-[#8a93a6]">Payment date</span>
                <span className="font-medium">{fmtDate(f.pagadaAt)}</span>
              </>
            )}
          </div>
        </section>

        {/* Líneas */}
        <table className="w-full border-collapse text-sm">
          <thead>
            <tr className="border-y border-[#e5e8ee] text-left text-[0.65rem] uppercase tracking-wider text-[#8a93a6]">
              <th className="py-2.5 pr-3 font-semibold">Description</th>
              <th className="py-2.5 px-3 text-right font-semibold">Net</th>
              <th className="py-2.5 px-3 text-right font-semibold">VAT</th>
              <th className="py-2.5 pl-3 text-right font-semibold">Total</th>
            </tr>
          </thead>
          <tbody>
            <tr className="border-b border-[#eef1f6]">
              <td className="py-3 pr-3 align-top">{f.concepto}</td>
              <td className="py-3 px-3 text-right align-top font-mono">{eur(f.base, 2)}</td>
              <td className="py-3 px-3 text-right align-top font-mono">{f.ivaPct}%</td>
              <td className="py-3 pl-3 text-right align-top font-mono">{eur(f.base, 2)}</td>
            </tr>
          </tbody>
        </table>

        {/* Totales */}
        <div className="mt-6 flex justify-end">
          <dl className="w-full max-w-xs space-y-2 text-sm">
            <div className="flex justify-between">
              <dt className="text-[#55607a]">Taxable base</dt>
              <dd className="font-mono">{eur(f.base, 2)}</dd>
            </div>
            <div className="flex justify-between">
              <dt className="text-[#55607a]">VAT ({f.ivaPct}%)</dt>
              <dd className="font-mono">{eur(ivaImporte, 2)}</dd>
            </div>
            <div className="flex justify-between border-t border-[#e5e8ee] pt-2 text-base font-bold">
              <dt>Total</dt>
              <dd className="font-mono">{eur(f.total, 2)}</dd>
            </div>
          </dl>
        </div>

        {/* Notas */}
        {f.notas && (
          <div className="mt-8 border-t border-[#e5e8ee] pt-4">
            <p className="text-[0.65rem] font-semibold uppercase tracking-wider text-[#8a93a6]">Notes</p>
            <p className="mt-1.5 whitespace-pre-wrap text-sm text-[#55607a]">{f.notas}</p>
          </div>
        )}

        {/* Pie legal */}
        <footer className="mt-10 border-t border-[#e5e8ee] pt-4 text-center text-[0.7rem] leading-relaxed text-[#8a93a6]">
          <p>
            {site.legal.companyName} · {site.legal.taxId} · {site.legal.jurisdiction}
          </p>
          <p className="mt-0.5">
            Thank you for trusting {site.brand}. Invoice generated electronically; valid without a signature.
          </p>
        </footer>
      </article>
    </div>
  );
}
