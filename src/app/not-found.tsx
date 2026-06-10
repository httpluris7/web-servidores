import Link from "next/link";

export default function NotFound() {
  return (
    <section className="relative flex min-h-[80vh] items-center overflow-hidden">
      <div className="pointer-events-none absolute inset-0 grid-lines opacity-40" aria-hidden="true" />
      <div className="container-edge relative">
        <span className="mono-label">Error 404</span>
        <h1 className="mt-6 font-mono text-5xl font-semibold tracking-tight text-[var(--color-accent)] sm:text-6xl md:text-7xl">
          host not found
        </h1>
        <p className="mt-6 max-w-md text-lg text-[var(--color-fg-muted)]">
          La ruta que buscas no resuelve a ningún recurso. Puede que el enlace haya cambiado o que
          el servidor nunca existiera.
        </p>

        <div className="mt-8 max-w-md rounded-[var(--radius-md)] border border-[var(--color-line)] bg-[#070b12] p-4 font-mono text-sm">
          <span className="text-[var(--color-accent)]">$</span>{" "}
          <span className="text-[var(--color-fg-muted)]">curl https://nodara.eu/&lt;ruta&gt;</span>
          <br />
          <span className="text-[var(--color-danger)]">↳ 404 · no route to resource</span>
        </div>

        <div className="mt-10 flex flex-wrap gap-3">
          <Link
            href="/"
            className="inline-flex items-center rounded-[var(--radius-md)] bg-[var(--color-accent)] px-5 py-3 text-sm font-medium text-black transition-colors hover:bg-[var(--color-accent-dim)]"
          >
            Volver al inicio →
          </Link>
          <Link
            href="/vps"
            className="inline-flex items-center rounded-[var(--radius-md)] border border-[var(--color-line-strong)] px-5 py-3 text-sm transition-colors hover:border-[var(--color-accent)] hover:text-[var(--color-accent)]"
          >
            Ver productos
          </Link>
        </div>
      </div>
    </section>
  );
}
