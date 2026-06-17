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
    title: t("cookies.metaTitle"),
    description: t("cookies.metaDescription"),
    robots: { index: true, follow: true },
  };
}

const sectionKeys = ["what", "used", "consent", "managing", "changes"] as const;

export default async function CookiesPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);
  const t = await getTranslations("legal");

  return (
    <LegalLayout
      index={t("cookies.index")}
      title={t("cookies.title")}
      intro={t("cookies.intro")}
      updated={t("cookies.updated")}
      sections={sectionKeys.map((key) => ({
        heading: t(`cookies.sections.${key}.heading`),
        todo: t(`cookies.sections.${key}.todo`),
      }))}
    />
  );
}
