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
    alternates: alternatesFor(locale, "/legal/aviso-legal"),
    title: t("notice.metaTitle"),
    description: t("notice.metaDescription"),
    robots: { index: true, follow: true },
  };
}

const sectionKeys = ["owner","contact","scope","ip","abuse","links","law"] as const;

export default async function LegalNoticePage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);
  const t = await getTranslations("legal");

  return (
    <LegalLayout
      index={t("notice.index")}
      kicker={t("common.kicker")}
      title={t("notice.title")}
      intro={t("notice.intro")}
      updated={t("common.updated", { date: t("common.date") })}
      contact={t("common.contact")}
      sections={legalSections(t, "notice", sectionKeys)}
    />
  );
}
