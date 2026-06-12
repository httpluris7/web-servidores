"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";

const links = [
  { href: "/admin", label: "Overview", exact: true },
  { href: "/admin/clientes", label: "Customers" },
  { href: "/admin/facturas", label: "Invoices" },
  { href: "/admin/pedidos", label: "Orders and contacts" },
];

/** Navegación lateral del panel de administración, con item activo resaltado. */
export function AdminNav() {
  const pathname = usePathname();

  return (
    <nav aria-label="Administration" className="flex gap-1 overflow-x-auto md:flex-col md:overflow-visible">
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
            {l.label}
          </Link>
        );
      })}
    </nav>
  );
}
