import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { site } from "@/data/site";
import { PageHero } from "@/components/ui/PageHero";
import { RegisterForm } from "@/components/forms/RegisterForm";
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
    title: t("register.metaTitle"),
    description: t("register.metaDescription", { brand: site.brand }),
    robots: { index: false, follow: false },
  };
}

export default async function RegistroPage({
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

  // Si ya hay sesión, no tiene sentido registrarse de nuevo: vamos a `next` o cuenta.
  if (await getSession()) redirect(next ?? "/cuenta");

  return (
    <>
      <PageHero
        index="/01"
        kicker={t("register.kicker")}
        title={
          <>
            {t("register.titleCreate")} <span className="text-accent">{t("register.titleAccount")}</span>.
          </>
        }
        description={t("register.description")}
      />

      <section className="container-edge max-w-2xl py-16 md:py-20">
        <RegisterForm next={next ?? undefined} />
      </section>
    </>
  );
}
