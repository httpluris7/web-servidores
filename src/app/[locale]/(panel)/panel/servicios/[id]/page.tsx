import { Suspense } from "react";
import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { getSession } from "@/lib/session";
import { loadServiceInfo, loadServiceIps, mockService } from "@/lib/panel/mock";
import { ServiceHeader } from "@/components/panel/ServiceHeader";
import { PowerActions } from "@/components/panel/PowerActions";
import { ManagementGrid } from "@/components/panel/ManagementGrid";
import { InfoTable } from "@/components/panel/InfoTable";
import { IpTable } from "@/components/panel/IpTable";
import { InfoSkeleton, IpSkeleton } from "@/components/panel/Skeletons";

export const dynamic = "force-dynamic";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>;
}): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "panel" });
  return { title: t("metaTitle"), robots: { index: false, follow: false } };
}

export default async function PanelServicioPage({
  params,
}: {
  params: Promise<{ locale: string; id: string }>;
}) {
  const { locale, id } = await params;
  setRequestLocale(locale);

  const session = await getSession();
  if (!session) redirect("/acceder");

  const t = await getTranslations("panel");
  // Cabecera, acciones y gestión: datos inmediatos (sin retardo simulado).
  const service = mockService(id);

  return (
    <>
      <p className="rounded-[var(--radius-md)] border border-dashed border-[var(--color-accent)]/40 bg-[var(--color-accent)]/5 px-4 py-2.5 text-xs text-[var(--color-fg-muted)]">
        {t("mockNote")}
      </p>

      <ServiceHeader service={service} />
      <PowerActions power={service.power} />
      <ManagementGrid />

      {/* Datos "cargados": Suspense con skeleton, sin spinner de página. */}
      <Suspense fallback={<InfoSkeleton />}>
        <InfoSection id={id} />
      </Suspense>
      <Suspense fallback={<IpSkeleton />}>
        <IpsSection id={id} />
      </Suspense>
    </>
  );
}

async function InfoSection({ id }: { id: string }) {
  const service = await loadServiceInfo(id);
  return <InfoTable service={service} />;
}

async function IpsSection({ id }: { id: string }) {
  const ips = await loadServiceIps(id);
  return <IpTable ips={ips} />;
}
