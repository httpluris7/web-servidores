import type { Plan } from "@/data/products";
import { PlanCard, type SpecLabels } from "@/components/ui/PlanCard";
import { Reveal } from "@/components/ui/Reveal";
import { SectionHeader } from "@/components/ui/SectionHeader";

type Props = {
  index: string;
  kicker: string;
  title: string;
  description?: string;
  plans: Plan[];
  /** Reetiqueta las filas de specs (hosting: sitios/almacenamiento/correo/BBDD). */
  specLabels?: SpecLabels;
};

/** Grid de planes reutilizable por VPS regional, dedicados y hosting. */
export function PlanGrid({ index, kicker, title, description, plans, specLabels }: Props) {
  return (
    <section className="container-edge py-14 md:py-24">
      <SectionHeader index={index} kicker={kicker} title={title} description={description} />
      <div className="mt-12 grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
        {plans.map((p, i) => (
          <Reveal key={p.id} delay={i}>
            <PlanCard plan={p} specLabels={specLabels} />
          </Reveal>
        ))}
      </div>
    </section>
  );
}
