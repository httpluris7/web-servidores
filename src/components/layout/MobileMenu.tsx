"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { AnimatePresence, motion } from "framer-motion";
import { site, deployUrl } from "@/data/site";
import { regions, dedicatedTypes } from "@/data/products";
import { eur } from "@/lib/utils";

type Group = { label: string; items: { href: string; label: string; note?: string }[] };

const groups: Group[] = [
  {
    label: "VPS por región",
    items: regions.map((r) => ({
      href: `/vps/${r.slug}`,
      label: r.name,
      note: `desde ${eur(r.priceFrom)}`,
    })),
  },
  {
    label: "Dedicados",
    items: dedicatedTypes.map((d) => ({ href: `/dedicados/${d.slug}`, label: d.title, note: d.highlight })),
  },
];

const directLinks = [
  { href: "/red", label: "Red" },
  { href: "/proteccion-ddos", label: "Protección DDoS" },
  { href: "/casos-de-uso", label: "Casos de uso" },
  { href: "/soporte", label: "Soporte" },
  { href: "/contacto", label: "Contacto" },
  { href: "/sobre-nosotros", label: "Sobre nosotros" },
];

export function MobileMenu() {
  const [open, setOpen] = useState(false);
  const [section, setSection] = useState<string | null>(null);

  useEffect(() => {
    document.body.style.overflow = open ? "hidden" : "";
    return () => {
      document.body.style.overflow = "";
    };
  }, [open]);

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        aria-label="Abrir menú"
        className="inline-flex h-10 w-10 items-center justify-center rounded border border-[var(--color-line)] lg:hidden"
      >
        <span className="flex flex-col gap-1">
          <span className="block h-px w-5 bg-[var(--color-fg)]" />
          <span className="block h-px w-5 bg-[var(--color-fg)]" />
          <span className="block h-px w-5 bg-[var(--color-fg)]" />
        </span>
      </button>

      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="fixed inset-0 z-[60] flex flex-col bg-[var(--color-bg-base)] lg:hidden"
          >
            <div className="container-edge flex h-16 items-center justify-between border-b border-[var(--color-line)]">
              <span className="flex items-center gap-2">
                <span className="inline-block h-2 w-2 rounded-full bg-[var(--color-accent)]" />
                <span className="text-lg font-semibold">{site.brand}</span>
              </span>
              <button
                type="button"
                onClick={() => setOpen(false)}
                aria-label="Cerrar menú"
                className="inline-flex h-10 w-10 items-center justify-center rounded border border-[var(--color-line)] text-xl"
              >
                ✕
              </button>
            </div>

            <nav className="container-edge flex-1 overflow-y-auto py-6" aria-label="Móvil">
              {groups.map((g) => {
                const isOpen = section === g.label;
                return (
                  <div key={g.label} className="border-b border-[var(--color-line)]">
                    <button
                      type="button"
                      onClick={() => setSection(isOpen ? null : g.label)}
                      aria-expanded={isOpen}
                      className="flex w-full items-center justify-between py-4 text-left text-lg"
                    >
                      {g.label}
                      <span style={{ transform: isOpen ? "rotate(45deg)" : "none" }}>+</span>
                    </button>
                    <AnimatePresence initial={false}>
                      {isOpen && (
                        <motion.ul
                          initial={{ height: 0, opacity: 0 }}
                          animate={{ height: "auto", opacity: 1 }}
                          exit={{ height: 0, opacity: 0 }}
                          transition={{ duration: 0.25 }}
                          className="overflow-hidden"
                        >
                          {g.items.map((it) => (
                            <li key={it.href}>
                              <Link
                                href={it.href}
                                onClick={() => setOpen(false)}
                                className="flex items-center justify-between py-2.5 pl-3 text-[var(--color-fg-muted)]"
                              >
                                {it.label}
                                {it.note && (
                                  <span className="font-mono text-xs">{it.note}</span>
                                )}
                              </Link>
                            </li>
                          ))}
                        </motion.ul>
                      )}
                    </AnimatePresence>
                  </div>
                );
              })}

              {directLinks.map((l) => (
                <Link
                  key={l.href}
                  href={l.href}
                  onClick={() => setOpen(false)}
                  className="block border-b border-[var(--color-line)] py-4 text-lg"
                >
                  {l.label}
                </Link>
              ))}

              <Link
                href={deployUrl()}
                onClick={() => setOpen(false)}
                className="mt-6 flex items-center justify-center rounded-[var(--radius-md)] bg-[var(--color-accent)] px-5 py-3.5 font-medium text-black"
              >
                Desplegar servidor →
              </Link>
            </nav>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}
