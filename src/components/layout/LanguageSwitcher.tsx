"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import { useLocale, useTranslations } from "next-intl";
import { usePathname, useRouter } from "@/i18n/navigation";
import { routing, type Locale } from "@/i18n/routing";
import { cn } from "@/lib/utils";

/** Bandera + nombre autónimo de cada idioma (el nombre no se traduce). */
const LANGUAGES: Record<Locale, { flag: string; label: string }> = {
  en: { flag: "🇬🇧", label: "English" },
  es: { flag: "🇪🇸", label: "Español" },
  fr: { flag: "🇫🇷", label: "Français" },
};

export function LanguageSwitcher() {
  const t = useTranslations("common");
  const locale = useLocale() as Locale;
  const pathname = usePathname();
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [isPending, startTransition] = useTransition();
  const ref = useRef<HTMLDivElement>(null);

  // Cierra al hacer clic fuera o pulsar Escape.
  useEffect(() => {
    if (!open) return;
    function onDown(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    }
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") setOpen(false);
    }
    document.addEventListener("mousedown", onDown);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDown);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  function switchTo(next: Locale) {
    setOpen(false);
    if (next === locale) return;
    // Mantiene la misma ruta y cambia solo el idioma (preserva el prefijo).
    startTransition(() => {
      router.replace(pathname, { locale: next });
    });
  }

  const current = LANGUAGES[locale] ?? LANGUAGES.en;

  return (
    <div className="relative" ref={ref}>
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        aria-haspopup="menu"
        aria-label={t("changeLanguage")}
        disabled={isPending}
        className="flex h-10 items-center gap-1.5 rounded-full border border-[var(--color-line-strong)] px-3 text-[var(--color-fg-muted)] transition-colors hover:border-[var(--color-accent)] hover:text-[var(--color-fg)] disabled:opacity-60"
      >
        <span className="text-base leading-none" aria-hidden="true">
          {current.flag}
        </span>
        <span className="hidden text-xs font-medium uppercase sm:inline">{locale}</span>
        <span className="text-[0.6rem]" aria-hidden="true">
          ▾
        </span>
      </button>

      {open && (
        <div
          role="menu"
          className="absolute right-0 top-full z-50 mt-2 w-44 rounded-[var(--radius-md)] border border-[var(--color-line)] bg-[var(--color-bg-overlay)] p-1.5 shadow-2xl shadow-black/50"
        >
          {routing.locales.map((l) => {
            const lang = LANGUAGES[l];
            const active = l === locale;
            return (
              <button
                key={l}
                type="button"
                role="menuitem"
                onClick={() => switchTo(l)}
                className={cn(
                  "flex w-full items-center gap-2.5 rounded px-3 py-2 text-sm transition-colors hover:bg-white/5",
                  active ? "text-[var(--color-accent)]" : "text-[var(--color-fg)]"
                )}
              >
                <span className="text-base leading-none" aria-hidden="true">
                  {lang.flag}
                </span>
                <span>{lang.label}</span>
                {active && (
                  <span className="ml-auto text-xs" aria-hidden="true">
                    ✓
                  </span>
                )}
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}
