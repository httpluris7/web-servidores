import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { allPlans, getPlanById, regions, vps } from "@/data/products";
import { PageHero } from "@/components/ui/PageHero";
import { OrderForm } from "@/components/forms/OrderForm";

type Params = { plan: string };

export function generateStaticParams(): Params[] {
  return allPlans.map((p) => ({ plan: p.plan.id }));
}

export async function generateMetadata({
  params,
}: {
  params: Promise<Params>;
}): Promise<Metadata> {
  const { plan: id } = await params;
  const located = getPlanById(id);
  if (!located) return {};
  return {
    title: `Contratar ${located.plan.name}`,
    description: `Despliega ${located.plan.name} (${located.lineTitle}) en 60 segundos. ${located.plan.cpu}, ${located.plan.ram}.`,
    alternates: { canonical: `/contratar/${id}` },
    robots: { index: false, follow: true },
  };
}

export default async function OrderPage({ params }: { params: Promise<Params> }) {
  const { plan: id } = await params;
  const located = getPlanById(id);
  if (!located) notFound();

  const isVps = located.lineSlug === vps.slug;

  return (
    <>
      <PageHero
        index="/ Checkout"
        kicker={`Contratar · ${located.lineTitle}`}
        title={
          <>
            Despliega tu <span className="text-accent">{located.plan.name}</span>.
          </>
        }
        description="Revisa la configuración, completa tus datos y confirma. El provisioning empieza en cuanto se confirma el pago."
      />

      <section className="container-edge py-16 md:py-20">
        <OrderForm
          plan={located.plan}
          lineTitle={located.lineTitle}
          regions={isVps ? regions : undefined}
        />

        <p className="mt-10 text-sm text-[var(--color-fg-muted)]">
          ¿Prefieres otra configuración?{" "}
          <Link href="/desplegar" className="text-[var(--color-accent)] hover:underline">
            Ver todos los planes
          </Link>
          .
        </p>
      </section>
    </>
  );
}
