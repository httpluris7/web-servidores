import type { Plan } from "@/data/products";
import { PlanCard } from "@/components/ui/PlanCard";
import { Reveal } from "@/components/ui/Reveal";
import { SectionHeader } from "@/components/ui/SectionHeader";

type Props = {
  index: string;
  kicker: string;
  title: string;
  description?: string;
  plans: Plan[];
};

/** Grid de planes reutilizable por VPS regional y dedicados. */
export function PlanGrid({ index, kicker, title, description, plans }: Props) {
  return (
    <section className="container-edge py-20 md:py-24">
      <SectionHeader index={index} kicker={kicker} title={title} description={description} />
      <div className="mt-12 grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
        {plans.map((p, i) => (
          <Reveal key={p.id} delay={i}>
            <PlanCard plan={p} />
          </Reveal>
        ))}
      </div>
    </section>
  );
}
