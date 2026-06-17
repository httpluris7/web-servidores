import type { Metadata } from "next";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { LegalLayout } from "@/components/legal/LegalLayout";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>;
}): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "legal" });
  return {
    title: t("privacy.metaTitle"),
    description: t("privacy.metaDescription"),
    robots: { index: true, follow: true },
  };
}

const sectionKeys = [
  "controller",
  "dataCollected",
  "purpose",
  "retention",
  "recipients",
  "rights",
  "security",
] as const;

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
      title={t("privacy.title")}
      intro={t("privacy.intro")}
      updated={t("privacy.updated")}
      sections={sectionKeys.map((key) => ({
        heading: t(`privacy.sections.${key}.heading`),
        todo: t(`privacy.sections.${key}.todo`),
      }))}
    />
  );
}
