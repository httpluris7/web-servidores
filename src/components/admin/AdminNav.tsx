"use client";

import { useTranslations } from "next-intl";
import { Link, usePathname } from "@/i18n/navigation";
import { cn } from "@/lib/utils";

const links: { href: string; key: string; exact?: boolean }[] = [
  { href: "/admin", key: "overview", exact: true },
  { href: "/admin/clientes", key: "customers" },
  { href: "/admin/facturas", key: "invoices" },
  { href: "/admin/pedidos", key: "ordersAndContacts" },
  { href: "/admin/servidores", key: "servers" },
  { href: "/admin/configuracion", key: "settings" },
];

/** Navegación lateral del panel de administración, con item activo resaltado. */
export function AdminNav() {
  const t = useTranslations("admin");
  const pathname = usePathname();

  return (
    <nav aria-label={t("nav.aria")} className="flex flex-wrap gap-1 md:flex-col md:flex-nowrap">
      {links.map((l) => {
        const active = l.exact ? pathname === l.href : pathname.startsWith(l.href);
        return (
          <Link
            key={l.href}
            href={l.href}
            aria-current={active ? "page" : undefined}
            className={cn(
              "flex min-h-11 items-center whitespace-nowrap rounded-[var(--radius-md)] px-3 text-sm transition-colors md:min-h-0 md:py-2",
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
