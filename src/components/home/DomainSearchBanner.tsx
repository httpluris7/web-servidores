"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { useRouter } from "@/i18n/navigation";

/**
 * Banner del home (bajo el hero): permite buscar un dominio sin entrar en la
 * categoría. Al enviar, lleva a /dominios?q=… que ejecuta la búsqueda y muestra
 * resultados y precios. Comunica de un vistazo que aquí también se registran
 * dominios con privacidad.
 */
export function DomainSearchBanner() {
  const t = useTranslations("dominios");
  const router = useRouter();
  const [q, setQ] = useState("");

  function submit(e: React.FormEvent) {
    e.preventDefault();
    const term = q.trim();
    router.push(term ? `/dominios?q=${encodeURIComponent(term)}` : "/dominios");
  }

  return (
    <section className="container-edge py-10 md:py-12">
      <div className="mx-auto max-w-5xl overflow-hidden rounded-[var(--radius-lg)] border border-[var(--color-accent)]/25 bg-[var(--color-bg-raised)] p-6 md:p-8">
        <div className="flex flex-col gap-6 lg:flex-row lg:items-center lg:justify-between">
          <div className="min-w-0">
            <p className="mono-label text-[0.7rem] text-[var(--color-accent)]">{t("banner.kicker")}</p>
            <h2 className="mt-2 text-xl font-semibold sm:text-2xl">{t("banner.title")}</h2>
            <p className="mt-1.5 text-sm text-[var(--color-fg-muted)]">{t("banner.subtitle")}</p>
          </div>

          <form onSubmit={submit} className="flex w-full gap-2 lg:max-w-md">
            <input
              type="text"
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder={t("placeholder")}
              autoComplete="off"
              spellCheck={false}
              aria-label={t("banner.title")}
              className="min-w-0 flex-1 rounded-[var(--radius-md)] border border-[var(--color-line-strong)] bg-[var(--color-bg-base)] px-4 py-3 text-sm placeholder:text-[var(--color-fg-dim)] focus:border-[var(--color-accent)] focus:outline-none"
            />
            <button
              type="submit"
              className="inline-flex shrink-0 items-center justify-center rounded-[var(--radius-md)] bg-[var(--color-accent)] px-6 text-sm font-medium text-black transition-colors hover:bg-[var(--color-accent-dim)]"
            >
              {t("searchButton")}
            </button>
          </form>
        </div>
      </div>
    </section>
  );
}
