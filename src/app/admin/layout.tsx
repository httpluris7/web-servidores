import type { Metadata } from "next";
import { notFound, redirect } from "next/navigation";
import Link from "next/link";
import { site } from "@/data/site";
import { getSession } from "@/lib/session";
import { isAdminEmail } from "@/lib/admin";
import { AdminNav } from "@/components/admin/AdminNav";

export const metadata: Metadata = {
  title: "Administración",
  description: `Panel de administración de ${site.brand}.`,
  robots: { index: false, follow: false },
};

// Lee la cookie de sesión: nunca debe cachearse de forma estática.
export const dynamic = "force-dynamic";

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  // Guard único para todo /admin: anónimo → login; usuario normal → 404
  // (no revelamos la existencia del panel a quien no es admin).
  const session = await getSession();
  if (!session) redirect("/acceder");
  if (!isAdminEmail(session.email)) notFound();

  return (
    <div className="container-edge py-10 md:py-14">
      <header className="mb-8 flex flex-wrap items-end justify-between gap-4 border-b border-[var(--color-line)] pb-6">
        <div>
          <div className="flex items-center gap-3">
            <span className="font-mono text-sm text-[var(--color-accent)]">/admin</span>
            <span className="mono-label">Panel de administración</span>
          </div>
          <h1 className="mt-3 text-2xl font-semibold tracking-tight sm:text-3xl">
            {site.brand} · Backoffice
          </h1>
        </div>
        <p className="font-mono text-xs text-[var(--color-fg-muted)]">
          Sesión: <span className="text-[var(--color-fg)]">{session.email}</span>
        </p>
      </header>

      <div className="grid gap-8 md:grid-cols-[200px_1fr]">
        <aside className="md:sticky md:top-24 md:self-start">
          <AdminNav />
          <Link
            href="/cuenta"
            className="mt-4 hidden text-xs text-[var(--color-fg-dim)] transition-colors hover:text-[var(--color-fg-muted)] md:block"
          >
            ← Volver a mi cuenta
          </Link>
        </aside>
        <div className="min-w-0">{children}</div>
      </div>
    </div>
  );
}
