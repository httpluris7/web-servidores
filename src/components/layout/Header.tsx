"use client";

import { useEffect, useState } from "react";
import { useTranslations } from "next-intl";
import { Link } from "@/i18n/navigation";
import { site, deployUrl } from "@/data/site";
import { regions, dedicatedTypes } from "@/data/products";
import { eur } from "@/lib/utils";
import { cn } from "@/lib/utils";
import { MobileMenu } from "./MobileMenu";
import { AccountButton } from "./AccountButton";
import { LanguageSwitcher } from "./LanguageSwitcher";
import { CartButton } from "@/components/cart/CartButton";

const navLinks = [
  { href: "/red", key: "network" },
  { href: "/proteccion-ddos", key: "ddosProtection" },
  { href: "/casos-de-uso", key: "useCases" },
  { href: "/soporte", key: "support" },
] as const;

export function Header() {
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
          <span className="text-lg font-semibold tracking-tight">{site.brand}</span>
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
              <div className="absolute left-1/2 top-full z-50 w-[640px] -translate-x-1/2 pt-3">
                <div className="grid grid-cols-2 gap-2 rounded-[var(--radius-lg)] border border-[var(--color-line)] bg-[var(--color-bg-overlay)] p-3 shadow-2xl shadow-black/50">
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
                              {tc("from")} {eur(r.priceFrom)}
                            </span>
                          </Link>
                        </li>
                      ))}
                    </ul>
                  </div>

                  {/* Columna Dedicados */}
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

        {/* CTA + idioma + cuenta + móvil */}
        <div className="flex items-center gap-3">
          <Link
            href={deployUrl()}
            className="hidden rounded-[var(--radius-md)] bg-[var(--color-accent)] px-4 py-2 text-sm font-medium text-black transition-all hover:bg-[var(--color-accent-dim)] hover:shadow-[0_0_30px_-6px_var(--color-accent-glow)] sm:inline-flex"
          >
            {tc("deployServer")}
          </Link>
          <LanguageSwitcher />
          <CartButton />
          <AccountButton />
          <MobileMenu />
        </div>
      </div>
    </header>
  );
}
