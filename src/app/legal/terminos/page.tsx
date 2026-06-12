import type { Metadata } from "next";
import { LegalLayout } from "@/components/legal/LegalLayout";

export const metadata: Metadata = {
  title: "Terms and Conditions",
  description: "Terms of use and ordering for ViaHost services.",
  alternates: { canonical: "/legal/terminos" },
  robots: { index: true, follow: true },
};

export default function TermsPage() {
  return (
    <LegalLayout
      index="/ Terms"
      title="Terms and Conditions"
      intro="Terms governing the use and ordering of the hosting, VPS, dedicated server and DDoS mitigation services."
      updated="TODO: date"
      sections={[
        { heading: "Purpose and acceptance", todo: "Description of the services and acceptance of the terms upon ordering." },
        { heading: "Ordering and payment", todo: "Sign-up process, payment methods, renewal, taxes and refund policy." },
        { heading: "Acceptable use", todo: "Prohibited conduct (abuse, unlawful content, spam) and consequences of non-compliance." },
        { heading: "Service levels (SLA)", todo: "Availability commitment, exclusions and compensation for non-compliance." },
        { heading: "Liability", todo: "Limitation of liability and applicable exclusions." },
        { heading: "Suspension and termination", todo: "Grounds and procedure for suspension or termination of the service by either party." },
        { heading: "Governing law and jurisdiction", todo: "Applicable law and competent jurisdiction for dispute resolution." },
      ]}
    />
  );
}
