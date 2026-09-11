import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { site } from "@/data/site";
import { Link } from "@/i18n/navigation";
import { PageHero } from "@/components/ui/PageHero";
import { ConfirmEmailChange } from "@/components/forms/ConfirmEmailChange";
import { peekEmailChangeToken } from "@/lib/email-change-tokens";
import { getSession } from "@/lib/session";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>;
}): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "auth" });
  return {
    title: t("confirmEmail.metaTitle"),
    description: t("confirmEmail.metaDescription", { brand: site.brand }),
    robots: { index: false, follow: false },
  };
}

// Token por query + cookie de sesión: nunca cachear.
export const dynamic = "force-dynamic";

/**
 * Destino del enlace enviado al email nuevo. Exige estar dentro de la cuenta
 * que pidió el cambio: si no hay sesión, se manda a entrar y se vuelve aquí.
 */
export default async function ConfirmarEmailPage({
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

  const session = await getSession();
  if (!session) {
    const back = `/cuenta/email?token=${encodeURIComponent(token)}`;
    redirect(`/acceder?next=${encodeURIComponent(back)}`);
  }

  const peek = token ? await peekEmailChangeToken(token) : { ok: false as const };
  const usable = peek.ok && peek.userId === session.uid;

  return (
    <>
      <PageHero
        index="/01"
        kicker={t("confirmEmail.kicker")}
        title={
          <>
            {t("confirmEmail.titleA")} <span className="text-accent">{t("confirmEmail.titleB")}</span>.
          </>
        }
        description={t("confirmEmail.description")}
      />

      <section className="container-edge max-w-md py-16 md:py-20">
        {usable && peek.ok ? (
          <ConfirmEmailChange token={token} newEmail={peek.newEmail} />
        ) : (
          <div className="rounded-[var(--radius-lg)] border border-[var(--color-line)] bg-[var(--color-bg-raised)] p-8">
            <h2 className="text-xl font-semibold">{t("confirmEmail.expiredTitle")}</h2>
            <p className="mt-2 text-sm text-[var(--color-fg-muted)]">{t("confirmEmail.expiredText")}</p>
            <Link
              href="/cuenta"
              className="mt-6 inline-flex items-center justify-center rounded-[var(--radius-md)] bg-[var(--color-accent)] px-6 py-3 text-sm font-medium text-black transition-colors hover:bg-[var(--color-accent-dim)]"
            >
              {t("confirmEmail.backToAccount")}
            </Link>
          </div>
        )}
      </section>
    </>
  );
}
