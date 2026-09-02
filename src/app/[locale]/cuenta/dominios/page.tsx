import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { Link } from "@/i18n/navigation";
import { PageHero } from "@/components/ui/PageHero";
import { getSession } from "@/lib/session";
import { dominiosDeUsuario } from "@/lib/domains/intents";
import { listDomains } from "@/lib/domains/njalla";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>;
}): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "dominios" });
  return { title: t("mis.metaTitle"), robots: { index: false, follow: false } };
}

export const dynamic = "force-dynamic";

export default async function MisDominiosPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);
  const t = await getTranslations("dominios");

  const session = await getSession();
  if (!session) redirect("/acceder");

  const propios = await dominiosDeUsuario(session.uid);

  // Vencimiento desde Njalla (best-effort): un mapa nombre→expiry.
  let expiryPorNombre = new Map<string, string | null>();
  if (propios.length > 0) {
    try {
      const todos = await listDomains();
      expiryPorNombre = new Map(todos.map((d) => [d.name.toLowerCase(), d.expiry]));
    } catch {
      /* sin vencimiento: el listado funciona igual */
    }
  }

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

        {propios.length === 0 ? (
          <p className="text-sm text-[var(--color-fg-muted)]">{t("mis.empty")}</p>
        ) : (
          <ul className="grid gap-4">
            {propios.map((d) => {
              const expiry = expiryPorNombre.get(d.domain.toLowerCase());
              return (
                <li key={d.domain}>
                  <Link
                    href={`/cuenta/dominios/${encodeURIComponent(d.domain)}`}
                    className="block rounded-[var(--radius-lg)] border border-[var(--color-line)] bg-[var(--color-bg-raised)] p-5 transition-colors hover:border-[var(--color-accent)]"
                  >
                    <div className="flex flex-wrap items-center justify-between gap-3">
                      <span className="font-mono text-sm break-all text-[var(--color-fg)]">{d.domain}</span>
                      <span className="text-xs text-[var(--color-accent)]">{t("mis.manage")} →</span>
                    </div>
                    {expiry && (
                      <p className="mt-2 font-mono text-xs text-[var(--color-fg-muted)]">
                        {t("mis.expiry")}: {new Intl.DateTimeFormat(locale, { dateStyle: "medium" }).format(new Date(expiry))}
                      </p>
                    )}
                  </Link>
                </li>
              );
            })}
          </ul>
        )}
      </section>
    </>
  );
}
