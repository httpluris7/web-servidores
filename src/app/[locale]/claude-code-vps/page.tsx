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
  return aiSeoMetadata("claude", locale);
}

export default async function ClaudeCodeVpsPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  setRequestLocale(locale);
  return <AiSeoLanding ns="claude" locale={locale} />;
}
