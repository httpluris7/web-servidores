import { useTranslations } from "next-intl";
import type { PowerState } from "@/lib/panel/types";
import { Icon } from "./icons";
import { POWER_ACTIONS } from "./nav";
import { ACTION_TILE, ACTION_TILE_DANGER, CARD_PAD, SECTION_INDEX } from "./ui";

/**
 * Rejilla "Acciones del servicio": energía y operaciones frecuentes. Cada
 * tarjeta se deshabilita (en gris) cuando la acción no aplica al estado de
 * energía actual — p. ej. "Arrancar" con la máquina ya encendida.
 *
 * FASE 1: presentacional. Los botones aún no llaman a nada; en la Fase 3 se
 * cablean al BFF con el sistema de tareas asíncronas (UPID + polling).
 */
export function PowerActions({ power }: { power: PowerState }) {
  const t = useTranslations("panel");
  return (
    <section id="acciones" className={`${CARD_PAD} scroll-mt-28`}>
      <p className={SECTION_INDEX}>/02</p>
      <h2 className="mt-2 text-lg font-semibold">{t("power.heading")}</h2>
      <p className="mt-1 mb-5 text-sm text-[var(--color-fg-muted)]">{t("power.intro")}</p>

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
        {POWER_ACTIONS.map((a) => {
          const enabled = a.enabledWhen.includes(power);
          return (
            <button
              key={a.key}
              type="button"
              disabled={!enabled}
              className={a.danger ? ACTION_TILE_DANGER : ACTION_TILE}
            >
              <Icon name={a.icon} size={20} />
              <span className="text-sm font-medium">{t(`power.${a.key}`)}</span>
            </button>
          );
        })}
      </div>
    </section>
  );
}
