import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { site } from "@/data/site";
import { PageHero } from "@/components/ui/PageHero";
import { LoginForm } from "@/components/forms/LoginForm";
import { getSession } from "@/lib/session";

export const metadata: Metadata = {
  title: "Iniciar sesión",
  description: `Accede a tu cuenta de ${site.brand}.`,
  alternates: { canonical: "/acceder" },
  robots: { index: false, follow: false },
};

export default async function AccederPage() {
  if (await getSession()) redirect("/cuenta");

  return (
    <>
      <PageHero
        index="/01"
        kicker="Acceso"
        title={
          <>
            Inicia <span className="text-accent">sesión</span>.
          </>
        }
        description="Entra con tu correo y contraseña para acceder a tu panel."
      />

      <section className="container-edge max-w-md py-16 md:py-20">
        <LoginForm />
      </section>
    </>
  );
}
