import type { Metadata } from "next";
import { site } from "@/data/site";
import { PageHero } from "@/components/ui/PageHero";
import { ContactForm } from "@/components/forms/ContactForm";

export const metadata: Metadata = {
  title: "Contacto",
  description: `Habla con el equipo de ${site.brand}: ventas, soporte técnico o reportes de abuso. Respuesta media bajo 10 minutos en incidencias.`,
  alternates: { canonical: "/contacto" },
};

const channels = [
  { label: "Ventas", value: site.contact.sales, note: "Presupuestos y configuraciones a medida" },
  { label: "Soporte", value: site.contact.support, note: "Clientes con servicio activo" },
  { label: "Abuse", value: site.contact.abuse, note: "Reportes de uso indebido" },
];

export default function ContactPage() {
  return (
    <>
      <PageHero
        index="/01"
        kicker="Contacto"
        title={
          <>
            Hablemos. <span className="text-accent">De verdad</span>.
          </>
        }
        description="Personas reales al otro lado, 24/7. Escríbenos por el formulario o directamente al canal que mejor encaje."
      />

      <section className="container-edge grid gap-12 py-16 md:grid-cols-[1fr_320px] md:py-20">
        <div>
          <ContactForm />
        </div>

        <aside className="space-y-6">
          <div>
            <span className="mono-label">Canales directos</span>
            <ul className="mt-4 space-y-4">
              {channels.map((c) => (
                <li key={c.label} className="rounded-[var(--radius-md)] border border-[var(--color-line)] p-4">
                  <span className="mono-label text-[0.65rem]">{c.label}</span>
                  <a
                    href={`mailto:${c.value}`}
                    className="mt-1 block font-mono text-sm text-[var(--color-accent)] hover:underline"
                  >
                    {c.value}
                  </a>
                  <p className="mt-1 text-xs text-[var(--color-fg-muted)]">{c.note}</p>
                </li>
              ))}
            </ul>
          </div>

          <div className="rounded-[var(--radius-md)] border border-[var(--color-line)] p-4">
            <span className="mono-label text-[0.65rem]">Estado del servicio</span>
            <p className="mt-2 text-sm text-[var(--color-fg-muted)]">
              Consulta incidencias y mantenimientos en tiempo real.
            </p>
            <a href="/estado" className="mt-2 inline-block font-mono text-sm text-[var(--color-accent)] hover:underline">
              Ver estado →
            </a>
          </div>
        </aside>
      </section>
    </>
  );
}
