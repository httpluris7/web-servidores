import { CARD } from "./ui";

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
