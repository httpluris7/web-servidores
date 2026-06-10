import type { Metadata } from "next";
import Link from "next/link";
import { site } from "@/data/site";
import { vpsFaq, dedicatedFaq } from "@/data/faq";
import { PageHero } from "@/components/ui/PageHero";
import { Accordion } from "@/components/ui/Accordion";
import { SectionHeader } from "@/components/ui/SectionHeader";
import { Reveal } from "@/components/ui/Reveal";

export const metadata: Metadata = {
  title: "Soporte",
  description: `Centro de ayuda de ${site.brand}: guías rápidas, preguntas frecuentes, estado del servicio y contacto con ingeniería 24/7.`,
  alternates: { canonical: "/soporte" },
};

const quickLinks = [
  { href: "/estado", title: "Estado del servicio", desc: "Incidencias y mantenimientos en tiempo real.", arrow: "→" },
  { href: "/contacto", title: "Abrir una consulta", desc: "Ventas, soporte técnico o abuse.", arrow: "→" },
  { href: "/desplegar", title: "Desplegar un servidor", desc: "Elige plan y despliega en 60 s.", arrow: "→" },
];

const categories = [
  { title: "Primeros pasos", items: ["Acceso por SSH", "Reinstalar el sistema", "Claves y usuarios"] },
  { title: "Red y DNS", items: ["IPs y rDNS", "Apuntar tu dominio", "Reverse proxy"] },
  { title: "Seguridad", items: ["Protección DDoS", "Reglas de firewall", "Buenas prácticas"] },
  { title: "Facturación", items: ["Métodos de pago", "Cambiar de plan", "Cancelar servicio"] },
];

export default function SupportPage() {
  return (
    <>
      <PageHero
        index="/01"
        kicker="Centro de soporte"
        title={
          <>
            Ayuda <span className="text-accent">cuando</span> la necesitas.
          </>
        }
        description="Ingeniería de guardia 24/7 con respuesta media bajo 10 minutos en incidencias. Empieza por aquí."
      />

      {/* Accesos rápidos */}
      <section className="container-edge py-16 md:py-20">
        <div className="grid gap-4 md:grid-cols-3">
          {quickLinks.map((q, i) => (
            <Reveal key={q.href} delay={i}>
              <Link
                href={q.href}
                className="group flex h-full flex-col rounded-[var(--radius-lg)] border border-[var(--color-line)] bg-[var(--color-bg-raised)] p-6 transition-colors hover:border-[var(--color-accent)]"
              >
                <div className="flex items-center justify-between">
                  <h2 className="text-lg font-semibold">{q.title}</h2>
                  <span className="font-mono text-[var(--color-fg-dim)] transition-colors group-hover:text-[var(--color-accent)]">
                    {q.arrow}
                  </span>
                </div>
                <p className="mt-2 text-sm text-[var(--color-fg-muted)]">{q.desc}</p>
              </Link>
            </Reveal>
          ))}
        </div>
      </section>

      {/* Categorías de ayuda */}
      <section className="border-y border-[var(--color-line)] bg-[var(--color-bg-raised)]">
        <div className="container-edge py-16 md:py-20">
          <SectionHeader index="/02" kicker="Documentación" title="Explora por categoría." />
          <div className="mt-10 grid gap-px overflow-hidden rounded-[var(--radius-lg)] border border-[var(--color-line)] bg-[var(--color-line)] sm:grid-cols-2 lg:grid-cols-4">
            {categories.map((c) => (
              <div key={c.title} className="bg-[var(--color-bg-raised)] p-6">
                <h3 className="mono-label">{c.title}</h3>
                <ul className="mt-4 space-y-2 text-sm text-[var(--color-fg-muted)]">
                  {c.items.map((it) => (
                    // TODO: enlazar a artículos de documentación reales cuando existan.
                    <li key={it} className="flex items-start gap-2">
                      <span className="mt-0.5 text-[var(--color-accent)]">▸</span>
                      {it}
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* FAQ combinada */}
      <section className="container-edge py-16 md:py-20">
        <SectionHeader index="/03" kicker="Preguntas frecuentes" title="Las dudas más comunes." />
        <div className="mt-10 max-w-3xl">
          <Accordion items={[...vpsFaq, ...dedicatedFaq].slice(0, 8)} />
        </div>
        <p className="mt-8 text-sm text-[var(--color-fg-muted)]">
          ¿No encuentras lo que buscas?{" "}
          <Link href="/contacto" className="text-[var(--color-accent)] hover:underline">
            Escríbenos
          </Link>{" "}
          o consulta el{" "}
          <Link href="/estado" className="text-[var(--color-accent)] hover:underline">
            estado del servicio
          </Link>
          .
        </p>
      </section>
    </>
  );
}
