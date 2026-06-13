import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { site } from "@/data/site";
import { PageHero } from "@/components/ui/PageHero";
import { RegisterForm } from "@/components/forms/RegisterForm";
import { getSession } from "@/lib/session";
import { safeInternalPath } from "@/lib/utils";

export const metadata: Metadata = {
  title: "Create account",
  description: `Create your ${site.brand} account to manage your services.`,
  alternates: { canonical: "/registro" },
  robots: { index: false, follow: false },
};

export default async function RegistroPage({
  searchParams,
}: {
  searchParams: Promise<{ next?: string }>;
}) {
  const next = safeInternalPath((await searchParams).next);

  // Si ya hay sesión, no tiene sentido registrarse de nuevo: vamos a `next` o cuenta.
  if (await getSession()) redirect(next ?? "/cuenta");

  return (
    <>
      <PageHero
        index="/01"
        kicker="Sign up"
        title={
          <>
            Create your <span className="text-accent">account</span>.
          </>
        }
        description="Sign up to manage your VPS, dedicated servers and billing from a single dashboard."
      />

      <section className="container-edge max-w-2xl py-16 md:py-20">
        <RegisterForm next={next ?? undefined} />
      </section>
    </>
  );
}
