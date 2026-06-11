import { Reveal } from "./Reveal";

type Props = {
  index: string;
  kicker: string;
  title: React.ReactNode;
  description: string;
  children?: React.ReactNode;
};

/** Hero corto reutilizable para páginas internas. */
export function PageHero({ index, kicker, title, description, children }: Props) {
  return (
    <section className="relative overflow-hidden border-b border-[var(--color-line)]">
      <div className="pointer-events-none absolute inset-0 grid-lines opacity-40" aria-hidden="true" />
      <div className="container-edge relative py-14 md:py-28">
        <Reveal>
          <div className="flex items-center gap-3">
            <span className="font-mono text-sm text-[var(--color-accent)]">{index}</span>
            <span className="mono-label">{kicker}</span>
          </div>
          <h1 className="mt-6 max-w-4xl text-balance text-4xl font-semibold leading-[0.98] tracking-tight sm:text-5xl md:text-6xl">
            {title}
          </h1>
          <p className="mt-6 max-w-2xl text-lg text-[var(--color-fg-muted)]">{description}</p>
          {children && <div className="mt-8">{children}</div>}
        </Reveal>
      </div>
    </section>
  );
}
