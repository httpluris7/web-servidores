"use client";

import { useEffect, useRef, useState } from "react";
import { useTranslations } from "next-intl";
import {
  CURRENCIES,
  CURRENCY_ATTR,
  CURRENCY_STORAGE_KEY,
  DEFAULT_CURRENCY,
  parseCurrency,
  type Currency,
} from "@/lib/currency";
import { cn } from "@/lib/utils";

/** Símbolo y nombre de cada divisa (el código no se traduce). */
const CURRENCY_META: Record<Currency, { symbol: string; label: string }> = {
  eur: { symbol: "€", label: "Euro" },
  usd: { symbol: "$", label: "US Dollar" },
};

/**
 * Selector de divisa, hermano del selector de idioma.
 *
 * No re-renderiza los precios: solo escribe `data-currency` en el <html> y el
 * CSS hace el resto (ver `lib/currency.ts`). El estado de React existe únicamente
 * para el marcador de "activo" del desplegable; el texto visible del botón usa
 * las mismas clases `c-eur`/`c-usd` que los precios para que tampoco parpadee en
 * la hidratación.
 */
export function CurrencySwitcher() {
  const t = useTranslations("common");
  const [open, setOpen] = useState(false);
  const [currency, setCurrency] = useState<Currency>(DEFAULT_CURRENCY);
  const ref = useRef<HTMLDivElement>(null);

  // Lee la divisa que el script inline ya dejó puesta en el <html>.
  useEffect(() => {
    const attr = document.documentElement.getAttribute(CURRENCY_ATTR);
    setCurrency(parseCurrency(attr) ?? DEFAULT_CURRENCY);
  }, []);

  // Mantiene la divisa sincronizada entre pestañas del mismo origen.
  useEffect(() => {
    function onStorage(e: StorageEvent) {
      if (e.key !== CURRENCY_STORAGE_KEY) return;
      const next = parseCurrency(e.newValue) ?? DEFAULT_CURRENCY;
      document.documentElement.setAttribute(CURRENCY_ATTR, next);
      setCurrency(next);
    }
    window.addEventListener("storage", onStorage);
    return () => window.removeEventListener("storage", onStorage);
  }, []);

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

  function switchTo(next: Currency) {
    setOpen(false);
    if (next === currency) return;
    document.documentElement.setAttribute(CURRENCY_ATTR, next);
    setCurrency(next);
    try {
      window.localStorage.setItem(CURRENCY_STORAGE_KEY, next);
    } catch {
      // Sin persistencia (modo privado, cuota llena): vale para esta sesión.
    }
  }

  return (
    <div className="relative" ref={ref}>
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        aria-haspopup="menu"
        aria-label={t("changeCurrency")}
        className="flex h-11 min-w-11 items-center justify-center gap-1.5 rounded-full border border-[var(--color-line-strong)] px-2.5 sm:h-10 sm:min-w-0 text-[var(--color-fg-muted)] transition-colors hover:border-[var(--color-accent)] hover:text-[var(--color-fg)] sm:px-3"
      >
        <span className="text-base leading-none" aria-hidden="true">
          <span className="c-eur">{CURRENCY_META.eur.symbol}</span>
          <span className="c-usd">{CURRENCY_META.usd.symbol}</span>
        </span>
        <span className="hidden text-xs font-medium uppercase sm:inline">
          <span className="c-eur">EUR</span>
          <span className="c-usd">USD</span>
        </span>
        <span className="hidden text-[0.6rem] sm:inline" aria-hidden="true">
          ▾
        </span>
      </button>

      {open && (
        <div
          role="menu"
          className="absolute right-0 top-full z-50 mt-2 w-52 rounded-[var(--radius-md)] border border-[var(--color-line)] bg-[var(--color-bg-overlay)] p-1.5 shadow-2xl shadow-black/50"
        >
          {CURRENCIES.map((c) => {
            const meta = CURRENCY_META[c];
            const active = c === currency;
            return (
              <button
                key={c}
                type="button"
                role="menuitemradio"
                aria-checked={active}
                onClick={() => switchTo(c)}
                className={cn(
                  "flex w-full items-center gap-2.5 rounded px-3 py-2 text-sm transition-colors hover:bg-white/5",
                  active ? "text-[var(--color-accent)]" : "text-[var(--color-fg)]"
                )}
              >
                <span className="w-3 text-base leading-none" aria-hidden="true">
                  {meta.symbol}
                </span>
                <span>{meta.label}</span>
                {active && (
                  <span className="ml-auto text-xs" aria-hidden="true">
                    ✓
                  </span>
                )}
              </button>
            );
          })}
          <p className="px-3 py-2 text-[0.65rem] leading-snug text-[var(--color-fg-dim)]">
            {t("currencyNote")}
          </p>
        </div>
      )}
    </div>
  );
}
