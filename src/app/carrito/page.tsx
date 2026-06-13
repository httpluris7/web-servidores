import type { Metadata } from "next";
import { site } from "@/data/site";
import { PageHero } from "@/components/ui/PageHero";
import { CartView } from "@/components/cart/CartView";
import { getSession } from "@/lib/session";
import { getPublicUserById } from "@/lib/auth";

export const metadata: Metadata = {
  title: "Cart",
  description: `Review your cart and complete your order at ${site.brand}.`,
  robots: { index: false, follow: false },
};

// Lee la cookie de sesión para decidir el estado del checkout: nunca cachear.
export const dynamic = "force-dynamic";

export default async function CarritoPage() {
  // Resolvemos la sesión en servidor para que el carrito sepa desde el primer
  // render si puede completar el pedido o debe pedir registro (sin parpadeo).
  const session = await getSession();
  const user = session ? await getPublicUserById(session.uid) : null;
  const initialUser = user ? { nombre: user.nombre, email: user.email } : null;

  return (
    <>
      <PageHero
        index="/ Cart"
        kicker="Your order"
        title={
          <>
            Shopping <span className="text-accent">cart</span>.
          </>
        }
        description="Review the plans you've selected, adjust quantities and complete your order."
      />

      <section className="container-edge py-16 md:py-20">
        <CartView initialUser={initialUser} />
      </section>
    </>
  );
}
