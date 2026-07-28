import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { site } from "@/data/site";
import { PageHero } from "@/components/ui/PageHero";
import { ForgotPasswordForm } from "@/components/forms/ForgotPasswordForm";
import { getSession } from "@/lib/session";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>;
}): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "auth" });
  return {
    title: t("forgot.metaTitle"),
    description: t("forgot.metaDescription", { brand: site.brand }),
    robots: { index: false, follow: false },
  };
}

// Mira la cookie de sesión para no ofrecer recuperación a quien ya entró.
export const dynamic = "force-dynamic";

export default async function RecuperarPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);
  const t = await getTranslations("auth");

  // Con sesión abierta el sitio correcto para cambiarla es /cuenta.
  if (await getSession()) redirect("/cuenta");

  return (
    <>
      <PageHero
        index="/01"
        kicker={t("forgot.kicker")}
        title={
          <>
            {t("forgot.titleA")} <span className="text-accent">{t("forgot.titleB")}</span>.
          </>
        }
        description={t("forgot.description")}
      />

      <section className="container-edge max-w-md py-16 md:py-20">
        <ForgotPasswordForm />
      </section>
    </>
  );
}
