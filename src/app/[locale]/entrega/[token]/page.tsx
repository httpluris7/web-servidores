import type { Metadata } from "next";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { PageHero } from "@/components/ui/PageHero";
import { EntregaReveal } from "@/components/entrega/EntregaReveal";

type Params = { locale: string; token: string };

// El enlace es privado y de un solo uso: nunca debe indexarse ni prerenderizarse.
export const dynamic = "force-dynamic";

export async function generateMetadata({
  params,
}: {
  params: Promise<Params>;
}): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "delivery" });
  return { title: t("title"), robots: { index: false, follow: false } };
}

export default async function EntregaPage({ params }: { params: Promise<Params> }) {
  const { locale, token } = await params;
  setRequestLocale(locale);
  const t = await getTranslations("delivery");

  return (
    <>
      <PageHero index="/ Entrega" kicker={t("kicker")} title={t("title")} description={t("subtitle")} />
      <section className="container-edge py-16 md:py-20">
        <div className="mx-auto max-w-xl">
          <EntregaReveal token={token} />
        </div>
      </section>
    </>
  );
}
