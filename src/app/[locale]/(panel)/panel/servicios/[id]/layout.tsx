import { redirect } from "next/navigation";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { Link } from "@/i18n/navigation";
import { getSession } from "@/lib/session";
import { Icon } from "@/components/panel/icons";
import { ServiceSidebar } from "@/components/panel/ServiceSidebar";

export const dynamic = "force-dynamic";

/**
 * Layout propio del panel de servicio: barra de vuelta + rejilla de dos
 * columnas (barra lateral de secciones | contenido). Protegido: sin sesión, a
 * la pantalla de acceso. La pertenencia del servicio se comprobará en la Fase 2,
 * cuando los datos dejen de ser simulados.
 */
export default async function PanelServicioLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);

  const session = await getSession();
  if (!session) redirect("/acceder");

  const t = await getTranslations("panel");

  return (
    <div className="container-edge max-w-6xl py-10 md:py-14">
      <Link
        href="/cuenta/servidores"
        className="inline-flex items-center gap-1.5 text-sm text-[var(--color-fg-muted)] transition-colors hover:text-[var(--color-accent)]"
      >
        <Icon name="arrowLeft" size={16} />
        {t("backTo")}
      </Link>

      <div className="mt-6 grid gap-8 lg:grid-cols-[16rem_minmax(0,1fr)]">
        <aside className="min-w-0">
          <ServiceSidebar />
        </aside>
        <div className="grid min-w-0 gap-6">{children}</div>
      </div>
    </div>
  );
}
