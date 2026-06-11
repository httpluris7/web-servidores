import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { site } from "@/data/site";
import { PageHero } from "@/components/ui/PageHero";
import { RegisterForm } from "@/components/forms/RegisterForm";
import { getSession } from "@/lib/session";

export const metadata: Metadata = {
  title: "Crear cuenta",
  description: `Crea tu cuenta en ${site.brand} para gestionar tus servicios.`,
  alternates: { canonical: "/registro" },
  robots: { index: false, follow: false },
};

export default async function RegistroPage() {
  // Si ya hay sesión, no tiene sentido registrarse de nuevo.
  if (await getSession()) redirect("/cuenta");

  return (
    <>
      <PageHero
        index="/01"
        kicker="Registro"
        title={
          <>
            Crea tu <span className="text-accent">cuenta</span>.
          </>
        }
        description="Regístrate para gestionar tus VPS, dedicados y facturación desde un único panel."
      />

      <section className="container-edge max-w-2xl py-16 md:py-20">
        <RegisterForm />
      </section>
    </>
  );
}
