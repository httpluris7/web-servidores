import type { Metadata } from "next";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { site } from "@/data/site";
import { Link } from "@/i18n/navigation";
import { PageHero } from "@/components/ui/PageHero";
import { NewPasswordForm } from "@/components/forms/NewPasswordForm";
import { resetTokenIsUsable } from "@/lib/reset-tokens";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>;
}): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "auth" });
  return {
    title: t("reset.metaTitle"),
    description: t("reset.metaDescription", { brand: site.brand }),
    robots: { index: false, follow: false },
  };
}

// El token llega por query y se comprueba contra el almacén: nunca cachear.
export const dynamic = "force-dynamic";

export default async function RestablecerPage({
  params,
  searchParams,
}: {
  params: Promise<{ locale: string }>;
  searchParams: Promise<{ token?: string }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);
  const t = await getTranslations("auth");

  const token = (await searchParams).token ?? "";
  // Se comprueba antes de pintar para no pedirle una contraseña nueva a alguien
  // cuyo enlace ya no sirve. No se consume aquí: eso ocurre al enviar el form.
  const usable = token ? await resetTokenIsUsable(token) : false;

  return (
    <>
      <PageHero
        index="/01"
        kicker={t("reset.kicker")}
        title={
          <>
            {t("reset.titleA")} <span className="text-accent">{t("reset.titleB")}</span>.
          </>
        }
        description={t("reset.description")}
      />

      <section className="container-edge max-w-md py-16 md:py-20">
        {usable ? (
          <NewPasswordForm token={token} />
        ) : (
          <div className="rounded-[var(--radius-lg)] border border-[var(--color-line)] bg-[var(--color-bg-raised)] p-8">
            <h2 className="text-xl font-semibold">{t("newPasswordForm.expiredTitle")}</h2>
            <p className="mt-2 text-sm text-[var(--color-fg-muted)]">
              {t("newPasswordForm.expiredText")}
            </p>
            <Link
              href="/recuperar"
              className="mt-6 inline-flex items-center justify-center rounded-[var(--radius-md)] bg-[var(--color-accent)] px-6 py-3 text-sm font-medium text-black transition-colors hover:bg-[var(--color-accent-dim)]"
            >
              {t("newPasswordForm.requestAgain")}
            </Link>
          </div>
        )}
      </section>
    </>
  );
}
