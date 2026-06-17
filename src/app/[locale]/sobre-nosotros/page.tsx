import type { Metadata } from "next";
import { site } from "@/data/site";
import { PageHero } from "@/components/ui/PageHero";
import { CtaBand } from "@/components/ui/CtaBand";
import { Reveal } from "@/components/ui/Reveal";
import { SectionHeader } from "@/components/ui/SectionHeader";

export const metadata: Metadata = {
  title: "About us",
  description: `${site.brand} is a European hosting provider with its own network (${site.network.asn}), focused on instant provisioning, hardware with no overselling and DDoS mitigation included.`,
  alternates: { canonical: "/sobre-nosotros" },
};

const principles = [
  {
    t: "No overselling",
    d: "What you order physically exists and is reserved for you. No theoretical maximums, no noisy neighbors.",
  },
  {
    t: "Automation first",
    d: "From provisioning to mitigation, the system acts on its own. Human support is reserved for what matters.",
  },
  {
    t: "Our own network",
    d: `We operate our autonomous system ${site.network.asn} and direct peering; we don't resell anyone else's network.`,
  },
  {
    t: "Honest pricing",
    d: "Monthly billing, no setup fees and no lock-in. DDoS protection is included, not an add-on.",
  },
];

export default function AboutPage() {
  return (
    <>
      <PageHero
        index="/01"
        kicker="About us"
        title={
          <>
            European infrastructure, <span className="text-accent">no fine print</span>.
          </>
        }
        description={`${site.brand} was born to make deploying a server as fast as it should be: seconds, not days. Our own network, real hardware and a single promise kept every time.`}
      />

      {/* TODO: sustituir por la historia real de la empresa, hitos y equipo. */}
      <section className="container-edge py-14 md:py-28">
        <SectionHeader index="/02" kicker="How we work" title="Four principles, no exceptions." />
        <div className="mt-12 grid gap-px overflow-hidden rounded-[var(--radius-lg)] border border-[var(--color-line)] bg-[var(--color-line)] sm:grid-cols-2">
          {principles.map((p) => (
            <Reveal key={p.t} className="bg-[var(--color-bg-base)] p-8">
              <h3 className="text-xl font-semibold">{p.t}</h3>
              <p className="mt-2 text-sm leading-relaxed text-[var(--color-fg-muted)]">{p.d}</p>
            </Reveal>
          ))}
        </div>

        <Reveal className="mt-16">
          <div className="rounded-[var(--radius-lg)] border border-[var(--color-line)] bg-[var(--color-bg-raised)] p-8">
            <span className="mono-label">Company details</span>
            <dl className="mt-6 grid gap-4 font-mono text-sm sm:grid-cols-2">
              <div>
                <dt className="text-[var(--color-fg-dim)]">Legal name</dt>
                <dd className="mt-1">{site.legal.companyName}</dd>
              </div>
              <div>
                <dt className="text-[var(--color-fg-dim)]">Incorporation</dt>
                <dd className="mt-1">{site.legal.jurisdiction}</dd>
              </div>
              <div>
                <dt className="text-[var(--color-fg-dim)]">EIN / Tax ID</dt>
                <dd className="mt-1">{site.legal.taxId}</dd>
              </div>
              <div>
                <dt className="text-[var(--color-fg-dim)]">Autonomous system</dt>
                <dd className="mt-1 text-[var(--color-accent)]">{site.network.asn}</dd>
              </div>
              <div className="sm:col-span-2">
                <dt className="text-[var(--color-fg-dim)]">Registered address</dt>
                <dd className="mt-1">{site.legal.address}</dd>
              </div>
            </dl>
            <p className="mt-6 text-xs text-[var(--color-fg-dim)]">
              {/* TODO: confirmar todos los datos legales con el cliente antes de publicar. */}
              Provisional data pending client confirmation.
            </p>
          </div>
        </Reveal>
      </section>

      <CtaBand title="Join those already deploying with us" />
    </>
  );
}
