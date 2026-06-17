"use client";

import { useTranslations } from "next-intl";
import { Link, usePathname } from "@/i18n/navigation";
import { cn } from "@/lib/utils";

const links: { href: string; key: string; exact?: boolean }[] = [
  { href: "/admin", key: "overview", exact: true },
  { href: "/admin/clientes", key: "customers" },
  { href: "/admin/facturas", key: "invoices" },
  { href: "/admin/pedidos", key: "ordersAndContacts" },
];

/** Navegación lateral del panel de administración, con item activo resaltado. */
export function AdminNav() {
  const t = useTranslations("admin");
  const pathname = usePathname();

  return (
    <nav aria-label={t("nav.aria")} className="flex gap-1 overflow-x-auto md:flex-col md:overflow-visible">
      {links.map((l) => {
        const active = l.exact ? pathname === l.href : pathname.startsWith(l.href);
        return (
          <Link
            key={l.href}
            href={l.href}
            aria-current={active ? "page" : undefined}
            className={cn(
              "whitespace-nowrap rounded-[var(--radius-md)] px-3 py-2 text-sm transition-colors",
              active
                ? "bg-[var(--color-accent)]/10 font-medium text-[var(--color-accent)]"
                : "text-[var(--color-fg-muted)] hover:bg-white/5 hover:text-[var(--color-fg)]"
            )}
          >
            {t(`nav.${l.key}`)}
          </Link>
        );
      })}
    </nav>
  );
}
