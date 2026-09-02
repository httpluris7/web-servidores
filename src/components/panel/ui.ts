/** Clases compartidas del panel (mismos tokens que el resto del sitio). */

export const CARD =
  "rounded-[var(--radius-lg)] border border-[var(--color-line)] bg-[var(--color-bg-raised)] min-w-0";

export const CARD_PAD = `${CARD} p-6`;

/** Base común de las tarjetas de acción (sin el color de hover). */
const ACTION_TILE_BASE =
  "group flex flex-col items-start gap-3 rounded-[var(--radius-md)] border border-[var(--color-line-strong)] bg-[var(--color-bg-base)] p-4 text-left transition-colors " +
  "disabled:cursor-not-allowed disabled:opacity-35 disabled:hover:border-[var(--color-line-strong)] disabled:hover:text-inherit";

/** Tarjeta de acción normal: hover con el acento verde. */
export const ACTION_TILE = `${ACTION_TILE_BASE} hover:border-[var(--color-accent)] hover:text-[var(--color-accent)]`;

/** Tarjeta de acción destructiva: hover con el rojo de peligro. */
export const ACTION_TILE_DANGER = `${ACTION_TILE_BASE} hover:border-[var(--color-danger)] hover:text-[var(--color-danger)]`;

/** Kicker mono con numeración /01 /02, como en la landing. */
export const SECTION_INDEX = "mono-label text-[0.7rem] text-[var(--color-accent)]";
