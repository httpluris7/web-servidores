import type { Metadata } from "next";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { site } from "@/data/site";
import { Link } from "@/i18n/navigation";
import { PageHero } from "@/components/ui/PageHero";
import { VerifyEmail } from "@/components/forms/VerifyEmail";
import { peekVerifyToken } from "@/lib/verify-tokens";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>;
}): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "auth" });
  return {
    title: t("verify.metaTitle"),
    description: t("verify.metaDescription", { brand: site.brand }),
    robots: { index: false, follow: false },
  };
}

// Token por query: nunca cachear.
export const dynamic = "force-dynamic";

/** Destino del enlace de activación enviado al registrarse (vuln-0006). */
export default async function VerificarPage({
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
  const peek = token ? await peekVerifyToken(token) : { ok: false as const };

  return (
    <>
      <PageHero
        index="/01"
        kicker={t("verify.kicker")}
        title={
          <>
            {t("verify.titleA")} <span className="text-accent">{t("verify.titleB")}</span>.
          </>
        }
        description={t("verify.description")}
      />

      <section className="container-edge max-w-md py-16 md:py-20">
        {peek.ok ? (
          <VerifyEmail token={token} email={peek.email} />
        ) : (
          <div className="rounded-[var(--radius-lg)] border border-[var(--color-line)] bg-[var(--color-bg-raised)] p-8">
            <h2 className="text-xl font-semibold">{t("verify.expiredTitle")}</h2>
            <p className="mt-2 text-sm text-[var(--color-fg-muted)]">{t("verify.expiredText")}</p>
            <Link
              href="/acceder"
              className="mt-6 inline-flex items-center justify-center rounded-[var(--radius-md)] bg-[var(--color-accent)] px-6 py-3 text-sm font-medium text-black transition-colors hover:bg-[var(--color-accent-dim)]"
            >
              {t("verify.backToLogin")}
            </Link>
          </div>
        )}
      </section>
    </>
  );
}
