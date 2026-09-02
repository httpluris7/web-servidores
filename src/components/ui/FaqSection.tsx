import { getTranslations } from "next-intl/server";
import type { FAQItem } from "@/data/faq";
import { Accordion } from "./Accordion";
import { SectionHeader } from "./SectionHeader";
import { JsonLd } from "@/components/seo/JsonLd";

export async function FaqSection({
  items,
  tKey,
  index = "/0X",
}: {
  items: FAQItem[];
  /** Clave de namespace "products" para traducir las preguntas/respuestas por índice. */
  tKey: "vpsFaq" | "dedicatedFaq";
  index?: string;
}) {
  const t = await getTranslations("products");
  const translated: FAQItem[] = items.map((_, i) => ({
    q: t(`${tKey}.${i}.q`),
    a: t(`${tKey}.${i}.a`),
  }));
  // FAQPage con las preguntas/respuestas ya traducidas: mismo contenido que se
  // ve en el acordeón (requisito de Google) y muy citable por los LLMs.
  const faqJsonLd = {
    "@context": "https://schema.org",
    "@type": "FAQPage",
    mainEntity: translated.map((it) => ({
      "@type": "Question",
      name: it.q,
      acceptedAnswer: { "@type": "Answer", text: it.a },
    })),
  };
  return (
    <section className="container-edge py-14 md:py-28">
      <JsonLd data={faqJsonLd} />
      <SectionHeader index={index} kicker={t("faq.kicker")} title={t("faq.title")} />
      <div className="mt-10 max-w-3xl">
        <Accordion items={translated} />
      </div>
    </section>
  );
}
