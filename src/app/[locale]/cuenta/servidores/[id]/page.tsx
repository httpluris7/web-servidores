import type { Metadata } from "next";
import { notFound, redirect } from "next/navigation";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { site } from "@/data/site";
import { Link } from "@/i18n/navigation";
import { PageHero } from "@/components/ui/PageHero";
import { ServerPanel } from "@/components/cuenta/ServerPanel";
import { getSession } from "@/lib/session";
import { getServerForUser } from "@/lib/servidores/cliente";
import {
  listServerLimits,
  listSnapshots,
  type ProviderSnapshot,
  type ServerLimit,
} from "@/lib/servidores/v4vm";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>;
}): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "auth" });
  return {
    title: t("serverDetail.metaTitle"),
    description: t("serverDetail.metaDescription", { brand: site.brand }),
    robots: { index: false, follow: false },
  };
}

export const dynamic = "force-dynamic";

export default async function ServidorClientePage({
  params,
}: {
  params: Promise<{ locale: string; id: string }>;
}) {
  const { locale, id } = await params;
  setRequestLocale(locale);
  const t = await getTranslations("auth");

  const session = await getSession();
  if (!session) redirect("/acceder");

  // Un servidor ajeno responde igual que uno inexistente.
  const found = await getServerForUser(id, session.uid);
  if (!found) notFound();

  // Instantáneas y límites son opcionales: si el proveedor no los da, la
  // pantalla funciona igual y simplemente no se muestran.
  let snapshots: ProviderSnapshot[] = [];
  let limits: ServerLimit[] = [];
  try {
    [snapshots, limits] = await Promise.all([
      listSnapshots(found.cfg, found.managed.remoteId),
      listServerLimits(found.cfg, found.managed.remoteId),
    ]);
  } catch {
    // Sin bloquear la pantalla por un extra.
  }

  const nombre = found.managed.etiqueta || found.remote.name;

  return (
    <>
      <PageHero
        index="/03"
        kicker={t("serverDetail.kicker")}
        title={<span className="text-accent break-words">{nombre}</span>}
        description={t("serverDetail.description")}
      />

      <section className="container-edge max-w-3xl py-16 md:py-20">
        <p className="mb-6 text-sm text-[var(--color-fg-muted)]">
          <Link href="/cuenta/servidores" className="text-[var(--color-accent)] hover:underline">
            {t("serverDetail.backToServers")}
          </Link>
        </p>

        <ServerPanel
          id={found.managed.id}
          initialServer={found.remote}
          initialSnapshots={snapshots}
          initialLimits={limits}
        />

        <p className="mt-8 text-xs text-[var(--color-fg-dim)]">{t("serverDetail.supportNote")}</p>
      </section>
    </>
  );
}
