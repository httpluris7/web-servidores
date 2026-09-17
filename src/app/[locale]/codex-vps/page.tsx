import type { Metadata } from "next";
import { setRequestLocale } from "next-intl/server";
import { AiSeoLanding, aiSeoMetadata } from "@/components/ai/AiSeoLanding";

/** El catálogo (planes y precios) se edita en caliente desde el panel. */
export const dynamic = "force-dynamic";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>;
}): Promise<Metadata> {
  const { locale } = await params;
  return aiSeoMetadata("codex", locale);
}

export default async function CodexVpsPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  setRequestLocale(locale);
  return <AiSeoLanding ns="codex" locale={locale} />;
}
