import type { Metadata } from "next";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { notFound } from "next/navigation";
import { Link } from "@/i18n/navigation";
import { allPlans, getPlanById, regions, vps } from "@/data/products";
import { PageHero } from "@/components/ui/PageHero";
import { OrderForm } from "@/components/forms/OrderForm";

type Params = { locale: string; plan: string };

export function generateStaticParams(): { plan: string }[] {
  return allPlans.map((p) => ({ plan: p.plan.id }));
}

/** Resuelve el título traducido de la línea de producto del plan localizado. */
function lineTitleKey(lineSlug: string): string | null {
  if (lineSlug === vps.slug) return null; // "Cloud VPS" es nombre de producto, no se traduce
  return `dedicated.types.${lineSlug}.title`;
}

export async function generateMetadata({
  params,
}: {
  params: Promise<Params>;
}): Promise<Metadata> {
  const { locale, plan: id } = await params;
  const located = getPlanById(id);
  if (!located) return {};
  const t = await getTranslations({ locale, namespace: "products" });
  const key = lineTitleKey(located.lineSlug);
  const lineTitle = key ? t(key) : located.lineTitle;
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
  const located = getPlanById(id);
  if (!located) notFound();

  const t = await getTranslations("products");
  const isVps = located.lineSlug === vps.slug;
  const key = lineTitleKey(located.lineSlug);
  const lineTitle = key ? t(key) : located.lineTitle;

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
