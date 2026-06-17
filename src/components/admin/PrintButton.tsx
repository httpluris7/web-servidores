"use client";

import { useTranslations } from "next-intl";

/** Botón que abre el diálogo de impresión del navegador (Imprimir → Guardar como PDF). */
export function PrintButton() {
  const t = useTranslations("admin");
  return (
    <button
      type="button"
      onClick={() => window.print()}
      className="inline-flex items-center gap-2 rounded-[var(--radius-md)] bg-[var(--color-accent)] px-4 py-2 text-sm font-medium text-black transition-all hover:bg-[var(--color-accent-dim)]"
    >
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} className="h-4 w-4" aria-hidden="true">
        <path d="M6 9V3h12v6M6 18H4a2 2 0 0 1-2-2v-4a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v4a2 2 0 0 1-2 2h-2" strokeLinecap="round" strokeLinejoin="round" />
        <path d="M6 14h12v7H6z" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
      {t("printButton.printSavePdf")}
    </button>
  );
}
