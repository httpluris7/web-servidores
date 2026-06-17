import type { Metadata } from "next";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { site } from "@/data/site";
import { PageHero } from "@/components/ui/PageHero";
import { CartView } from "@/components/cart/CartView";
import { getSession } from "@/lib/session";
import { getPublicUserById } from "@/lib/auth";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>;
}): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "auth" });
  return {
    title: t("cart.metaTitle"),
    description: t("cart.metaDescription", { brand: site.brand }),
    robots: { index: false, follow: false },
  };
}

// Lee la cookie de sesión para decidir el estado del checkout: nunca cachear.
export const dynamic = "force-dynamic";

export default async function CarritoPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);
  const t = await getTranslations("auth");

  // Resolvemos la sesión en servidor para que el carrito sepa desde el primer
  // render si puede completar el pedido o debe pedir registro (sin parpadeo).
  const session = await getSession();
  const user = session ? await getPublicUserById(session.uid) : null;
  const initialUser = user ? { nombre: user.nombre, email: user.email } : null;

  return (
    <>
      <PageHero
        index="/ Cart"
        kicker={t("cart.kicker")}
        title={
          <>
            {t("cart.titleShopping")} <span className="text-accent">{t("cart.titleCart")}</span>.
          </>
        }
        description={t("cart.description")}
      />

      <section className="container-edge py-16 md:py-20">
        <CartView initialUser={initialUser} />
      </section>
    </>
  );
}
