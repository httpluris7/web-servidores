import { Suspense } from "react";
import type { Metadata } from "next";
import { notFound, redirect } from "next/navigation";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { getSession } from "@/lib/session";
import { getManagedForUser } from "@/lib/servidores/cliente";
import { getPanelServiceForUser, PanelUnavailableError } from "@/lib/panel/service";
import { ServiceHeader } from "@/components/panel/ServiceHeader";
import { ServiceActions } from "@/components/panel/ServiceActions";
import { ManagementGrid } from "@/components/panel/ManagementGrid";
import { InfoTable } from "@/components/panel/InfoTable";
import { IpTable } from "@/components/panel/IpTable";
import { GraficasSection } from "@/components/panel/GraficasSection";
import { SnapshotsSection } from "@/components/panel/SnapshotsSection";
import { BackupsSection } from "@/components/panel/BackupsSection";
import { TaskHistory } from "@/components/panel/TaskHistory";
import { PanelError, PanelSkeleton } from "@/components/panel/Skeletons";

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

  // Pertenencia ANTES del stream: un servicio ajeno, inexistente o que no sea de
  // nuestro Proxmox responde 404 con su status correcto (si se comprobara dentro
  // del Suspense, el stream ya habría enviado un 200). No habla con el proveedor:
  // solo lee nuestra propia ficha.
  const managed = await getManagedForUser(id, session.uid);
  if (!managed || managed.proveedor !== "proxmox") notFound();

  // Un único Suspense para la carga pesada (provisioner + agente + factura):
  // mientras llega, se muestra el skeleton completo.
  return (
    <Suspense fallback={<PanelSkeleton />}>
      <PanelContent id={id} userId={session.uid} locale={locale} />
    </Suspense>
  );
}

async function PanelContent({
  id,
  userId,
  locale,
}: {
  id: string;
  userId: string;
  locale: string;
}) {
  let service;
  try {
    service = await getPanelServiceForUser(id, userId, locale);
  } catch (err) {
    // Provisioner caído: el servicio existe, pero no se pudo leer ahora.
    if (err instanceof PanelUnavailableError) return <PanelError />;
    throw err;
  }
  // Ya comprobamos pertenencia + proxmox en la página; null aquí sería una
  // condición de carrera (ficha borrada entremedias): se trata como inexistente.
  if (!service) notFound();

  return (
    <>
      <ServiceHeader service={service} />
      <ServiceActions id={service.id} power={service.power} nombre={service.nombre} />
      <ManagementGrid />
      <InfoTable service={service} />
      <IpTable ips={service.ips} />
      <GraficasSection id={service.id} agenteActivo={service.agenteActivo} />
      <SnapshotsSection id={service.id} nombre={service.nombre} />
      <BackupsSection id={service.id} />
      <TaskHistory id={service.id} />
    </>
  );
}
