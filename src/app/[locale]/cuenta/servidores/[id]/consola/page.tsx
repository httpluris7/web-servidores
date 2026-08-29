import type { Metadata } from "next";
import { notFound, redirect } from "next/navigation";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { Link } from "@/i18n/navigation";
import { PageHero } from "@/components/ui/PageHero";
import { ConsoleView } from "@/components/cuenta/ConsoleView";
import { getSession } from "@/lib/session";
import { getManagedForUser } from "@/lib/servidores/cliente";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>;
}): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "auth" });
  return {
    title: t("serverDetail.consoleMetaTitle"),
    robots: { index: false, follow: false },
  };
}

export const dynamic = "force-dynamic";

export default async function ConsolaPage({
  params,
}: {
  params: Promise<{ locale: string; id: string }>;
}) {
  const { locale, id } = await params;
  setRequestLocale(locale);
  const t = await getTranslations("auth");

  const session = await getSession();
  if (!session) redirect("/acceder");

  // Solo VPS de nuestro Proxmox tienen consola noVNC; el resto no existe aquí.
  const ficha = await getManagedForUser(id, session.uid);
  if (!ficha || ficha.proveedor !== "proxmox") notFound();

  const nombre = ficha.etiqueta || ficha.host;

  return (
    <>
      <PageHero
        index="/03"
        kicker={t("serverDetail.kicker")}
        title={<span className="text-accent break-words">{nombre}</span>}
        description={t("serverDetail.consolePageIntro")}
      />

      <section className="container-edge max-w-5xl py-12 md:py-16">
        <p className="mb-6 text-sm text-[var(--color-fg-muted)]">
          <Link
            href={`/cuenta/servidores/${id}`}
            className="text-[var(--color-accent)] hover:underline"
          >
            {t("serverDetail.consoleBack")}
          </Link>
        </p>

        <ConsoleView id={id} />
      </section>
    </>
  );
}
