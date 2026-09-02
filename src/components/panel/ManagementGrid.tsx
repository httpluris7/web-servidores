import { useTranslations } from "next-intl";
import { Icon } from "./icons";
import { MANAGEMENT_TOOLS } from "./nav";
import { ACTION_TILE, CARD_PAD, SECTION_INDEX } from "./ui";

/**
 * Rejilla "Gestión del servicio": el resto de herramientas (copias, discos,
 * cortafuegos, red, consola, snapshots, historial de tareas…). Cada tarjeta es
 * la misma herramienta que aparece en la barra lateral (lista compartida en
 * `nav.ts`).
 *
 * FASE 1: cada herramienta se marca "pronto"; en fases siguientes abrirá su
 * propio panel.
 */
export function ManagementGrid() {
  const t = useTranslations("panel");
  return (
    <section id="gestion" className={`${CARD_PAD} scroll-mt-28`}>
      <p className={SECTION_INDEX}>/03</p>
      <h2 className="mt-2 text-lg font-semibold">{t("management.heading")}</h2>
      <p className="mt-1 mb-5 text-sm text-[var(--color-fg-muted)]">{t("management.intro")}</p>

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
        {MANAGEMENT_TOOLS.map((tool) => (
          <button key={tool.key} type="button" className={ACTION_TILE} disabled={tool.soon}>
            <span className="flex w-full items-center justify-between">
              <Icon name={tool.icon} size={20} />
              {tool.soon && (
                <span className="rounded-full border border-[var(--color-line-strong)] px-2 py-0.5 text-[0.6rem] uppercase tracking-wide text-[var(--color-fg-dim)]">
                  {t("management.soon")}
                </span>
              )}
            </span>
            <span className="text-sm font-medium">{t(`sidebar.items.${tool.key}`)}</span>
          </button>
        ))}
      </div>
    </section>
  );
}
