import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { Link } from "@/i18n/navigation";
import { site } from "@/data/site";
import { PageHero } from "@/components/ui/PageHero";
import { Accordion } from "@/components/ui/Accordion";
import { CtaBand } from "@/components/ui/CtaBand";
import { JsonLd } from "@/components/seo/JsonLd";
import { alternatesFor, breadcrumbJsonLd } from "@/lib/seo";
import { allPosts, getPost, type BlogLocale } from "@/data/blog";

type Params = { locale: string; slug: string };

export function generateStaticParams(): { slug: string }[] {
  return allPosts().map((p) => ({ slug: p.slug }));
}

export async function generateMetadata({ params }: { params: Promise<Params> }): Promise<Metadata> {
  const { locale, slug } = await params;
  const post = getPost(slug);
  if (!post) return {};
  const c = post.content[locale as BlogLocale] ?? post.content.en;
  return {
    alternates: alternatesFor(locale, `/blog/${slug}`),
    title: c.title,
    description: c.description,
  };
}

export default async function BlogPostPage({ params }: { params: Promise<Params> }) {
  const { locale, slug } = await params;
  setRequestLocale(locale);
  const post = getPost(slug);
  if (!post) notFound();

  const t = await getTranslations("blog");
  const c = post.content[locale as BlogLocale] ?? post.content.en;
  const url = `${site.url}${locale === "en" ? "" : `/${locale}`}/blog/${slug}`;
  const fecha = new Intl.DateTimeFormat(locale, { dateStyle: "long" }).format(new Date(post.date));

  // Article o HowTo según el tipo del post.
  const mainJsonLd =
    post.type === "howto"
      ? {
          "@context": "https://schema.org",
          "@type": "HowTo",
          name: c.title,
          description: c.description,
          datePublished: post.date,
          inLanguage: locale,
          step: c.sections.map((s, i) => ({
            "@type": "HowToStep",
            position: i + 1,
            name: s.heading,
            text: s.body.join(" "),
          })),
        }
      : {
          "@context": "https://schema.org",
          "@type": "Article",
          headline: c.title,
          description: c.description,
          datePublished: post.date,
          dateModified: post.date,
          inLanguage: locale,
          author: { "@type": "Organization", name: site.brand },
          publisher: { "@id": `${site.url}/#organization` },
          mainEntityOfPage: url,
        };

  const faqJsonLd = c.faq && {
    "@context": "https://schema.org",
    "@type": "FAQPage",
    mainEntity: c.faq.map((f) => ({
      "@type": "Question",
      name: f.q,
      acceptedAnswer: { "@type": "Answer", text: f.a },
    })),
  };

  return (
    <>
      <JsonLd data={mainJsonLd} />
      {faqJsonLd && <JsonLd data={faqJsonLd} />}
      <JsonLd
        data={breadcrumbJsonLd(locale, [
          { name: t("kicker"), path: "/blog" },
          { name: c.title, path: `/blog/${slug}` },
        ])}
      />

      <PageHero index="/ Blog" kicker={t("kicker")} title={c.title} description={c.description} />

      <article className="container-edge max-w-3xl py-12 md:py-16">
        <p className="mb-6 flex flex-wrap items-center gap-3 text-xs text-[var(--color-fg-dim)]">
          <Link href="/blog" className="text-[var(--color-accent)] hover:underline">
            {t("backToBlog")}
          </Link>
          <span>·</span>
          <span>
            {t("publishedOn")} <time dateTime={post.date}>{fecha}</time>
          </span>
        </p>

        <div className="space-y-4 text-[var(--color-fg-muted)]">
          {c.intro.map((p, i) => (
            <p key={i}>{p}</p>
          ))}
        </div>

        {c.sections.map((s, i) => (
          <section key={i} className="mt-10">
            <h2 className="text-xl font-semibold tracking-tight text-[var(--color-fg)]">
              {post.type === "howto" ? `${i + 1}. ${s.heading}` : s.heading}
            </h2>
            <div className="mt-3 space-y-3 text-[var(--color-fg-muted)]">
              {s.body.map((p, j) => (
                <p key={j}>{p}</p>
              ))}
            </div>
          </section>
        ))}

        {c.faq && c.faq.length > 0 && (
          <section className="mt-12">
            <h2 className="mono-label mb-6">{t("faqTitle")}</h2>
            <Accordion items={c.faq} />
          </section>
        )}

        <div className="mt-12">
          <Link
            href={post.ctaHref}
            className="inline-flex items-center justify-center rounded-[var(--radius-md)] bg-[var(--color-accent)] px-6 py-3 text-sm font-medium text-black transition-colors hover:bg-[var(--color-accent-dim)]"
          >
            {c.cta} →
          </Link>
        </div>
      </article>

      <CtaBand />
    </>
  );
}
