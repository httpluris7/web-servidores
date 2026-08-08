import type { Metadata } from "next";
import { notFound, redirect } from "next/navigation";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { site } from "@/data/site";
import { Link } from "@/i18n/navigation";
import { PageHero } from "@/components/ui/PageHero";
import { ServerPanel } from "@/components/cuenta/ServerPanel";
import { MetricasPanel } from "@/components/servidores/MetricasPanel";
import { getSession } from "@/lib/session";
import { getManagedForUser, getServerForUser } from "@/lib/servidores/cliente";
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
  const ficha = await getManagedForUser(id, session.uid);
  if (!ficha) notFound();

  // De una máquina externa no hay proveedor al que pedirle nada: la pantalla se
  // queda en las gráficas, que sí son nuestras.
  const found = ficha.proveedor === "v4vm" ? await getServerForUser(id, session.uid) : null;

  // Instantáneas y límites son opcionales: si el proveedor no los da, la
  // pantalla funciona igual y simplemente no se muestran.
  let snapshots: ProviderSnapshot[] = [];
  let limits: ServerLimit[] = [];
  if (found) {
    try {
      [snapshots, limits] = await Promise.all([
        listSnapshots(found.cfg, found.managed.remoteId),
        listServerLimits(found.cfg, found.managed.remoteId),
      ]);
    } catch {
      // Sin bloquear la pantalla por un extra.
    }
  }

  const nombre = ficha.etiqueta || found?.remote.name || ficha.host;

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

        {found && (
          <ServerPanel
            id={found.managed.id}
            initialServer={found.remote}
            initialSnapshots={snapshots}
            initialLimits={limits}
          />
        )}

        <div className={found ? "mt-10" : ""}>
          <MetricasPanel id={ficha.id} ambito="cuenta" />
        </div>

        <p className="mt-8 text-xs text-[var(--color-fg-dim)]">{t("serverDetail.supportNote")}</p>
      </section>
    </>
  );
}
