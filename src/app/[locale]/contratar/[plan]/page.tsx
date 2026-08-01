import type { Metadata } from "next";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { notFound } from "next/navigation";
import { Link } from "@/i18n/navigation";
import { getAllPlans, getCatalog } from "@/data/products";
import { PageHero } from "@/components/ui/PageHero";
import { OrderForm } from "@/components/forms/OrderForm";
import { stripeIsReady } from "@/lib/ajustes";

type Params = { locale: string; plan: string };

/**
 * Render dinámico: la página consulta si la pasarela está activa para decidir
 * si ofrece pago con tarjeta, y ese ajuste se cambia en caliente desde el panel.
 * Prerenderizarla congelaría el estado del build.
 */
export const dynamic = "force-dynamic";

export async function generateStaticParams(): Promise<{ plan: string }[]> {
  return (await getAllPlans()).map((p) => ({ plan: p.plan.id }));
}

export async function generateMetadata({
  params,
}: {
  params: Promise<Params>;
}): Promise<Metadata> {
  const { locale, plan: id } = await params;
  const located = (await getCatalog(locale)).allPlans.find((p) => p.plan.id === id);
  if (!located) return {};
  const t = await getTranslations({ locale, namespace: "products" });
  const lineTitle = located.lineTitle;
  return {
    title: t("order.meta.title", { name: located.plan.name }),
    description: t("order.meta.description", {
      name: located.plan.name,
      lineTitle,
      cpu: located.plan.cpu,
      ram: located.plan.ram,
    }),
    robots: { index: false, follow: true },
  };
}

export default async function OrderPage({ params }: { params: Promise<Params> }) {
  const { locale, plan: id } = await params;
  setRequestLocale(locale);
  const { allPlans, regions } = await getCatalog(locale);
  const located = allPlans.find((p) => p.plan.id === id);
  if (!located) notFound();

  const t = await getTranslations("products");
  const isVps = located.lineTipo === "vps";
  const lineTitle = located.lineTitle;

  return (
    <>
      <PageHero
        index="/ Checkout"
        kicker={t("order.kicker", { lineTitle })}
        title={
          <>
            {t("order.titleA")}
            <span className="text-accent">{located.plan.name}</span>
            {t("order.titleSuffix")}
          </>
        }
        description={t("order.description")}
      />

      <section className="container-edge py-16 md:py-20">
        <OrderForm
          plan={located.plan}
          lineTitle={lineTitle}
          regions={isVps ? regions : undefined}
          stripeEnabled={await stripeIsReady()}
        />

        <p className="mt-10 text-sm text-[var(--color-fg-muted)]">
          {t("order.preferDifferent")}{" "}
          <Link href="/desplegar" className="text-[var(--color-accent)] hover:underline">
            {t("order.viewAllPlans")}
          </Link>
          .
        </p>
      </section>
    </>
  );
}
