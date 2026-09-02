import type { Metadata } from "next";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { site } from "@/data/site";
import { PageHero } from "@/components/ui/PageHero";
import { DomainSearch } from "@/components/dominios/DomainSearch";
import { TldGrid } from "@/components/dominios/TldGrid";
import { tarifasPopulares } from "@/lib/domains/tarifas";
import { getSession } from "@/lib/session";
import { getPublicUserById } from "@/lib/auth";
import { alternatesFor, breadcrumbJsonLd } from "@/lib/seo";
import { JsonLd } from "@/components/seo/JsonLd";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>;
}): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "dominios" });
  return {
    alternates: alternatesFor(locale, "/dominios"),
    title: t("metaTitle"),
    description: t("metaDescription", { brand: site.brand }),
  };
}

export const dynamic = "force-dynamic";

export default async function DominiosPage({
  params,
  searchParams,
}: {
  params: Promise<{ locale: string }>;
  searchParams: Promise<{ q?: string }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);
  const t = await getTranslations("dominios");

  // Término del banner del home (?q=…): la búsqueda se ejecuta sola al cargar.
  const { q } = await searchParams;
  const initialQuery = typeof q === "string" ? q.slice(0, 63) : "";

  const session = await getSession();
  const user = session ? await getPublicUserById(session.uid) : null;
  const tarifas = await tarifasPopulares();

  return (
    <>
      <JsonLd data={breadcrumbJsonLd(locale, [{ name: t("kicker"), path: "/dominios" }])} />
      <PageHero
        index="/04"
        kicker={t("kicker")}
        title={
          <>
            {t("titleA")} <span className="text-accent">{t("titleB")}</span>
          </>
        }
        description={t("description")}
      />

      <section className="container-edge max-w-5xl py-16 md:py-20">
        <div className="mx-auto max-w-3xl">
          <DomainSearch
            user={user ? { nombre: user.nombre, email: user.email } : null}
            initialQuery={initialQuery}
          />
          <p className="mt-8 text-xs text-[var(--color-fg-dim)]">{t("privacyNote")}</p>
        </div>

        <TldGrid tarifas={tarifas} />
      </section>
    </>
  );
}
