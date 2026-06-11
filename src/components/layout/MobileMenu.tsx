"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
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

type Me = { id: string; nombre: string; email: string } | null;

export function MobileMenu() {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [section, setSection] = useState<string | null>(null);
  const [me, setMe] = useState<Me>(null);

  useEffect(() => {
    document.body.style.overflow = open ? "hidden" : "";
    return () => {
      document.body.style.overflow = "";
    };
  }, [open]);

  // Al abrir el menú, consulta la sesión para mostrar perfil o acceso/registro.
  useEffect(() => {
    if (!open) return;
    let active = true;
    fetch("/api/me", { cache: "no-store" })
      .then((r) => r.json())
      .then((d) => {
        if (active) setMe(d.user ?? null);
      })
      .catch(() => {
        if (active) setMe(null);
      });
    return () => {
      active = false;
    };
  }, [open]);

  async function logout() {
    setOpen(false);
    try {
      await fetch("/api/logout", { method: "POST" });
    } finally {
      setMe(null);
      router.push("/");
      router.refresh();
    }
  }

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
              {/* Cuenta */}
              {me ? (
                <div className="mb-2 border-b border-[var(--color-line)] pb-4">
                  <div className="py-2">
                    <p className="text-lg font-medium">{me.nombre}</p>
                    <p className="truncate font-mono text-xs text-[var(--color-fg-muted)]">{me.email}</p>
                  </div>
                  <Link
                    href="/cuenta"
                    onClick={() => setOpen(false)}
                    className="flex items-center justify-between py-2.5 text-[var(--color-fg-muted)]"
                  >
                    Mi perfil
                    <span aria-hidden="true">→</span>
                  </Link>
                  <button
                    type="button"
                    onClick={logout}
                    className="w-full py-2.5 text-left text-[var(--color-fg-muted)] transition-colors hover:text-[var(--color-danger)]"
                  >
                    Cerrar sesión
                  </button>
                </div>
              ) : (
                <div className="mb-2 grid grid-cols-2 gap-3 border-b border-[var(--color-line)] pb-4">
                  <Link
                    href="/acceder"
                    onClick={() => setOpen(false)}
                    className="flex items-center justify-center rounded-[var(--radius-md)] border border-[var(--color-line-strong)] py-3 text-sm font-medium transition-colors hover:border-[var(--color-accent)]"
                  >
                    Iniciar sesión
                  </Link>
                  <Link
                    href="/registro"
                    onClick={() => setOpen(false)}
                    className="flex items-center justify-center rounded-[var(--radius-md)] bg-[var(--color-accent)] py-3 text-sm font-medium text-black transition-colors hover:bg-[var(--color-accent-dim)]"
                  >
                    Crear cuenta
                  </Link>
                </div>
              )}

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
