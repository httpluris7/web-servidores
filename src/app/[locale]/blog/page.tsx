import type { Metadata } from "next";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { Link } from "@/i18n/navigation";
import { PageHero } from "@/components/ui/PageHero";
import { Reveal } from "@/components/ui/Reveal";
import { JsonLd } from "@/components/seo/JsonLd";
import { alternatesFor, breadcrumbJsonLd } from "@/lib/seo";
import { allPosts, type BlogLocale } from "@/data/blog";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>;
}): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "blog" });
  return {
    alternates: alternatesFor(locale, "/blog"),
    title: t("metaTitle"),
    description: t("description"),
  };
}

export default async function BlogIndexPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);
  const t = await getTranslations("blog");
  const loc = locale as BlogLocale;
  const fecha = (iso: string) =>
    new Intl.DateTimeFormat(locale, { dateStyle: "long" }).format(new Date(iso));

  const posts = allPosts();

  return (
    <>
      <JsonLd data={breadcrumbJsonLd(locale, [{ name: t("kicker"), path: "/blog" }])} />
      <PageHero
        index="/ Blog"
        kicker={t("kicker")}
        title={<span className="text-accent">{t("title")}</span>}
        description={t("description")}
      />

      <section className="container-edge max-w-4xl py-14 md:py-20">
        <ul className="grid gap-5">
          {posts.map((p, i) => {
            const c = p.content[loc] ?? p.content.en;
            return (
              <Reveal key={p.slug} delay={i} as="article">
                <Link
                  href={`/blog/${p.slug}`}
                  className="group flex h-full flex-col rounded-[var(--radius-lg)] border border-[var(--color-line)] bg-[var(--color-bg-raised)] p-6 transition-colors hover:border-[var(--color-accent)]"
                >
                  <time dateTime={p.date} className="font-mono text-xs text-[var(--color-fg-dim)]">
                    {fecha(p.date)}
                  </time>
                  <h2 className="mt-2 text-xl font-semibold tracking-tight">{c.title}</h2>
                  <p className="mt-2 text-sm text-[var(--color-fg-muted)]">{c.description}</p>
                  <span className="mt-4 font-mono text-xs text-[var(--color-accent)] transition-transform group-hover:translate-x-1">
                    {t("readMore")} →
                  </span>
                </Link>
              </Reveal>
            );
          })}
        </ul>
      </section>
    </>
  );
}
