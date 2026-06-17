import type { Metadata } from "next";
import { LegalLayout } from "@/components/legal/LegalLayout";

export const metadata: Metadata = {
  title: "Cookie Policy",
  description: "Which cookies ViaHost uses and how to manage them.",
  alternates: { canonical: "/legal/cookies" },
  robots: { index: true, follow: true },
};

export default function CookiesPage() {
  return (
    <LegalLayout
      index="/ Cookies"
      title="Cookie Policy"
      intro="Information about the cookies and similar technologies used by this website and how you can manage them."
      updated="TODO: date"
      sections={[
        { heading: "What cookies are", todo: "Definition and general explanation of cookies and their purpose." },
        { heading: "Cookies we use", todo: "Table for each cookie: name, type (technical, analytics, etc.), purpose, duration and provider. The site currently does NOT load analytics; fill in when added." },
        { heading: "Legal basis and consent", todo: "How consent is obtained for non-essential cookies (banner) and how to withdraw it." },
        { heading: "Managing cookies", todo: "Instructions for configuring or deleting cookies in the main browsers." },
        { heading: "Changes to the policy", todo: "How future updates to this policy will be communicated." },
      ]}
    />
  );
}
