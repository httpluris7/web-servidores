import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { site } from "@/data/site";
import { PageHero } from "@/components/ui/PageHero";
import { LogoutButton } from "@/components/forms/LogoutButton";
import { ChangePasswordForm } from "@/components/forms/ChangePasswordForm";
import { getSession } from "@/lib/session";
import { getPublicUserById } from "@/lib/auth";

export const metadata: Metadata = {
  title: "Mi cuenta",
  description: `Panel de cuenta de ${site.brand}.`,
  robots: { index: false, follow: false },
};

// Lee la cookie de sesión: nunca debe cachearse de forma estática.
export const dynamic = "force-dynamic";

const fields: { key: string; label: string }[] = [
  { key: "nombre", label: "Nombre" },
  { key: "apellidos", label: "Apellidos" },
  { key: "email", label: "Correo electrónico" },
  { key: "telefono", label: "Teléfono" },
  { key: "direccion", label: "Dirección" },
  { key: "codigoPostal", label: "Código postal" },
  { key: "ciudad", label: "Ciudad" },
  { key: "pais", label: "País" },
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
        kicker="Mi cuenta"
        title={
          <>
            Hola, <span className="text-accent">{user.nombre}</span>.
          </>
        }
        description="Tus datos de cuenta. Próximamente podrás gestionar aquí tus servicios y facturación."
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
          <h2 className="mono-label mb-1">Seguridad</h2>
          <p className="mb-6 text-sm text-[var(--color-fg-muted)]">
            Cambia tu contraseña. Tendrás que introducir la actual y repetir la nueva.
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
