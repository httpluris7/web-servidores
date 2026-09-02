import { Hero } from "@/components/home/Hero";
import { DomainSearchBanner } from "@/components/home/DomainSearchBanner";
import { HostingBanner } from "@/components/home/HostingBanner";
import { CredibilityStats } from "@/components/home/CredibilityStats";
import { ProvisionTerminal } from "@/components/home/ProvisionTerminal";
import { HardwareCounters } from "@/components/home/HardwareCounters";
import { ProductsGrid } from "@/components/home/ProductsGrid";
import { NetworkBackbone } from "@/components/home/NetworkBackbone";
import { WhyUs } from "@/components/home/WhyUs";
import { UseCases } from "@/components/home/UseCases";
import { DDoSSection } from "@/components/home/DDoSSection";
import { TrustSection } from "@/components/home/TrustSection";
import { FinalCTA } from "@/components/home/FinalCTA";
import { setRequestLocale } from "next-intl/server";
import type { Metadata } from "next";
import { alternatesFor } from "@/lib/seo";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>;
}): Promise<Metadata> {
  const { locale } = await params;
  return { alternates: alternatesFor(locale, "/") };
}

export default async function HomePage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);
  return (
    <>
      <Hero />
      <DomainSearchBanner />
      <HostingBanner />
      <CredibilityStats />
      <ProvisionTerminal />
      <HardwareCounters />
      <ProductsGrid />
      <NetworkBackbone />
      <WhyUs />
      <UseCases />
      <DDoSSection />
      <TrustSection />
      <FinalCTA />
    </>
  );
}
