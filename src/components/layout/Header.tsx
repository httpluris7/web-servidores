"use client";

import { useEffect, useState } from "react";
import { useTranslations } from "next-intl";
import { Link } from "@/i18n/navigation";
import { site, deployUrl } from "@/data/site";
import type { NavCatalog } from "@/data/products";
import { cn } from "@/lib/utils";
import { Price } from "@/components/ui/Price";
import { MobileMenu } from "./MobileMenu";
import { AccountButton } from "./AccountButton";
import { LanguageSwitcher } from "./LanguageSwitcher";
import { CurrencySwitcher } from "./CurrencySwitcher";
import { CartButton } from "@/components/cart/CartButton";

const navLinks = [
  { href: "/red", key: "network" },
  { href: "/proteccion-ddos", key: "ddosProtection" },
  { href: "/casos-de-uso", key: "useCases" },
  { href: "/soporte", key: "support" },
] as const;

/**
 * `nav` llega como prop desde el layout: el catálogo se lee del disco y este es
 * un componente de cliente. Ver `getNavCatalog`.
 */
export function Header({ nav }: { nav: NavCatalog }) {
  const { regions, lines: dedicatedTypes } = nav;
  const t = useTranslations("nav");
  const tc = useTranslations("common");
  const [scrolled, setScrolled] = useState(false);
  const [megaOpen, setMegaOpen] = useState(false);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 8);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  return (
    <header
      className={cn(
        "sticky top-0 z-50 border-b transition-colors duration-300",
        scrolled
          ? "border-[var(--color-line)] bg-[var(--color-bg-base)]/80 backdrop-blur-md"
          : "border-transparent bg-transparent"
      )}
    >
      <div className="container-edge flex h-16 items-center justify-between gap-6">
        {/* Logo */}
        <Link href="/" className="flex items-center gap-2" aria-label={`${site.brand} home`}>
          <span className="inline-block h-2 w-2 rounded-full bg-[var(--color-accent)] shadow-[0_0_12px_var(--color-accent)]" />
          {/* Por debajo de 360px no cabe junto a los controles; queda el punto. */}
          <span className="hidden text-lg font-semibold tracking-tight min-[360px]:inline">
            {site.brand}
          </span>
        </Link>

        {/* Nav desktop */}
        <nav className="hidden items-center gap-1 lg:flex" aria-label="Main">
          {/* Mega-menú Productos */}
          <div
            className="relative"
            onMouseEnter={() => setMegaOpen(true)}
            onMouseLeave={() => setMegaOpen(false)}
          >
            <button
              type="button"
              aria-expanded={megaOpen}
              aria-haspopup="true"
              onClick={() => setMegaOpen((v) => !v)}
              className="flex items-center gap-1.5 rounded px-3 py-2 text-sm text-[var(--color-fg-muted)] transition-colors hover:text-[var(--color-fg)]"
            >
              {t("products")}
              <span
                className="text-xs transition-transform duration-200"
                style={{ transform: megaOpen ? "rotate(180deg)" : "none" }}
                aria-hidden="true"
              >
                ▾
              </span>
            </button>

            {megaOpen && (
              <div
                className={cn(
                  "absolute left-1/2 top-full z-50 -translate-x-1/2 pt-3",
                  dedicatedTypes.length > 0 ? "w-[640px]" : "w-[340px]"
                )}
              >
                <div
                  className={cn(
                    "grid gap-2 rounded-[var(--radius-lg)] border border-[var(--color-line)] bg-[var(--color-bg-overlay)] p-3 shadow-2xl shadow-black/50",
                    dedicatedTypes.length > 0 ? "grid-cols-2" : "grid-cols-1"
                  )}
                >
                  {/* Registrar dominio — arriba del todo, a lo ancho */}
                  <Link
                    href="/dominios"
                    className="col-span-full flex items-center gap-3 rounded-[var(--radius-md)] border border-[var(--color-accent)]/30 bg-[var(--color-accent)]/5 px-3 py-2.5 transition-colors hover:bg-[var(--color-accent)]/10"
                  >
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" className="shrink-0 text-[var(--color-accent)]" aria-hidden="true">
                      <circle cx="12" cy="12" r="9" />
                      <path d="M3 12h18" />
                      <path d="M12 3a14 14 0 0 1 0 18a14 14 0 0 1 0-18" />
                    </svg>
                    <span className="min-w-0">
                      <span className="block text-sm font-medium text-[var(--color-fg)]">{t("registerDomain")}</span>
                      <span className="block text-xs text-[var(--color-fg-muted)]">{t("registerDomainSub")}</span>
                    </span>
                    <span className="ml-auto text-xs text-[var(--color-accent)]" aria-hidden="true">→</span>
                  </Link>

                  {/* Columna VPS */}
                  <div className="rounded-[var(--radius-md)] p-3">
                    <div className="mb-3 flex items-center justify-between">
                      <span className="mono-label">{t("vpsByRegion")}</span>
                      <Link
                        href="/vps"
                        className="text-xs text-[var(--color-accent)] hover:underline"
                      >
                        {tc("viewAll")} →
                      </Link>
                    </div>
                    <ul className="space-y-0.5">
                      {regions.slice(0, 6).map((r) => (
                        <li key={r.slug}>
                          <Link
                            href={`/vps/${r.slug}`}
                            className="flex items-center justify-between rounded px-2 py-1.5 text-sm transition-colors hover:bg-white/5"
                          >
                            <span className="flex items-center gap-2">
                              <span aria-hidden="true">{r.flag}</span>
                              {r.name}
                            </span>
                            <span className="font-mono text-xs text-[var(--color-fg-muted)]">
                              {tc("from")} <Price value={r.priceFrom} />
                            </span>
                          </Link>
                        </li>
                      ))}
                    </ul>
                  </div>

                  {/* Columna Dedicados (oculta si no hay líneas dedicadas visibles) */}
                  {dedicatedTypes.length > 0 && (
                    <div className="rounded-[var(--radius-md)] bg-white/[0.02] p-3">
                      <div className="mb-3 flex items-center justify-between">
                        <span className="mono-label">{t("dedicated")}</span>
                        <Link
                          href="/dedicados"
                          className="text-xs text-[var(--color-accent)] hover:underline"
                        >
                          {tc("viewAll")} →
                        </Link>
                      </div>
                      <ul className="space-y-0.5">
                        {dedicatedTypes.map((d) => (
                          <li key={d.slug}>
                            <Link
                              href={`/dedicados/${d.slug}`}
                              className="block rounded px-2 py-1.5 transition-colors hover:bg-white/5"
                            >
                              <span className="block text-sm">{d.title}</span>
                              <span className="block font-mono text-xs text-[var(--color-fg-muted)]">
                                {d.highlight}
                              </span>
                            </Link>
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>

          {navLinks.map((l) => (
            <Link
              key={l.href}
              href={l.href}
              className="rounded px-3 py-2 text-sm text-[var(--color-fg-muted)] transition-colors hover:text-[var(--color-fg)]"
            >
              {t(l.key)}
            </Link>
          ))}
        </nav>

        {/* CTA + idioma + divisa + cuenta + móvil */}
        <div className="flex items-center gap-1 min-[360px]:gap-2 sm:gap-3">
          <Link
            href={deployUrl()}
            className="hidden rounded-[var(--radius-md)] bg-[var(--color-accent)] px-4 py-2 text-sm font-medium text-black transition-all hover:bg-[var(--color-accent-dim)] hover:shadow-[0_0_30px_-6px_var(--color-accent-glow)] sm:inline-flex"
          >
            {tc("deployServer")}
          </Link>
          <LanguageSwitcher />
          <CurrencySwitcher />
          <CartButton />
          <AccountButton />
          <MobileMenu nav={nav} />
        </div>
      </div>
    </header>
  );
}
