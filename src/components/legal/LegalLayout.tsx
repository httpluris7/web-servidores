import { site } from "@/data/site";
import { PageHero } from "@/components/ui/PageHero";

export type LegalSection = {
  heading: string;
  /** Párrafos del apartado, en orden. */
  paragraphs: string[];
  /** Lista opcional (viñetas) que se muestra tras los párrafos. */
  items?: string[];
  /** Texto opcional de cierre, tras la lista. */
  after?: string[];
};

type Props = {
  index: string;
  kicker: string;
  title: string;
  intro: string;
  /** Etiqueta "Última actualización" ya traducida, con la fecha incluida. */
  updated: string;
  /** Texto de contacto ya traducido; `{email}` se sustituye por el buzón de soporte. */
  contact: string;
  sections: LegalSection[];
};

/**
 * Plantilla de las páginas legales: cabecera, fecha de revisión, apartados
 * numerados (párrafos + lista opcional) y bloque de contacto.
 */
export function LegalLayout({ index, kicker, title, intro, updated, contact, sections }: Props) {
  const [contactBefore, contactAfter = ""] = contact.split("{email}");
  return (
    <>
      <PageHero index={index} kicker={kicker} title={title} description={intro} />

      <article className="container-edge max-w-3xl py-16 md:py-20">
        <p className="font-mono text-xs text-[var(--color-fg-dim)]">
          {updated} · {site.legal.companyName}
        </p>

        <ol className="mt-12 space-y-10">
          {sections.map((s, i) => (
            <li key={s.heading} id={`s${i + 1}`}>
              <h2 className="flex items-baseline gap-3 text-xl font-semibold tracking-tight">
                <span className="font-mono text-sm text-[var(--color-accent)]">
                  {String(i + 1).padStart(2, "0")}
                </span>
                {s.heading}
              </h2>
              <div className="mt-3 space-y-3 text-[15px] leading-relaxed text-[var(--color-fg-muted)]">
                {s.paragraphs.map((p, j) => (
                  <p key={j}>{p}</p>
                ))}
                {s.items && s.items.length > 0 && (
                  <ul className="list-disc space-y-1.5 pl-5">
                    {s.items.map((it, j) => (
                      <li key={j}>{it}</li>
                    ))}
                  </ul>
                )}
                {s.after?.map((p, j) => (
                  <p key={`a${j}`}>{p}</p>
                ))}
              </div>
            </li>
          ))}
        </ol>

        <div className="mt-12 border-t border-[var(--color-line)] pt-6 text-sm text-[var(--color-fg-muted)]">
          {contactBefore}
          <a href={`mailto:${site.contact.support}`} className="text-[var(--color-accent)]">
            {site.contact.support}
          </a>
          {contactAfter}
        </div>
      </article>
    </>
  );
}
