import { useTranslations } from "next-intl";
import { ConsoleView } from "@/components/cuenta/ConsoleView";
import { CARD_PAD, SECTION_INDEX } from "./ui";

/**
 * Sección "Consola noVNC" (Fase 5). Reutiliza `ConsoleView`, que pide un token
 * firmado + ticket VNC a `/api/cuenta/servidores/[id]/consola` (valida
 * pertenencia) y abre el websocket contra `/console-ws` (nginx → provisioner).
 * No conecta sola: espera a que el cliente pulse "Conectar", así abrir el panel
 * no abre una sesión VNC en cada visita.
 */
export function ConsolaSection({ id }: { id: string }) {
  const t = useTranslations("panel");
  return (
    <section id="consola" className={`${CARD_PAD} scroll-mt-28`}>
      <p className={SECTION_INDEX}>/10</p>
      <h2 className="mt-2 text-lg font-semibold">{t("consola.heading")}</h2>
      <p className="mt-1 mb-5 text-sm text-[var(--color-fg-muted)]">{t("consola.intro")}</p>
      <ConsoleView id={id} />
    </section>
  );
}
