import type { Metadata } from "next";
import Link from "next/link";
import { vps, regions } from "@/data/products";
import { vpsFaq } from "@/data/faq";
import { site } from "@/data/site";
import { eur } from "@/lib/utils";
import { PageHero } from "@/components/ui/PageHero";
import { PlanGrid } from "@/components/product/PlanGrid";
import { FaqSection } from "@/components/ui/FaqSection";
import { CtaBand } from "@/components/ui/CtaBand";
import { Reveal } from "@/components/ui/Reveal";
import { SectionHeader } from "@/components/ui/SectionHeader";

export const metadata: Metadata = {
  title: "Cloud VPS — NVMe Gen4 and 10 Gbps",
  description:
    "NVMe Gen4 VPS with 10 Gbps networking and DDoS protection included, in strategic European regions. From " +
    eur(Math.min(...vps.plans.map((p) => p.price))) +
    "/mo. Provisioning in 60 seconds.",
  alternates: { canonical: "/vps" },
};

const productJsonLd = {
  "@context": "https://schema.org",
  "@type": "Product",
  name: `${site.brand} Cloud VPS`,
  description: vps.tagline,
  brand: { "@type": "Brand", name: site.brand },
  offers: vps.plans.map((p) => ({
    "@type": "Offer",
    name: p.name,
    price: p.price,
    priceCurrency: "EUR",
    url: p.orderUrl,
    availability: "https://schema.org/InStock",
  })),
};

export default function VpsPage() {
  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(productJsonLd) }}
      />
      <PageHero
        index="/01"
        kicker="Cloud VPS"
        title={
          <>
            <span className="text-accent">NVMe</span> virtual machines, ready in 60 s.
          </>
        }
        description={vps.tagline}
      />

      <PlanGrid
        index="/02"
        kicker="Plans"
        title="Choose your size."
        description="Same NVMe Gen4, same 10 Gbps network and the same DDoS protection across all plans."
        plans={vps.plans}
      />

      {/* Regiones */}
      <section className="border-t border-[var(--color-line)] bg-[var(--color-bg-raised)]">
        <div className="container-edge py-14 md:py-24">
          <SectionHeader
            index="/03"
            kicker="Locations"
            title="Deploy close to your users."
            description="European regions with direct peering. Same experience, lower latency."
          />
          <div className="mt-12 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {regions.map((r, i) => (
              <Reveal key={r.slug} delay={i % 3}>
                <Link
                  href={`/vps/${r.slug}`}
                  className="group flex items-center justify-between rounded-[var(--radius-lg)] border border-[var(--color-line)] bg-[var(--color-bg-base)] p-5 transition-colors hover:border-[var(--color-accent)]"
                >
                  <div>
                    <span className="flex items-center gap-2 text-lg font-medium">
                      <span aria-hidden="true">{r.flag}</span>
                      {r.name}
                    </span>
                    <span className="mt-1 block font-mono text-xs text-[var(--color-fg-muted)]">
                      {r.city} · {r.latencyNote}
                    </span>
                  </div>
                  <span className="text-right">
                    <span className="mono-label block text-[0.6rem]">from</span>
                    <span className="font-mono text-lg">{eur(r.priceFrom)}</span>
                  </span>
                </Link>
              </Reveal>
            ))}
          </div>
        </div>
      </section>

      <FaqSection items={vpsFaq} index="/04" />
      <CtaBand />
    </>
  );
}
