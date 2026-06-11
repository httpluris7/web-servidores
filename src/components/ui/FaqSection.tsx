import type { FAQItem } from "@/data/faq";
import { Accordion } from "./Accordion";
import { SectionHeader } from "./SectionHeader";

export function FaqSection({ items, index = "/0X" }: { items: FAQItem[]; index?: string }) {
  return (
    <section className="container-edge py-14 md:py-28">
      <SectionHeader index={index} kicker="Preguntas frecuentes" title="Lo que sueles preguntar." />
      <div className="mt-10 max-w-3xl">
        <Accordion items={items} />
      </div>
    </section>
  );
}
