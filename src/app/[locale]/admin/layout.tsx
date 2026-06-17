import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { Link, redirect } from "@/i18n/navigation";
import { site } from "@/data/site";
import { getSession } from "@/lib/session";
import { isAdminEmail } from "@/lib/admin";
import { AdminNav } from "@/components/admin/AdminNav";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>;
}): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "admin" });
  return {
    title: t("layout.metaTitle"),
    description: t("layout.metaDescription", { brand: site.brand }),
    robots: { index: false, follow: false },
  };
}

// Lee la cookie de sesión: nunca debe cachearse de forma estática.
export const dynamic = "force-dynamic";

export default async function AdminLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);
  const t = await getTranslations("admin");

  // Guard único para todo /admin: anónimo → login; usuario normal → 404
  // (no revelamos la existencia del panel a quien no es admin).
  const session = await getSession();
  if (!session) {
    redirect({ href: "/acceder", locale });
    return null; // inalcanzable (redirect lanza), pero permite a TS estrechar `session`.
  }
  if (!isAdminEmail(session.email)) notFound();

  return (
    <div className="container-edge py-10 md:py-14">
      <header className="mb-8 flex flex-wrap items-end justify-between gap-4 border-b border-[var(--color-line)] pb-6">
        <div>
          <div className="flex items-center gap-3">
            <span className="font-mono text-sm text-[var(--color-accent)]">/admin</span>
            <span className="mono-label">{t("layout.dashboardLabel")}</span>
          </div>
          <h1 className="mt-3 text-2xl font-semibold tracking-tight sm:text-3xl">
            {site.brand} · {t("layout.backoffice")}
          </h1>
        </div>
        <p className="font-mono text-xs text-[var(--color-fg-muted)]">
          {t("layout.session")} <span className="text-[var(--color-fg)]">{session.email}</span>
        </p>
      </header>

      <div className="grid gap-8 md:grid-cols-[200px_1fr]">
        <aside className="md:sticky md:top-24 md:self-start">
          <AdminNav />
          <Link
            href="/cuenta"
            className="mt-4 hidden text-xs text-[var(--color-fg-dim)] transition-colors hover:text-[var(--color-fg-muted)] md:block"
          >
            {t("layout.backToAccount")}
          </Link>
        </aside>
        <div className="min-w-0">{children}</div>
      </div>
    </div>
  );
}
