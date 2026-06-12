import type { Metadata } from "next";
import Link from "next/link";
import { site } from "@/data/site";
import { vpsFaq, dedicatedFaq } from "@/data/faq";
import { PageHero } from "@/components/ui/PageHero";
import { Accordion } from "@/components/ui/Accordion";
import { SectionHeader } from "@/components/ui/SectionHeader";
import { Reveal } from "@/components/ui/Reveal";

export const metadata: Metadata = {
  title: "Support",
  description: `${site.brand} help center: quick guides, frequently asked questions, service status and 24/7 contact with engineering.`,
  alternates: { canonical: "/soporte" },
};

const quickLinks = [
  { href: "/estado", title: "Service status", desc: "Incidents and maintenance in real time.", arrow: "→" },
  { href: "/contacto", title: "Open a request", desc: "Sales, technical support or abuse.", arrow: "→" },
  { href: "/desplegar", title: "Deploy a server", desc: "Pick a plan and deploy in 60 s.", arrow: "→" },
];

const categories = [
  { title: "Getting started", items: ["SSH access", "Reinstall the system", "Keys and users"] },
  { title: "Network and DNS", items: ["IPs and rDNS", "Point your domain", "Reverse proxy"] },
  { title: "Security", items: ["DDoS protection", "Firewall rules", "Best practices"] },
  { title: "Billing", items: ["Payment methods", "Change plan", "Cancel service"] },
];

export default function SupportPage() {
  return (
    <>
      <PageHero
        index="/01"
        kicker="Support center"
        title={
          <>
            Help <span className="text-accent">when</span> you need it.
          </>
        }
        description="On-call engineering 24/7 with an average response under 10 minutes on incidents. Start here."
      />

      {/* Accesos rápidos */}
      <section className="container-edge py-16 md:py-20">
        <div className="grid gap-4 md:grid-cols-3">
          {quickLinks.map((q, i) => (
            <Reveal key={q.href} delay={i}>
              <Link
                href={q.href}
                className="group flex h-full flex-col rounded-[var(--radius-lg)] border border-[var(--color-line)] bg-[var(--color-bg-raised)] p-6 transition-colors hover:border-[var(--color-accent)]"
              >
                <div className="flex items-center justify-between">
                  <h2 className="text-lg font-semibold">{q.title}</h2>
                  <span className="font-mono text-[var(--color-fg-dim)] transition-colors group-hover:text-[var(--color-accent)]">
                    {q.arrow}
                  </span>
                </div>
                <p className="mt-2 text-sm text-[var(--color-fg-muted)]">{q.desc}</p>
              </Link>
            </Reveal>
          ))}
        </div>
      </section>

      {/* Categorías de ayuda */}
      <section className="border-y border-[var(--color-line)] bg-[var(--color-bg-raised)]">
        <div className="container-edge py-16 md:py-20">
          <SectionHeader index="/02" kicker="Documentation" title="Browse by category." />
          <div className="mt-10 grid gap-px overflow-hidden rounded-[var(--radius-lg)] border border-[var(--color-line)] bg-[var(--color-line)] sm:grid-cols-2 lg:grid-cols-4">
            {categories.map((c) => (
              <div key={c.title} className="bg-[var(--color-bg-raised)] p-6">
                <h3 className="mono-label">{c.title}</h3>
                <ul className="mt-4 space-y-2 text-sm text-[var(--color-fg-muted)]">
                  {c.items.map((it) => (
                    // TODO: enlazar a artículos de documentación reales cuando existan.
                    <li key={it} className="flex items-start gap-2">
                      <span className="mt-0.5 text-[var(--color-accent)]">▸</span>
                      {it}
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* FAQ combinada */}
      <section className="container-edge py-16 md:py-20">
        <SectionHeader index="/03" kicker="Frequently asked questions" title="The most common questions." />
        <div className="mt-10 max-w-3xl">
          <Accordion items={[...vpsFaq, ...dedicatedFaq].slice(0, 8)} />
        </div>
        <p className="mt-8 text-sm text-[var(--color-fg-muted)]">
          Can&apos;t find what you&apos;re looking for?{" "}
          <Link href="/contacto" className="text-[var(--color-accent)] hover:underline">
            Write to us
          </Link>{" "}
          or check the{" "}
          <Link href="/estado" className="text-[var(--color-accent)] hover:underline">
            service status
          </Link>
          .
        </p>
      </section>
    </>
  );
}
