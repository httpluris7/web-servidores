import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { site } from "@/data/site";
import { PageHero } from "@/components/ui/PageHero";
import { LoginForm } from "@/components/forms/LoginForm";
import { getSession } from "@/lib/session";
import { safeInternalPath } from "@/lib/utils";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>;
}): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "auth" });
  return {
    title: t("login.metaTitle"),
    description: t("login.metaDescription", { brand: site.brand }),
    robots: { index: false, follow: false },
  };
}

export default async function AccederPage({
  params,
  searchParams,
}: {
  params: Promise<{ locale: string }>;
  searchParams: Promise<{ next?: string }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);
  const t = await getTranslations("auth");
  const next = safeInternalPath((await searchParams).next);

  if (await getSession()) redirect(next ?? "/cuenta");

  return (
    <>
      <PageHero
        index="/01"
        kicker={t("login.kicker")}
        title={
          <>
            {t("login.titleLog")} <span className="text-accent">{t("login.titleIn")}</span>.
          </>
        }
        description={t("login.description")}
      />

      <section className="container-edge max-w-md py-16 md:py-20">
        <LoginForm next={next ?? undefined} />
      </section>
    </>
  );
}
