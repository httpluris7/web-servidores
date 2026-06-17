"use client";

import { useEffect, useRef, useState } from "react";
import { useTranslations } from "next-intl";
import { Link, usePathname, useRouter } from "@/i18n/navigation";

type Me = { id: string; nombre: string; email: string; isAdmin?: boolean } | null;

/** Icono de persona (heroicons user-circle, outline). */
function PersonIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.6} className="h-5 w-5" aria-hidden="true">
      <circle cx="12" cy="8.5" r="3.5" />
      <path d="M5 19.5a7 7 0 0 1 14 0" strokeLinecap="round" />
    </svg>
  );
}

export function AccountButton() {
  const t = useTranslations("account");
  const router = useRouter();
  const pathname = usePathname();
  const [me, setMe] = useState<Me>(null);
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  // Consulta la sesión al montar y cada vez que cambia la ruta (refleja
  // login/registro/logout sin recargar la página completa).
  useEffect(() => {
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
  }, [pathname]);

  // Cierra el menú al hacer clic fuera o pulsar Escape.
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

  const itemClass =
    "block rounded px-3 py-2 text-sm transition-colors hover:bg-white/5";

  return (
    <div className="relative" ref={ref}>
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        aria-haspopup="menu"
        aria-label={me ? t("myAccount") : t("createOrLogin")}
        className="relative flex h-10 w-10 items-center justify-center rounded-full border border-[var(--color-line-strong)] text-[var(--color-fg-muted)] transition-colors hover:border-[var(--color-accent)] hover:text-[var(--color-fg)]"
      >
        <PersonIcon />
        {me && (
          <span
            className="absolute -right-0.5 -top-0.5 h-2.5 w-2.5 rounded-full border-2 border-[var(--color-bg-base)] bg-[var(--color-accent)]"
            aria-hidden="true"
          />
        )}
      </button>

      {open && (
        <div
          role="menu"
          className="absolute right-0 top-full z-50 mt-2 w-56 rounded-[var(--radius-md)] border border-[var(--color-line)] bg-[var(--color-bg-overlay)] p-1.5 shadow-2xl shadow-black/50"
        >
          {me ? (
            <>
              <div className="border-b border-[var(--color-line)] px-3 py-2.5">
                <p className="text-sm font-medium text-[var(--color-fg)]">{me.nombre}</p>
                <p className="truncate font-mono text-xs text-[var(--color-fg-muted)]">{me.email}</p>
              </div>
              <Link href="/cuenta" role="menuitem" onClick={() => setOpen(false)} className={itemClass}>
                {t("myProfile")}
              </Link>
              {me.isAdmin && (
                <Link
                  href="/admin"
                  role="menuitem"
                  onClick={() => setOpen(false)}
                  className={itemClass + " text-[var(--color-accent)]"}
                >
                  {t("adminPanel")}
                </Link>
              )}
              <button
                type="button"
                role="menuitem"
                onClick={logout}
                className={itemClass + " w-full text-left text-[var(--color-fg-muted)] hover:text-[var(--color-danger)]"}
              >
                {t("logout")}
              </button>
            </>
          ) : (
            <>
              <Link
                href="/registro"
                role="menuitem"
                onClick={() => setOpen(false)}
                className={itemClass + " font-medium text-[var(--color-accent)]"}
              >
                {t("createAccount")}
              </Link>
              <Link href="/acceder" role="menuitem" onClick={() => setOpen(false)} className={itemClass}>
                {t("login")}
              </Link>
            </>
          )}
        </div>
      )}
    </div>
  );
}
