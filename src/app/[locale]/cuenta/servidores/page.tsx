import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { site } from "@/data/site";
import { Link } from "@/i18n/navigation";
import { PageHero } from "@/components/ui/PageHero";
import { ServerStatusBadge } from "@/components/ui/ServerStatusBadge";
import { getSession } from "@/lib/session";
import { listServersForUser, type ClientServer } from "@/lib/servidores/cliente";
import { ProviderError } from "@/lib/servidores/v4vm";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>;
}): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "auth" });
  return {
    title: t("servers.metaTitle"),
    description: t("servers.metaDescription", { brand: site.brand }),
    robots: { index: false, follow: false },
  };
}

export const dynamic = "force-dynamic";

export default async function ServidoresClientePage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);
  const t = await getTranslations("auth");

  const session = await getSession();
  if (!session) redirect("/acceder");

  // Si el proveedor falla, la pantalla lo dice en vez de reventar.
  let servidores: ClientServer[] = [];
  let error: string | null = null;
  try {
    servidores = await listServersForUser(session.uid);
  } catch (err) {
    error = err instanceof ProviderError ? t("servers.errorProvider") : t("servers.errorProvider");
  }

  return (
    <>
      <PageHero
        index="/03"
        kicker={t("servers.kicker")}
        title={
          <>
            {t("servers.titleA")} <span className="text-accent">{t("servers.titleB")}</span>
          </>
        }
        description={t("servers.description")}
      />

      <section className="container-edge max-w-3xl py-16 md:py-20">
        <p className="mb-6 text-sm text-[var(--color-fg-muted)]">
          <Link href="/cuenta" className="text-[var(--color-accent)] hover:underline">
            {t("servers.backToAccount")}
          </Link>
        </p>

        {error ? (
          <p role="alert" className="text-sm text-[var(--color-danger)]">
            {error}
          </p>
        ) : servidores.length === 0 ? (
          <p className="text-sm text-[var(--color-fg-muted)]">{t("servers.empty")}</p>
        ) : (
          <ul className="grid gap-4">
            {servidores.map(({ managed, remote }) => (
              <li key={managed.id}>
                <Link
                  href={`/cuenta/servidores/${managed.id}`}
                  className="block min-w-0 rounded-[var(--radius-lg)] border border-[var(--color-line)] bg-[var(--color-bg-raised)] p-5 transition-colors hover:border-[var(--color-accent)]"
                >
                  <div className="flex flex-wrap items-start justify-between gap-4">
                    <div className="min-w-0">
                      <p className="font-medium break-words text-[var(--color-fg)]">
                        {managed.etiqueta || remote?.name}
                      </p>
                      <p className="mt-1 font-mono text-xs break-words text-[var(--color-fg-muted)]">
                        {remote?.ipv4[0] ?? managed.host ?? "—"}
                      </p>
                    </div>
                    {/* Las máquinas externas no tienen proveedor al que
                        preguntarle el estado: sin insignia, en vez de una que
                        diría "desconocido" en todas. */}
                    {remote && (
                      <ServerStatusBadge status={remote.status} processing={remote.isProcessing} />
                    )}
                  </div>
                  {remote && (
                    <p className="mt-4 font-mono text-xs text-[var(--color-fg-dim)]">
                      {remote.vcpu ?? "—"} vCPU ·{" "}
                      {remote.ramMb ? Math.round(remote.ramMb / 1024) : "—"} GB ·{" "}
                      {remote.diskGb ?? "—"} GB · {remote.location ?? "—"}
                    </p>
                  )}
                </Link>
              </li>
            ))}
          </ul>
        )}
      </section>
    </>
  );
}
