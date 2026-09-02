"use client";

import { useEffect, useMemo, useState } from "react";
import { useTranslations } from "next-intl";
import { Icon } from "./icons";
import { NAV_GROUPS, PAGE_SECTIONS } from "./nav";

/**
 * Barra lateral de secciones del servicio.
 *
 * - Grupos colapsables (Overview · Acciones · Gestión).
 * - Resalta la sección visible mediante IntersectionObserver (scroll-spy) sobre
 *   las secciones que tienen ancla real en la página.
 * - En móvil se convierte en un desplegable (un botón que abre/cierra la lista).
 *
 * Vive en el layout, así que observa las secciones que pinta la página por su
 * `id`; ambas comparten el mismo documento.
 */
export function ServiceSidebar() {
  const t = useTranslations("panel");
  const [active, setActive] = useState<string>("resumen");
  const [mobileOpen, setMobileOpen] = useState(false);
  const [open, setOpen] = useState<Record<string, boolean>>({
    overview: true,
    acciones: true,
    gestion: true,
  });

  // Anclas que usa un único elemento: solo esas resaltan un ítem concreto.
  const anchorCounts = useMemo(() => {
    const c: Record<string, number> = {};
    for (const g of NAV_GROUPS) for (const it of g.items) c[it.anchor] = (c[it.anchor] ?? 0) + 1;
    return c;
  }, []);

  // Scroll-spy: marca activa la sección que entra en la banda superior.
  useEffect(() => {
    const els = PAGE_SECTIONS.map((id) => document.getElementById(id)).filter(
      (e): e is HTMLElement => e !== null,
    );
    if (els.length === 0) return;
    const obs = new IntersectionObserver(
      (entries) => {
        for (const e of entries) {
          if (e.isIntersecting) setActive(e.target.id);
        }
      },
      { rootMargin: "-96px 0px -62% 0px", threshold: 0 },
    );
    els.forEach((el) => obs.observe(el));
    return () => obs.disconnect();
  }, []);

  function go(anchor: string) {
    setMobileOpen(false);
    const el = document.getElementById(anchor);
    if (el) el.scrollIntoView({ behavior: "smooth", block: "start" });
  }

  const activeLabelKey =
    NAV_GROUPS.flatMap((g) => g.items).find(
      (it) => it.anchor === active && anchorCounts[it.anchor] === 1,
    )?.key ??
    // Si la sección activa es la de Gestión (ancla compartida), rotula el grupo.
    (active === "gestion" ? "gestionCurrent" : "resumen");

  const nav = (
    <nav className="grid gap-5">
      {NAV_GROUPS.map((group) => {
        const groupActive = group.items.some((it) => it.anchor === active);
        return (
          <div key={group.key}>
            <button
              type="button"
              onClick={() => setOpen((o) => ({ ...o, [group.key]: !o[group.key] }))}
              className="flex w-full items-center justify-between gap-2 py-1 text-left"
              aria-expanded={open[group.key]}
            >
              <span
                className={`mono-label text-[0.62rem] ${groupActive ? "text-[var(--color-accent)]" : ""}`}
              >
                {t(`sidebar.groups.${group.key}`)}
              </span>
              <Icon
                name="chevron"
                size={14}
                className={`text-[var(--color-fg-dim)] transition-transform ${open[group.key] ? "" : "-rotate-90"}`}
              />
            </button>

            {open[group.key] && (
              <ul className="mt-1.5 grid gap-0.5">
                {group.items.map((it) => {
                  const isActive = it.anchor === active && anchorCounts[it.anchor] === 1;
                  return (
                    <li key={it.key}>
                      <button
                        type="button"
                        onClick={() => go(it.anchor)}
                        className={`flex w-full items-center gap-2.5 rounded-[var(--radius-md)] px-2.5 py-2 text-left text-sm transition-colors ${
                          isActive
                            ? "bg-[var(--color-accent)]/10 text-[var(--color-accent)]"
                            : "text-[var(--color-fg-muted)] hover:bg-[var(--color-bg-overlay)] hover:text-[var(--color-fg)]"
                        }`}
                      >
                        <Icon
                          name={it.icon}
                          size={16}
                          className={isActive ? "" : "text-[var(--color-fg-dim)]"}
                        />
                        <span className="min-w-0 flex-1 truncate">{t(`sidebar.items.${it.key}`)}</span>
                        {it.soon && (
                          <span className="h-1.5 w-1.5 shrink-0 rounded-full bg-[var(--color-line-strong)]" />
                        )}
                      </button>
                    </li>
                  );
                })}
              </ul>
            )}
          </div>
        );
      })}
    </nav>
  );

  return (
    <>
      {/* Móvil: desplegable */}
      <div className="lg:hidden">
        <button
          type="button"
          onClick={() => setMobileOpen((v) => !v)}
          aria-expanded={mobileOpen}
          className="flex w-full items-center justify-between gap-3 rounded-[var(--radius-md)] border border-[var(--color-line-strong)] bg-[var(--color-bg-raised)] px-4 py-3 text-sm"
        >
          <span className="flex items-center gap-2.5">
            <Icon name="menu" size={18} className="text-[var(--color-fg-muted)]" />
            <span className="font-medium">
              {activeLabelKey === "gestionCurrent"
                ? t("sidebar.groups.gestion")
                : t(`sidebar.items.${activeLabelKey}`)}
            </span>
          </span>
          <Icon
            name="chevron"
            size={16}
            className={`text-[var(--color-fg-dim)] transition-transform ${mobileOpen ? "rotate-180" : ""}`}
          />
        </button>
        {mobileOpen && (
          <div className="mt-2 rounded-[var(--radius-md)] border border-[var(--color-line)] bg-[var(--color-bg-raised)] p-4">
            {nav}
          </div>
        )}
      </div>

      {/* Escritorio: barra fija */}
      <div className="hidden lg:block">
        <div className="sticky top-24">{nav}</div>
      </div>
    </>
  );
}
