import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { site } from "@/data/site";
import { Link } from "@/i18n/navigation";
import { PageHero } from "@/components/ui/PageHero";
import { InvoiceStatusBadge } from "@/components/ui/InvoiceStatusBadge";
import { getSession } from "@/lib/session";
import { getPublicUserById } from "@/lib/auth";
import { invoiceConcepto, listInvoicesByUser } from "@/lib/facturas";
import { eur, fmtDate } from "@/lib/utils";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>;
}): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "auth" });
  return {
    title: t("invoices.metaTitle"),
    description: t("invoices.metaDescription", { brand: site.brand }),
    robots: { index: false, follow: false },
  };
}

export const dynamic = "force-dynamic";

export default async function FacturasClientePage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);
  const t = await getTranslations("auth");

  const session = await getSession();
  if (!session) redirect("/acceder");
  const user = await getPublicUserById(session.uid);
  if (!user) redirect("/acceder");

  // Incluye tanto las de sus compras como las emitidas a mano desde el panel:
  // las segundas pueden no llevar userId, pero sí su correo.
  const facturas = await listInvoicesByUser(user.id, user.email);
  const pendientes = facturas.filter((f) => f.estado === "pendiente");

  return (
    <>
      <PageHero
        index="/02"
        kicker={t("invoices.kicker")}
        title={
          <>
            {t("invoices.titleA")} <span className="text-accent">{t("invoices.titleB")}</span>.
          </>
        }
        description={t("invoices.description")}
      />

      <section className="container-edge max-w-3xl py-16 md:py-20">
        <p className="mb-6 text-sm text-[var(--color-fg-muted)]">
          <Link href="/cuenta" className="text-[var(--color-accent)] hover:underline">
            {t("invoices.backToAccount")}
          </Link>
        </p>

        {facturas.length === 0 ? (
          <div className="rounded-[var(--radius-lg)] border border-[var(--color-line)] bg-[var(--color-bg-raised)] p-8 text-center">
            <p className="text-lg font-medium">{t("invoices.emptyTitle")}</p>
            <p className="mt-2 text-sm text-[var(--color-fg-muted)]">{t("invoices.emptyText")}</p>
            <Link
              href="/desplegar"
              className="mt-6 inline-flex items-center justify-center rounded-[var(--radius-md)] bg-[var(--color-accent)] px-6 py-3 text-sm font-medium text-black transition-colors hover:bg-[var(--color-accent-dim)]"
            >
              {t("invoices.browsePlans")}
            </Link>
          </div>
        ) : (
          <>
            {pendientes.length > 0 && (
              <p className="mb-4 text-sm text-amber-300">
                {t("invoices.pendingNotice", { count: pendientes.length })}
              </p>
            )}

            <ul className="grid gap-3">
              {facturas.map((f) => (
                <li key={f.id}>
                  <Link
                    href={`/cuenta/facturas/${f.id}`}
                    className="flex flex-wrap items-center justify-between gap-x-4 gap-y-3 rounded-[var(--radius-lg)] border border-[var(--color-line)] bg-[var(--color-bg-raised)] px-5 py-4 transition-colors hover:border-[var(--color-accent)]"
                  >
                    <div className="min-w-0">
                      <p className="font-mono text-sm text-[var(--color-fg)]">{f.numero}</p>
                      <p className="mt-0.5 truncate text-xs text-[var(--color-fg-muted)]">
                        {invoiceConcepto(f)}
                      </p>
                      <p className="mt-1 font-mono text-[0.7rem] text-[var(--color-fg-dim)]">
                        {fmtDate(f.emitidaAt)}
                      </p>
                    </div>
                    <div className="flex shrink-0 items-center gap-4">
                      <InvoiceStatusBadge estado={f.estado} />
                      <span className="font-mono text-base font-semibold">{eur(f.total, 2)}</span>
                    </div>
                  </Link>
                </li>
              ))}
            </ul>
          </>
        )}
      </section>
    </>
  );
}
