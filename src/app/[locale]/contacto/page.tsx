import type { Metadata } from "next";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { Link } from "@/i18n/navigation";
import { site } from "@/data/site";
import { PageHero } from "@/components/ui/PageHero";
import { ContactForm } from "@/components/forms/ContactForm";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>;
}): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "pages" });
  return {
    title: t("contacto.metaTitle"),
    description: t("contacto.metaDescription", { brand: site.brand }),
  };
}

export default async function ContactPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);
  const t = await getTranslations("pages");

  const channels = [
    { key: "sales", value: site.contact.sales },
    { key: "support", value: site.contact.support },
    { key: "abuse", value: site.contact.abuse },
  ] as const;

  return (
    <>
      <PageHero
        index="/01"
        kicker={t("contacto.kicker")}
        title={
          <>
            {t("contacto.titlePrefix")}
            <span className="text-accent">{t("contacto.titleAccent")}</span>
            {t("contacto.titleSuffix")}
          </>
        }
        description={t("contacto.description")}
      />

      <section className="container-edge grid gap-12 py-16 md:grid-cols-[1fr_320px] md:py-20">
        <div>
          <ContactForm />
        </div>

        <aside className="space-y-6">
          <div>
            <span className="mono-label">{t("contacto.directChannels")}</span>
            <ul className="mt-4 space-y-4">
              {channels.map((c) => (
                <li key={c.key} className="rounded-[var(--radius-md)] border border-[var(--color-line)] p-4">
                  <span className="mono-label text-[0.65rem]">{t(`contacto.channels.${c.key}.label`)}</span>
                  <a
                    href={`mailto:${c.value}`}
                    className="mt-1 block font-mono text-sm text-[var(--color-accent)] hover:underline"
                  >
                    {c.value}
                  </a>
                  <p className="mt-1 text-xs text-[var(--color-fg-muted)]">{t(`contacto.channels.${c.key}.note`)}</p>
                </li>
              ))}
            </ul>
          </div>

          <div className="rounded-[var(--radius-md)] border border-[var(--color-line)] p-4">
            <span className="mono-label text-[0.65rem]">{t("contacto.serviceStatus")}</span>
            <p className="mt-2 text-sm text-[var(--color-fg-muted)]">
              {t("contacto.serviceStatusNote")}
            </p>
            <Link href="/estado" className="mt-2 inline-block font-mono text-sm text-[var(--color-accent)] hover:underline">
              {t("contacto.viewStatus")}
            </Link>
          </div>
        </aside>
      </section>
    </>
  );
}
