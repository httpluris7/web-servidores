import type { Metadata } from "next";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { LegalLayout } from "@/components/legal/LegalLayout";
import { legalSections } from "@/components/legal/sections";
import { alternatesFor } from "@/lib/seo";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>;
}): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "legal" });
  return {
    alternates: alternatesFor(locale, "/legal/privacidad"),
    title: t("privacy.metaTitle"),
    description: t("privacy.metaDescription"),
    robots: { index: true, follow: true },
  };
}

const sectionKeys = ["controller","dataCollected","purpose","retention","recipients","transfers","rights","security"] as const;

export default async function PrivacyPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);
  const t = await getTranslations("legal");

  return (
    <LegalLayout
      index={t("privacy.index")}
      kicker={t("common.kicker")}
      title={t("privacy.title")}
      intro={t("privacy.intro")}
      updated={t("common.updated", { date: t("common.date") })}
      contact={t("common.contact")}
      sections={legalSections(t, "privacy", sectionKeys)}
    />
  );
}
