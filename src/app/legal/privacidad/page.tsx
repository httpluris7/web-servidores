import type { Metadata } from "next";
import { LegalLayout } from "@/components/legal/LegalLayout";

export const metadata: Metadata = {
  title: "Privacy Policy",
  description:
    "How ViaHost processes personal data in accordance with the GDPR for EEA customers and applicable data protection law.",
  alternates: { canonical: "/legal/privacidad" },
  robots: { index: true, follow: true },
};

export default function PrivacyPage() {
  return (
    <LegalLayout
      index="/ Privacy"
      title="Privacy Policy"
      intro="How we collect, process and protect your personal data. ViaHost Infrastructure LLC acts as the controller; the GDPR (EU 2016/679) applies to customers in the European Economic Area."
      updated="TODO: date"
      sections={[
        { heading: "Data controller", todo: "Identity and contact details of the controller: LLC legal name, EIN/registration, registered address, and EU representative / DPO if applicable (GDPR art. 27 for companies outside the EU)." },
        { heading: "Data we collect", todo: "Data categories: account, billing, technical logs, cookies. Detail each purpose." },
        { heading: "Purpose and legal basis", todo: "Processing purposes and legal basis (performance of a contract, consent, legitimate interest)." },
        { heading: "Data retention", todo: "Retention periods by category and applied criteria." },
        { heading: "Recipients and processors", todo: "Third parties with access (payment providers, infrastructure) and international transfers, if any." },
        { heading: "Your rights", todo: "Access, rectification, erasure, objection, portability and restriction; how to exercise them and lodge a complaint with the competent supervisory authority (EEA customers, with their data protection authority)." },
        { heading: "Security", todo: "Technical and organizational measures applied to protect the data." },
      ]}
    />
  );
}
