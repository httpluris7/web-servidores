import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { site } from "@/data/site";
import { PageHero } from "@/components/ui/PageHero";
import { LogoutButton } from "@/components/forms/LogoutButton";
import { ChangePasswordForm } from "@/components/forms/ChangePasswordForm";
import { getSession } from "@/lib/session";
import { getPublicUserById } from "@/lib/auth";

export const metadata: Metadata = {
  title: "My account",
  description: `${site.brand} account dashboard.`,
  robots: { index: false, follow: false },
};

// Lee la cookie de sesión: nunca debe cachearse de forma estática.
export const dynamic = "force-dynamic";

const fields: { key: string; label: string }[] = [
  { key: "nombre", label: "Name" },
  { key: "apellidos", label: "Last name" },
  { key: "email", label: "Email" },
  { key: "telefono", label: "Phone" },
  { key: "direccion", label: "Address" },
  { key: "codigoPostal", label: "Postal code" },
  { key: "ciudad", label: "City" },
  { key: "estado", label: "State" },
  { key: "pais", label: "Country" },
];

export default async function CuentaPage() {
  const session = await getSession();
  if (!session) redirect("/acceder");

  const user = await getPublicUserById(session.uid);
  if (!user) redirect("/acceder");

  return (
    <>
      <PageHero
        index="/01"
        kicker="My account"
        title={
          <>
            Hello, <span className="text-accent">{user.nombre}</span>.
          </>
        }
        description="Your account details. Soon you'll be able to manage your services and billing here."
      />

      <section className="container-edge max-w-2xl py-16 md:py-20">
        <dl className="grid gap-px overflow-hidden rounded-[var(--radius-lg)] border border-[var(--color-line)] bg-[var(--color-line)] sm:grid-cols-2">
          {fields.map((f) => (
            <div key={f.key} className="bg-[var(--color-bg-raised)] px-5 py-4">
              <dt className="mono-label text-[0.6rem]">{f.label}</dt>
              <dd className="mt-1 text-sm text-[var(--color-fg)] break-words">
                {(user as unknown as Record<string, string>)[f.key] || "—"}
              </dd>
            </div>
          ))}
        </dl>

        <section className="mt-12 border-t border-[var(--color-line)] pt-10">
          <h2 className="mono-label mb-1">Security</h2>
          <p className="mb-6 text-sm text-[var(--color-fg-muted)]">
            Change your password. You&apos;ll need to enter your current one and repeat the new one.
          </p>
          <ChangePasswordForm />
        </section>

        <div className="mt-8">
          <LogoutButton />
        </div>
      </section>
    </>
  );
}
