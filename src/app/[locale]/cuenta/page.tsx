import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { site } from "@/data/site";
import { PageHero } from "@/components/ui/PageHero";
import { LogoutButton } from "@/components/forms/LogoutButton";
import { ChangePasswordForm } from "@/components/forms/ChangePasswordForm";
import { getSession } from "@/lib/session";
import { getPublicUserById } from "@/lib/auth";
import { listInvoicesByUser } from "@/lib/facturas";
import { listServersForUser } from "@/lib/servidores/cliente";
import { Link } from "@/i18n/navigation";

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

  const facturas = await listInvoicesByUser(user.id, user.email);
  const pendientes = facturas.filter((f) => f.estado === "pendiente").length;

  // Un fallo del proveedor no debe tumbar la portada de la cuenta: sin
  // servidores legibles, simplemente no se muestra la sección.
  const servidores = await listServersForUser(user.id).catch(() => []);

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

        {/* Facturas: el cliente entra aquí a ver y pagar lo que tiene emitido. */}
        <section className="mt-12 border-t border-[var(--color-line)] pt-10">
          <h2 className="mono-label mb-1">{t("account.invoicesHeading")}</h2>
          <p className="mb-5 text-sm text-[var(--color-fg-muted)]">
            {pendientes > 0
              ? t("account.invoicesPending", { count: pendientes })
              : t("account.invoicesIntro")}
          </p>
          <Link
            href="/cuenta/facturas"
            className="inline-flex min-h-11 items-center justify-center rounded-[var(--radius-md)] bg-[var(--color-accent)] px-6 text-sm font-medium text-black transition-colors hover:bg-[var(--color-accent-dim)]"
          >
            {t("account.invoicesLink")}
            {facturas.length > 0 ? ` (${facturas.length})` : ""}
          </Link>
        </section>

        {/* Servidores: solo aparece si el cliente tiene alguno asignado. */}
        {servidores.length > 0 && (
          <section className="mt-12 border-t border-[var(--color-line)] pt-10">
            <h2 className="mono-label mb-1">{t("account.serversHeading")}</h2>
            <p className="mb-5 text-sm text-[var(--color-fg-muted)]">
              {t("account.serversIntro")}
            </p>
            <Link
              href="/cuenta/servidores"
              className="inline-flex min-h-11 items-center justify-center rounded-[var(--radius-md)] border border-[var(--color-line-strong)] px-6 text-sm transition-colors hover:border-[var(--color-accent)] hover:text-[var(--color-accent)]"
            >
              {t("account.serversLink")} ({servidores.length})
            </Link>
          </section>
        )}

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
