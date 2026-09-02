import type { Metadata } from "next";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { site } from "@/data/site";
import { PageHero } from "@/components/ui/PageHero";
import { DomainSearch } from "@/components/dominios/DomainSearch";
import { TldGrid } from "@/components/dominios/TldGrid";
import { tarifasPopulares } from "@/lib/domains/tarifas";
import { getSession } from "@/lib/session";
import { getPublicUserById } from "@/lib/auth";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>;
}): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "dominios" });
  return {
    title: t("metaTitle"),
    description: t("metaDescription", { brand: site.brand }),
  };
}

export const dynamic = "force-dynamic";

export default async function DominiosPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);
  const t = await getTranslations("dominios");

  const session = await getSession();
  const user = session ? await getPublicUserById(session.uid) : null;
  const tarifas = await tarifasPopulares();

  return (
    <>
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
          <DomainSearch user={user ? { nombre: user.nombre, email: user.email } : null} />
          <p className="mt-8 text-xs text-[var(--color-fg-dim)]">{t("privacyNote")}</p>
        </div>

        <TldGrid tarifas={tarifas} />
      </section>
    </>
  );
}
