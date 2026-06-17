import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { site } from "@/data/site";
import { PageHero } from "@/components/ui/PageHero";
import { LogoutButton } from "@/components/forms/LogoutButton";
import { ChangePasswordForm } from "@/components/forms/ChangePasswordForm";
import { getSession } from "@/lib/session";
import { getPublicUserById } from "@/lib/auth";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>;
}): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "auth" });
  return {
    title: t("account.metaTitle"),
    description: t("account.metaDescription", { brand: site.brand }),
    robots: { index: false, follow: false },
  };
}

// Lee la cookie de sesión: nunca debe cachearse de forma estática.
export const dynamic = "force-dynamic";

const fieldKeys = [
  "nombre",
  "apellidos",
  "email",
  "telefono",
  "direccion",
  "codigoPostal",
  "ciudad",
  "estado",
  "pais",
] as const;

export default async function CuentaPage({
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

  return (
    <>
      <PageHero
        index="/01"
        kicker={t("account.kicker")}
        title={
          <>
            {t("account.greeting")}, <span className="text-accent">{user.nombre}</span>.
          </>
        }
        description={t("account.description")}
      />

      <section className="container-edge max-w-2xl py-16 md:py-20">
        <dl className="grid gap-px overflow-hidden rounded-[var(--radius-lg)] border border-[var(--color-line)] bg-[var(--color-line)] sm:grid-cols-2">
          {fieldKeys.map((key) => (
            <div key={key} className="bg-[var(--color-bg-raised)] px-5 py-4">
              <dt className="mono-label text-[0.6rem]">{t(`account.fields.${key}`)}</dt>
              <dd className="mt-1 text-sm text-[var(--color-fg)] break-words">
                {(user as unknown as Record<string, string>)[key] || "—"}
              </dd>
            </div>
          ))}
        </dl>

        <section className="mt-12 border-t border-[var(--color-line)] pt-10">
          <h2 className="mono-label mb-1">{t("account.securityHeading")}</h2>
          <p className="mb-6 text-sm text-[var(--color-fg-muted)]">
            {t("account.securityIntro")}
          </p>
          <ChangePasswordForm />
        </section>

        <div className="mt-8">
          <LogoutButton />
        </div>
      </section>
    </>
  );
}
