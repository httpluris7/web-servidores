import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { Link } from "@/i18n/navigation";
import { PageHero } from "@/components/ui/PageHero";
import { getSession } from "@/lib/session";
import { hostingDeUsuario } from "@/lib/hosting/intents";
import { getCatalog } from "@/data/products";
import { readSettings } from "@/lib/ajustes";
import { HostingPasswordReset } from "@/components/hosting/HostingPasswordReset";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>;
}): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "hosting" });
  return { title: t("mis.metaTitle"), robots: { index: false, follow: false } };
}

export const dynamic = "force-dynamic";

export default async function MisHostingPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);
  const t = await getTranslations("hosting");

  const session = await getSession();
  if (!session) redirect("/acceder");

  const servicios = await hostingDeUsuario(session.uid).catch(() => []);

  // Nombre del plan (por planId) para pintarlo en cristiano, y host del panel
  // cPanel (hostname del nodo, con cert válido) para el enlace de acceso.
  const { allPlans } = await getCatalog(locale);
  const nombrePlan = new Map(allPlans.map((p) => [p.plan.id, p.plan.name]));
  const { hosting } = await readSettings();
  const panelHost = hosting.whmHost.trim() || "web01.viahost.top";
  const panelUrl = `https://${panelHost}:2083`;
  const fecha = (iso: string) =>
    iso ? new Intl.DateTimeFormat(locale, { dateStyle: "medium" }).format(new Date(iso)) : "—";

  return (
    <>
      <PageHero
        index="/03"
        kicker={t("mis.kicker")}
        title={<span className="text-accent">{t("mis.title")}</span>}
        description={t("mis.description")}
      />

      <section className="container-edge max-w-3xl py-16 md:py-20">
        <p className="mb-6 text-sm text-[var(--color-fg-muted)]">
          <Link href="/cuenta" className="text-[var(--color-accent)] hover:underline">
            {t("mis.backToAccount")}
          </Link>
        </p>

        {servicios.length === 0 ? (
          <p className="text-sm text-[var(--color-fg-muted)]">{t("mis.empty")}</p>
        ) : (
          <>
            <ul className="grid gap-4">
              {servicios.map((s) => (
                <li
                  key={`${s.invoiceId}-${s.planId}`}
                  className="rounded-[var(--radius-lg)] border border-[var(--color-line)] bg-[var(--color-bg-raised)] p-5"
                >
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <span className="text-base font-semibold text-[var(--color-fg)]">
                      {nombrePlan.get(s.planId) ?? s.planId}
                    </span>
                    <span className="font-mono text-[0.65rem] text-[var(--color-fg-muted)]">
                      {s.cpanelPackage}
                    </span>
                  </div>

                  <dl className="mt-4 grid gap-2 text-sm sm:grid-cols-2">
                    <div>
                      <dt className="mono-label text-[0.6rem]">{t("mis.domainLabel")}</dt>
                      <dd className="mt-0.5 font-mono text-xs break-all text-[var(--color-fg)]">
                        {s.domain ?? "—"}
                      </dd>
                    </div>
                    <div>
                      <dt className="mono-label text-[0.6rem]">{t("mis.userLabel")}</dt>
                      <dd className="mt-0.5 font-mono text-xs text-[var(--color-fg)]">
                        {s.cpanelUser ?? "—"}
                      </dd>
                    </div>
                    <div>
                      <dt className="mono-label text-[0.6rem]">{t("mis.createdLabel")}</dt>
                      <dd className="mt-0.5 text-xs text-[var(--color-fg-muted)]">{fecha(s.creadoAt)}</dd>
                    </div>
                  </dl>

                  <div className="mt-5 flex flex-wrap gap-3">
                    <a
                      href={panelUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex min-h-11 items-center justify-center rounded-[var(--radius-md)] bg-[var(--color-accent)] px-5 text-sm font-medium text-black transition-colors hover:bg-[var(--color-accent-dim)]"
                    >
                      {t("mis.openPanel")} ↗
                    </a>
                    {s.domain && (
                      <a
                        href={`https://${s.domain}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex min-h-11 items-center justify-center rounded-[var(--radius-md)] border border-[var(--color-line-strong)] px-5 text-sm transition-colors hover:border-[var(--color-accent)] hover:text-[var(--color-accent)]"
                      >
                        {t("mis.viewSite")} ↗
                      </a>
                    )}
                  </div>

                  {s.cpanelUser && <HostingPasswordReset cpanelUser={s.cpanelUser} />}
                </li>
              ))}
            </ul>

            <p className="mt-8 text-xs text-[var(--color-fg-dim)]">{t("mis.credsNote")}</p>
          </>
        )}
      </section>
    </>
  );
}
