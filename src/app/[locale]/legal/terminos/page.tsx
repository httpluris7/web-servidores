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
    title: t("terms.metaTitle"),
    description: t("terms.metaDescription"),
    robots: { index: true, follow: true },
  };
}

const sectionKeys = [
  "purpose",
  "ordering",
  "acceptableUse",
  "sla",
  "liability",
  "termination",
  "law",
] as const;

export default async function TermsPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);
  const t = await getTranslations("legal");

  return (
    <LegalLayout
      index={t("terms.index")}
      title={t("terms.title")}
      intro={t("terms.intro")}
      updated={t("terms.updated")}
      sections={sectionKeys.map((key) => ({
        heading: t(`terms.sections.${key}.heading`),
        todo: t(`terms.sections.${key}.todo`),
      }))}
    />
  );
}
