import type { Metadata } from "next";
import { site } from "@/data/site";
import { PageHero } from "@/components/ui/PageHero";
import { ContactForm } from "@/components/forms/ContactForm";

export const metadata: Metadata = {
  title: "Contact",
  description: `Talk to the ${site.brand} team: sales, technical support or abuse reports. Average response under 10 minutes on incidents.`,
  alternates: { canonical: "/contacto" },
};

const channels = [
  { label: "Sales", value: site.contact.sales, note: "Quotes and custom configurations" },
  { label: "Support", value: site.contact.support, note: "Customers with active service" },
  { label: "Abuse", value: site.contact.abuse, note: "Misuse reports" },
];

export default function ContactPage() {
  return (
    <>
      <PageHero
        index="/01"
        kicker="Contact"
        title={
          <>
            Let&apos;s talk. <span className="text-accent">Really</span>.
          </>
        }
        description="Real people on the other side, 24/7. Reach us through the form or directly via the channel that fits best."
      />

      <section className="container-edge grid gap-12 py-16 md:grid-cols-[1fr_320px] md:py-20">
        <div>
          <ContactForm />
        </div>

        <aside className="space-y-6">
          <div>
            <span className="mono-label">Direct channels</span>
            <ul className="mt-4 space-y-4">
              {channels.map((c) => (
                <li key={c.label} className="rounded-[var(--radius-md)] border border-[var(--color-line)] p-4">
                  <span className="mono-label text-[0.65rem]">{c.label}</span>
                  <a
                    href={`mailto:${c.value}`}
                    className="mt-1 block font-mono text-sm text-[var(--color-accent)] hover:underline"
                  >
                    {c.value}
                  </a>
                  <p className="mt-1 text-xs text-[var(--color-fg-muted)]">{c.note}</p>
                </li>
              ))}
            </ul>
          </div>

          <div className="rounded-[var(--radius-md)] border border-[var(--color-line)] p-4">
            <span className="mono-label text-[0.65rem]">Service status</span>
            <p className="mt-2 text-sm text-[var(--color-fg-muted)]">
              Check incidents and maintenance in real time.
            </p>
            <a href="/estado" className="mt-2 inline-block font-mono text-sm text-[var(--color-accent)] hover:underline">
              View status →
            </a>
          </div>
        </aside>
      </section>
    </>
  );
}
