import type { Metadata } from "next";
import { notFound, redirect } from "next/navigation";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { site } from "@/data/site";
import { Link } from "@/i18n/navigation";
import { PageHero } from "@/components/ui/PageHero";
import { InvoiceStatusBadge } from "@/components/ui/InvoiceStatusBadge";
import { InvoicePayPanel } from "@/components/cuenta/InvoicePayPanel";
import { getSession } from "@/lib/session";
import { getInvoiceForUser } from "@/lib/facturas";
import { stripeIsReady } from "@/lib/ajustes";
import { eur, fmtDate } from "@/lib/utils";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>;
}): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "auth" });
  return {
    title: t("invoiceDetail.metaTitle"),
    description: t("invoiceDetail.metaDescription", { brand: site.brand }),
    robots: { index: false, follow: false },
  };
}

export const dynamic = "force-dynamic";

export default async function FacturaClientePage({
  params,
}: {
  params: Promise<{ locale: string; id: string }>;
}) {
  const { locale, id } = await params;
  setRequestLocale(locale);
  const t = await getTranslations("auth");

  const session = await getSession();
  if (!session) redirect("/acceder");

  // Una factura ajena responde igual que una inexistente: no se revela qué
  // facturas hay en el sistema.
  const f = await getInvoiceForUser(id, session.uid, session.email);
  if (!f) notFound();

  const stripeEnabled = await stripeIsReady();
  const ivaImporte = Math.round((f.total - f.base + Number.EPSILON) * 100) / 100;

  return (
    <>
      <PageHero
        index="/02"
        kicker={t("invoiceDetail.kicker")}
        title={
          <>
            {t("invoiceDetail.titleA")} <span className="text-accent">{f.numero}</span>
          </>
        }
        description={t("invoiceDetail.description")}
      />

      <section className="container-edge max-w-3xl py-16 md:py-20">
        <p className="mb-6 text-sm text-[var(--color-fg-muted)]">
          <Link href="/cuenta/facturas" className="text-[var(--color-accent)] hover:underline">
            {t("invoiceDetail.backToInvoices")}
          </Link>
        </p>

        {/* Cabecera: estado, fechas e importe */}
        <div className="rounded-[var(--radius-lg)] border border-[var(--color-line)] bg-[var(--color-bg-raised)] p-6">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div>
              <InvoiceStatusBadge estado={f.estado} />
              <p className="mt-3 font-mono text-sm text-[var(--color-fg-muted)]">{f.numero}</p>
            </div>
            <div className="text-right">
              <p className="font-mono text-2xl font-semibold">{eur(f.total, 2)}</p>
              {f.estado === "pendiente" && (
                <p className="mt-1 text-xs text-[var(--color-fg-muted)]">
                  {t("invoiceDetail.dueOn", { date: fmtDate(f.vencimientoAt) })}
                </p>
              )}
              {f.pagadaAt && (
                <p className="mt-1 text-xs text-[var(--color-accent)]">
                  {t("invoiceDetail.paidOn", { date: fmtDate(f.pagadaAt) })}
                </p>
              )}
            </div>
          </div>

          {/* Líneas */}
          <dl className="mt-6 space-y-3 border-t border-[var(--color-line)] pt-5 text-sm">
            {f.lineas.map((l, i) => (
              <div key={i} className="flex items-start justify-between gap-4">
                <dt className="min-w-0">
                  <span className="block text-[var(--color-fg)]">{l.concepto}</span>
                  {l.descripcion && (
                    <span className="mt-0.5 block text-xs text-[var(--color-fg-muted)]">
                      {l.descripcion}
                    </span>
                  )}
                  {l.cantidad > 1 && (
                    <span className="mt-0.5 block font-mono text-xs text-[var(--color-fg-dim)]">
                      {l.cantidad} × {eur(l.precioUnitario, 2)}
                    </span>
                  )}
                </dt>
                <dd className="shrink-0 font-mono text-[var(--color-fg)]">{eur(l.subtotal, 2)}</dd>
              </div>
            ))}
          </dl>

          <div className="mt-5 space-y-2 border-t border-[var(--color-line)] pt-5 text-sm">
            {f.ivaPct > 0 && (
              <>
                <div className="flex justify-between">
                  <span className="text-[var(--color-fg-muted)]">{t("invoiceDetail.base")}</span>
                  <span className="font-mono">{eur(f.base, 2)}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-[var(--color-fg-muted)]">
                    {t("invoiceDetail.tax", { pct: f.ivaPct })}
                  </span>
                  <span className="font-mono">{eur(ivaImporte, 2)}</span>
                </div>
              </>
            )}
            <div className="flex justify-between text-base font-semibold">
              <span>{t("invoiceDetail.total")}</span>
              <span className="font-mono">{eur(f.total, 2)}</span>
            </div>
          </div>

          {f.notas && (
            <p className="mt-5 border-t border-[var(--color-line)] pt-4 text-xs whitespace-pre-wrap text-[var(--color-fg-muted)]">
              {f.notas}
            </p>
          )}

          <a
            href={`/api/cuenta/facturas/${f.id}/pdf`}
            target="_blank"
            rel="noopener noreferrer"
            className="mt-6 inline-flex min-h-11 items-center justify-center rounded-[var(--radius-md)] border border-[var(--color-line-strong)] px-5 text-sm transition-colors hover:border-[var(--color-accent)] hover:text-[var(--color-accent)]"
          >
            {t("invoiceDetail.downloadPdf")}
          </a>
        </div>

        {/* Pago: solo mientras esté pendiente */}
        {f.estado === "pendiente" && (
          <div className="mt-6">
            <InvoicePayPanel
              invoiceId={f.id}
              numero={f.numero}
              amountLabel={eur(f.total, 2)}
              stripeEnabled={stripeEnabled}
            />
          </div>
        )}

        {f.estado === "cancelada" && (
          <p className="mt-6 rounded-[var(--radius-md)] border border-[var(--color-line)] px-5 py-4 text-sm text-[var(--color-fg-muted)]">
            {t("invoiceDetail.cancelledNote")}
          </p>
        )}
      </section>
    </>
  );
}
