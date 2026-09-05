import type { LegalSection } from "./LegalLayout";

type Translator = {
  (key: string): string;
  raw: (key: string) => unknown;
};

const asList = (v: unknown): string[] =>
  Array.isArray(v) ? v.filter((x): x is string => typeof x === "string") : [];

/**
 * Convierte `legal.<doc>.sections.<key>` (heading + paragraphs + items? +
 * after?) en la estructura que pinta `LegalLayout`.
 */
export function legalSections(t: Translator, doc: string, keys: readonly string[]): LegalSection[] {
  return keys.map((key) => {
    const base = `${doc}.sections.${key}`;
    const raw = (t.raw(base) ?? {}) as Record<string, unknown>;
    return {
      heading: t(`${base}.heading`),
      paragraphs: asList(raw.paragraphs),
      items: raw.items ? asList(raw.items) : undefined,
      after: raw.after ? asList(raw.after) : undefined,
    };
  });
}
