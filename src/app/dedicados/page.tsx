import type { Metadata } from "next";
import Link from "next/link";
import { dedicatedTypes } from "@/data/products";
import { dedicatedFaq } from "@/data/faq";
import { eur } from "@/lib/utils";
import { PageHero } from "@/components/ui/PageHero";
import { FaqSection } from "@/components/ui/FaqSection";
import { CtaBand } from "@/components/ui/CtaBand";
import { Reveal } from "@/components/ui/Reveal";
import { SectionHeader } from "@/components/ui/SectionHeader";

export const metadata: Metadata = {
  title: "Dedicated Servers — Bare metal AMD EPYC",
  description:
    "Bare metal AMD EPYC and Ryzen dedicated servers with 1 and 10 Gbps uplinks, NVMe Gen4 and high-capacity storage. No overselling, DDoS included.",
  alternates: { canonical: "/dedicados" },
};

export default function DedicatedPage() {
  return (
    <>
      <PageHero
        index="/01"
        kicker="Dedicated Servers"
        title={
          <>
            Bare metal <span className="text-accent">with no overselling</span>.
          </>
        }
        description="Exclusively dedicated AMD EPYC and Ryzen hardware. Guaranteed uplinks, NVMe Gen4 and IPMI/KVM management. What you order is what you get."
      />

      <section className="container-edge py-14 md:py-24">
        <SectionHeader
          index="/02"
          kicker="Locations"
          title="Two locations, one goal: real performance."
        />
        <div className="mt-12 grid gap-5 sm:grid-cols-2">
          {dedicatedTypes.map((d, i) => {
            const from = Math.min(...d.plans.map((p) => p.price));
            return (
              <Reveal key={d.slug} delay={i} as="article">
                <Link
                  href={`/dedicados/${d.slug}`}
                  className="group flex h-full flex-col rounded-[var(--radius-lg)] border border-[var(--color-line)] bg-[var(--color-bg-raised)] p-6 transition-all hover:border-[var(--color-accent)]"
                >
                  <span className="font-mono text-xs text-[var(--color-accent)]">{d.highlight}</span>
                  <h3 className="mt-4 text-2xl font-semibold tracking-tight">{d.title}</h3>
                  <p className="mt-2 text-sm text-[var(--color-fg-muted)]">{d.tagline}</p>
                  <div className="mt-auto pt-8">
                    <span className="mono-label block text-[0.65rem]">From</span>
                    <span className="font-mono text-3xl font-semibold">
                      {eur(from)}
                      <span className="text-base text-[var(--color-fg-muted)]">/mo</span>
                    </span>
                  </div>
                  <span className="mt-4 font-mono text-xs text-[var(--color-fg-dim)] transition-colors group-hover:text-[var(--color-accent)]">
                    View configurations →
                  </span>
                </Link>
              </Reveal>
            );
          })}
        </div>
      </section>

      <FaqSection items={dedicatedFaq} index="/03" />
      <CtaBand title="Need a custom configuration?" />
    </>
  );
}
