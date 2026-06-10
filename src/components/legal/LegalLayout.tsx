import { site } from "@/data/site";
import { PageHero } from "@/components/ui/PageHero";

export type LegalSection = {
  heading: string;
  /** Qué debe redactar/aportar el abogado para esta sección. */
  todo: string;
};

type Props = {
  index: string;
  title: string;
  intro: string;
  updated: string; // fecha de última revisión (placeholder)
  sections: LegalSection[];
};

/**
 * Plantilla legal con estructura real (no lorem ipsum). Cada apartado indica
 * explícitamente qué debe rellenar el departamento legal antes de publicar.
 */
export function LegalLayout({ index, title, intro, updated, sections }: Props) {
  return (
    <>
      <PageHero index={index} kicker="Legal" title={title} description={intro} />

      <article className="container-edge max-w-3xl py-16 md:py-20">
        <p className="font-mono text-xs text-[var(--color-fg-dim)]">
          Última actualización: {updated} · {site.legal.companyName}
        </p>

        <div className="mt-4 rounded-[var(--radius-md)] border border-[var(--color-accent)]/40 bg-[var(--color-accent-glow)]/10 p-4 text-sm text-[var(--color-fg-muted)]">
          <strong className="text-[var(--color-accent)]">Aviso para el cliente:</strong> esta página
          es una plantilla estructurada. El contenido legal definitivo debe ser redactado o validado
          por un abogado. Cada apartado indica qué falta por rellenar.
        </div>

        <ol className="mt-12 space-y-10">
          {sections.map((s, i) => (
            <li key={s.heading}>
              <h2 className="flex items-baseline gap-3 text-xl font-semibold tracking-tight">
                <span className="font-mono text-sm text-[var(--color-accent)]">
                  {String(i + 1).padStart(2, "0")}
                </span>
                {s.heading}
              </h2>
              <p className="mt-3 rounded-[var(--radius-md)] border border-dashed border-[var(--color-line-strong)] bg-[var(--color-bg-raised)] p-4 font-mono text-sm text-[var(--color-fg-muted)]">
                TODO (legal): {s.todo}
              </p>
            </li>
          ))}
        </ol>

        <div className="mt-12 border-t border-[var(--color-line)] pt-6 text-sm text-[var(--color-fg-muted)]">
          Para cualquier consulta sobre esta política, escribe a{" "}
          <a href={`mailto:${site.contact.support}`} className="text-[var(--color-accent)]">
            {site.contact.support}
          </a>
          .
        </div>
      </article>
    </>
  );
}
