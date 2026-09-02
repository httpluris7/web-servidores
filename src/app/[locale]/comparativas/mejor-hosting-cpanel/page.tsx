import type { Metadata } from "next";
import { setRequestLocale } from "next-intl/server";
import {
  ComparativaHeadToHead,
  comparativaMetadata,
} from "@/components/comparativas/ComparativaHeadToHead";

const NS = "mejor-hosting-cpanel";
const PATH = "/comparativas/mejor-hosting-cpanel";

export function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>;
}): Promise<Metadata> {
  return params.then(({ locale }) => comparativaMetadata(locale, NS, PATH));
}

export default async function Page({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  setRequestLocale(locale);
  return <ComparativaHeadToHead locale={locale} nsKey={NS} path={PATH} ctaHref="/hosting" />;
}
