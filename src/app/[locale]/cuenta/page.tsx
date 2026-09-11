import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { site } from "@/data/site";
import { PageHero } from "@/components/ui/PageHero";
import { LogoutButton } from "@/components/forms/LogoutButton";
import { ChangePasswordForm } from "@/components/forms/ChangePasswordForm";
import { ProfileForm } from "@/components/forms/ProfileForm";
import { ChangeEmailForm } from "@/components/forms/ChangeEmailForm";
import { MfaSettings } from "@/components/forms/MfaSettings";
import { estadoMfa } from "@/lib/mfa";
import { isAdminEmail } from "@/lib/admin";
import { getSession } from "@/lib/session";
import { getPublicUserById } from "@/lib/auth";
import { listInvoicesByUser } from "@/lib/facturas";
import { listServersForUser } from "@/lib/servidores/cliente";
import { dominiosDeUsuario } from "@/lib/domains/intents";
import { hostingDeUsuario } from "@/lib/hosting/intents";
import { listTicketsByUser, ticketsAbiertos } from "@/lib/tickets";
import { desplieguesDeUsuario } from "@/lib/provisioner/despliegues";
import { getOrder } from "@/lib/provisioner/client";
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

export default async function CuentaPage({
  params,
  searchParams,
}: {
  params: Promise<{ locale: string }>;
  searchParams: Promise<{ admin2fa?: string }>;
}) {
  const { locale } = await params;
  const admin2fa = (await searchParams).admin2fa === "1";
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
  const dominios = await dominiosDeUsuario(user.id).catch(() => []);
  const td = await getTranslations("dominios");
  const hosting = await hostingDeUsuario(user.id).catch(() => []);
  const th = await getTranslations("hosting");

  // Despliegues aún en marcha (VPS recién pagado que se está creando): se leen
  // del provisioner para poder enlazar al seguimiento en vivo. Best-effort.
  const despliegues = await desplieguesDeUsuario(user.id).catch(() => []);
  const enCurso = (
    await Promise.all(
      despliegues.map(async (d) => {
        try {
          const o = await getOrder(d.orderId);
          return o.estado === "queued" || o.estado === "provisioning"
            ? { orderId: d.orderId }
            : null;
        } catch {
          return null;
        }
      }),
    )
  ).filter((x): x is { orderId: number } => x !== null);

  const abiertos = ticketsAbiertos(await listTicketsByUser(user.id));

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
        {/* Datos del cliente: ficha con botón "Editar" que los convierte en formulario. */}
        <ProfileForm
          key={JSON.stringify(user)}
          user={{
            email: user.email,
            nombre: user.nombre,
            apellidos: user.apellidos,
            telefono: user.telefono,
            direccion: user.direccion,
            codigoPostal: user.codigoPostal,
            ciudad: user.ciudad,
            estado: user.estado,
            pais: user.pais,
          }}
        />

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

        {/* Despliegues en curso: un VPS recién pagado que se está creando. */}
        {enCurso.length > 0 && (
          <section className="mt-12 border-t border-[var(--color-line)] pt-10">
            <h2 className="mono-label mb-1">{t("account.deploymentsHeading")}</h2>
            <p className="mb-5 text-sm text-[var(--color-fg-muted)]">
              {t("account.deploymentsIntro")}
            </p>
            <div className="grid gap-3">
              {enCurso.map((d) => (
                <Link
                  key={d.orderId}
                  href={`/cuenta/despliegue/${d.orderId}`}
                  className="inline-flex min-h-11 items-center gap-3 rounded-[var(--radius-md)] border border-[var(--color-accent)] bg-[var(--color-bg-raised)] px-5 text-sm transition-colors hover:bg-[var(--color-bg)]"
                >
                  <span
                    aria-hidden
                    className="inline-block h-3.5 w-3.5 animate-spin rounded-full border-2 border-[var(--color-line-strong)] border-t-[var(--color-accent)]"
                  />
                  {t("account.deploymentsLink")}
                </Link>
              ))}
            </div>
          </section>
        )}

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

        {/* Dominios: solo aparece si el cliente tiene alguno registrado. */}
        {dominios.length > 0 && (
          <section className="mt-12 border-t border-[var(--color-line)] pt-10">
            <h2 className="mono-label mb-1">{td("mis.kicker")}</h2>
            <p className="mb-5 text-sm text-[var(--color-fg-muted)]">{td("mis.description")}</p>
            <Link
              href="/cuenta/dominios"
              className="inline-flex min-h-11 items-center justify-center rounded-[var(--radius-md)] border border-[var(--color-line-strong)] px-6 text-sm transition-colors hover:border-[var(--color-accent)] hover:text-[var(--color-accent)]"
            >
              {td("mis.title")} ({dominios.length})
            </Link>
          </section>
        )}

        {/* Hosting: solo aparece si el cliente tiene algún servicio de hosting. */}
        {hosting.length > 0 && (
          <section className="mt-12 border-t border-[var(--color-line)] pt-10">
            <h2 className="mono-label mb-1">{th("mis.kicker")}</h2>
            <p className="mb-5 text-sm text-[var(--color-fg-muted)]">{th("mis.description")}</p>
            <Link
              href="/cuenta/hosting"
              className="inline-flex min-h-11 items-center justify-center rounded-[var(--radius-md)] border border-[var(--color-line-strong)] px-6 text-sm transition-colors hover:border-[var(--color-accent)] hover:text-[var(--color-accent)]"
            >
              {th("mis.title")} ({hosting.length})
            </Link>
          </section>
        )}

        {/* Soporte: el cliente abre un ticket y lo sigue desde aquí. */}
        <section className="mt-12 border-t border-[var(--color-line)] pt-10">
          <h2 className="mono-label mb-1">{t("account.supportHeading")}</h2>
          <p className="mb-5 text-sm text-[var(--color-fg-muted)]">
            {abiertos > 0
              ? t("account.supportOpen", { count: abiertos })
              : t("account.supportIntro")}
          </p>
          <Link
            href="/cuenta/soporte"
            className="inline-flex min-h-11 items-center justify-center rounded-[var(--radius-md)] border border-[var(--color-line-strong)] px-6 text-sm transition-colors hover:border-[var(--color-accent)] hover:text-[var(--color-accent)]"
          >
            {t("account.supportLink")}
          </Link>
        </section>

        <section id="email" className="mt-12 scroll-mt-24 border-t border-[var(--color-line)] pt-10">
          <h2 className="mono-label mb-1">{t("account.emailHeading")}</h2>
          <p className="mb-6 text-sm text-[var(--color-fg-muted)]">
            {t("account.emailIntro", { email: user.email })}
          </p>
          <ChangeEmailForm currentEmail={user.email} locked={isAdminEmail(user.email)} />
        </section>

        <section className="mt-12 border-t border-[var(--color-line)] pt-10">
          <h2 className="mono-label mb-1">{t("account.securityHeading")}</h2>
          <p className="mb-6 text-sm text-[var(--color-fg-muted)]">
            {t("account.securityIntro")}
          </p>
          <ChangePasswordForm />
        </section>

        <section id="2fa" className="mt-12 scroll-mt-24 border-t border-[var(--color-line)] pt-10">
          <h2 className="mono-label mb-1">{t("mfa.heading")}</h2>
          <p className="mb-6 text-sm text-[var(--color-fg-muted)]">{t("mfa.intro")}</p>
          <MfaSettings
            initial={await estadoMfa(user.id)}
            forced={admin2fa || (isAdminEmail(user.email) && !(await estadoMfa(user.id)).enabled)}
          />
        </section>

        <div className="mt-8">
          <LogoutButton />
        </div>
      </section>
    </>
  );
}
