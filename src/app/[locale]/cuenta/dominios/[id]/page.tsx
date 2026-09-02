import type { Metadata } from "next";
import { notFound, redirect } from "next/navigation";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { Link } from "@/i18n/navigation";
import { PageHero } from "@/components/ui/PageHero";
import { getSession } from "@/lib/session";
import { usuarioTieneDominio } from "@/lib/domains/intents";
import { DnsEditor } from "@/components/dominios/DnsEditor";

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

export default async function DominioPage({
  params,
}: {
  params: Promise<{ locale: string; id: string }>;
}) {
  const { locale, id } = await params;
  setRequestLocale(locale);
  const t = await getTranslations("dominios");

  const session = await getSession();
  if (!session) redirect("/acceder");

  const domain = decodeURIComponent(id).toLowerCase();
  // Propiedad ANTES de renderizar: un dominio ajeno o inexistente → 404.
  if (!(await usuarioTieneDominio(session.uid, domain))) notFound();

  return (
    <>
      <PageHero
        index="/03"
        kicker={t("mis.kicker")}
        title={<span className="text-accent break-all">{domain}</span>}
        description={t("dns.intro")}
      />

      <section className="container-edge max-w-3xl py-16 md:py-20">
        <p className="mb-6 text-sm text-[var(--color-fg-muted)]">
          <Link href="/cuenta/dominios" className="text-[var(--color-accent)] hover:underline">
            {t("dns.back")}
          </Link>
        </p>
        <DnsEditor domain={domain} />
      </section>
    </>
  );
}
