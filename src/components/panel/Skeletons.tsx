import { useTranslations } from "next-intl";
import { CARD, CARD_PAD } from "./ui";

/** Barra gris que pulsa, del alto indicado. */
function Bar({ w = "100%", h = "0.9rem" }: { w?: string; h?: string }) {
  return (
    <span
      className="block animate-pulse rounded bg-[var(--color-bg-overlay)]"
      style={{ width: w, height: h }}
    />
  );
}

/** Skeleton de la tabla "Información" (fallback de Suspense, sin spinner). */
export function InfoSkeleton() {
  return (
    <section className={`${CARD} scroll-mt-28`} aria-hidden="true">
      <div className="px-6 pt-6">
        <Bar w="3rem" h="0.7rem" />
        <div className="mt-3">
          <Bar w="9rem" h="1.1rem" />
        </div>
      </div>
      <div className="mt-4">
        {Array.from({ length: 9 }).map((_, i) => (
          <div
            key={i}
            className="grid grid-cols-1 gap-2 border-t border-[var(--color-line)] px-6 py-4 first:border-0 sm:grid-cols-[minmax(9rem,14rem)_1fr] sm:items-center sm:gap-4"
          >
            <Bar w="6rem" h="0.7rem" />
            <Bar w={`${40 + ((i * 13) % 45)}%`} />
          </div>
        ))}
      </div>
    </section>
  );
}

/** Skeleton de la cabecera del servicio. */
export function HeaderSkeleton() {
  return (
    <section className={CARD_PAD} aria-hidden="true">
      <div className="flex flex-col gap-6 lg:flex-row lg:items-start lg:justify-between">
        <div className="space-y-3">
          <Bar w="5rem" h="0.7rem" />
          <Bar w="12rem" h="1.4rem" />
          <Bar w="8rem" h="1.1rem" />
        </div>
        <div className="grid grid-cols-2 gap-x-8 gap-y-4 sm:grid-cols-4 lg:min-w-[26rem]">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="space-y-2">
              <Bar w="4rem" h="0.6rem" />
              <Bar w="5rem" />
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

/** Skeleton del panel completo (cabecera + información + IPs). */
export function PanelSkeleton() {
  return (
    <>
      <HeaderSkeleton />
      <InfoSkeleton />
      <IpSkeleton />
    </>
  );
}

/**
 * Aviso cuando el servidor de aprovisionamiento no responde: mejor decirlo que
 * pintar una ficha a medias. El servicio existe; solo no se pudo leer ahora.
 */
export function PanelError() {
  const t = useTranslations("panel");
  return (
    <section className={`${CARD_PAD} border-[var(--color-danger)]/30`}>
      <h2 className="text-lg font-semibold text-[var(--color-danger)]">{t("error.title")}</h2>
      <p className="mt-2 text-sm text-[var(--color-fg-muted)]">{t("error.body")}</p>
    </section>
  );
}

/** Skeleton de la tabla de IPs. */
export function IpSkeleton() {
  return (
    <section className={`${CARD} scroll-mt-28`} aria-hidden="true">
      <div className="px-6 pt-6">
        <Bar w="3rem" h="0.7rem" />
        <div className="mt-3">
          <Bar w="6rem" h="1.1rem" />
        </div>
      </div>
      <div className="mt-6 space-y-4 px-6 pb-6">
        {Array.from({ length: 2 }).map((_, i) => (
          <Bar key={i} h="1.4rem" />
        ))}
      </div>
    </section>
  );
}
