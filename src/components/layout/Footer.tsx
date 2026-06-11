import Link from "next/link";
import { site } from "@/data/site";
import { regions, dedicatedTypes } from "@/data/products";

const columns = [
  {
    title: "Productos",
    links: [
      { href: "/vps", label: "Cloud VPS" },
      ...dedicatedTypes.map((d) => ({ href: `/dedicados/${d.slug}`, label: d.title })),
      { href: "/proteccion-ddos", label: "Protección DDoS" },
    ],
  },
  {
    title: "Ubicaciones",
    links: regions.map((r) => ({ href: `/vps/${r.slug}`, label: `${r.flag} ${r.name}` })),
  },
  {
    title: "Recursos",
    links: [
      { href: "/estado", label: "Estado del servicio" },
      { href: "/soporte", label: "Centro de soporte" },
      { href: "/red", label: "Backbone y peering" },
      { href: "/casos-de-uso", label: "Casos de uso" },
    ],
  },
  {
    title: "Empresa",
    links: [
      { href: "/sobre-nosotros", label: "Sobre nosotros" },
      { href: "/contacto", label: "Contacto" },
      { href: "/legal/privacidad", label: "Privacidad" },
      { href: "/legal/terminos", label: "Términos" },
      { href: "/legal/cookies", label: "Cookies" },
    ],
  },
];

export function Footer() {
  return (
    <footer className="border-t border-[var(--color-line)] bg-[var(--color-bg-base)]">
      <div className="container-edge py-16">
        <div className="grid grid-cols-2 gap-x-6 gap-y-10 md:grid-cols-5 md:gap-10">
          {/* Marca */}
          <div className="col-span-2 md:col-span-1">
            <Link href="/" className="flex items-center gap-2">
              <span className="inline-block h-2 w-2 rounded-full bg-[var(--color-accent)]" />
              <span className="text-lg font-semibold">{site.brand}</span>
            </Link>
            <p className="mt-4 max-w-xs text-sm text-[var(--color-fg-muted)]">{site.tagline}</p>
            <p className="mt-4 font-mono text-xs text-[var(--color-fg-dim)]">
              {site.network.asn} · {site.domain}
            </p>
          </div>

          {columns.map((col) => (
            <div key={col.title}>
              <h2 className="mono-label mb-4">{col.title}</h2>
              <ul className="space-y-2.5">
                {col.links.map((l) => (
                  <li key={l.href + l.label}>
                    {"external" in l && l.external ? (
                      <a
                        href={l.href}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-sm text-[var(--color-fg-muted)] transition-colors hover:text-[var(--color-fg)]"
                      >
                        {l.label} ↗
                      </a>
                    ) : (
                      <Link
                        href={l.href}
                        className="text-sm text-[var(--color-fg-muted)] transition-colors hover:text-[var(--color-fg)]"
                      >
                        {l.label}
                      </Link>
                    )}
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>

        {/* Métodos de pago */}
        <div className="mt-12 flex flex-wrap items-center gap-2 border-t border-[var(--color-line)] pt-8">
          <span className="mono-label mr-2">Pago</span>
          {site.paymentMethods.map((m) => (
            <span
              key={m}
              className="rounded border border-[var(--color-line)] px-2.5 py-1 font-mono text-xs text-[var(--color-fg-muted)]"
            >
              {m}
            </span>
          ))}
          {site.legal.trustpilotUrl && (
            <a
              href={site.legal.trustpilotUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="ml-auto rounded border border-[var(--color-line)] px-2.5 py-1 font-mono text-xs text-[var(--color-accent)]"
            >
              ★ Trustpilot
            </a>
          )}
        </div>

        {/* Legal */}
        <div className="mt-8 flex flex-col gap-2 text-xs text-[var(--color-fg-dim)] md:flex-row md:items-center md:justify-between">
          <p>
            © {site.brand} · {site.legal.companyName} · {site.legal.taxId}
          </p>
          <p className="font-mono">{site.legal.address}</p>
        </div>
      </div>
    </footer>
  );
}
