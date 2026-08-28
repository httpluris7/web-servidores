import type { Metadata } from "next";
import { notFound, redirect } from "next/navigation";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { PageHero } from "@/components/ui/PageHero";
import { getSession } from "@/lib/session";
import { esDespliegueDeUsuario } from "@/lib/provisioner/despliegues";
import { getOrder } from "@/lib/provisioner/client";
import { DeploymentTracker } from "@/components/cuenta/DeploymentTracker";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>;
}): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "auth" });
  return {
    title: t("deployment.metaTitle"),
    description: t("deployment.metaDescription"),
    robots: { index: false, follow: false },
  };
}

export const dynamic = "force-dynamic";

export default async function DesplieguePage({
  params,
}: {
  params: Promise<{ locale: string; orderId: string }>;
}) {
  const { locale, orderId: raw } = await params;
  setRequestLocale(locale);
  const t = await getTranslations("auth");

  const session = await getSession();
  if (!session) redirect("/acceder");

  const orderId = Number(raw);
  if (!Number.isInteger(orderId) || orderId <= 0) notFound();

  // Un pedido ajeno se trata como inexistente.
  if (!(await esDespliegueDeUsuario(orderId, session.uid))) notFound();

  // Estado inicial para pintar sin esperar al primer sondeo. Si el provisioner
  // no responde ahora, arrancamos "en cola" y el sondeo del cliente lo corrige.
  let initial = { estado: "queued" as const, plan: null, os: null, ubicacion: null } as {
    estado: "queued" | "provisioning" | "active" | "failed" | "cancelled";
    plan: string | null;
    os: string | null;
    ubicacion: string | null;
  };
  try {
    const order = await getOrder(orderId);
    initial = {
      estado: order.estado,
      plan: order.plan ?? null,
      os: order.os ?? null,
      ubicacion: order.ubicacion ?? null,
    };
  } catch {
    // Se queda en "queued"; el tracker sondeará y actualizará.
  }

  return (
    <>
      <PageHero
        index="/04"
        kicker={t("deployment.heading")}
        title={<span className="text-accent break-words">{t("deployment.heading")}</span>}
        description={t("deployment.intro")}
      />
      <section className="container-edge max-w-3xl py-16 md:py-20">
        <DeploymentTracker orderId={orderId} initial={initial} />
      </section>
    </>
  );
}
