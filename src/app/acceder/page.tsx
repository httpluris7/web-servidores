import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { site } from "@/data/site";
import { PageHero } from "@/components/ui/PageHero";
import { LoginForm } from "@/components/forms/LoginForm";
import { getSession } from "@/lib/session";
import { safeInternalPath } from "@/lib/utils";

export const metadata: Metadata = {
  title: "Log in",
  description: `Access your ${site.brand} account.`,
  alternates: { canonical: "/acceder" },
  robots: { index: false, follow: false },
};

export default async function AccederPage({
  searchParams,
}: {
  searchParams: Promise<{ next?: string }>;
}) {
  const next = safeInternalPath((await searchParams).next);

  if (await getSession()) redirect(next ?? "/cuenta");

  return (
    <>
      <PageHero
        index="/01"
        kicker="Access"
        title={
          <>
            Log <span className="text-accent">in</span>.
          </>
        }
        description="Enter your email and password to access your dashboard."
      />

      <section className="container-edge max-w-md py-16 md:py-20">
        <LoginForm next={next ?? undefined} />
      </section>
    </>
  );
}
