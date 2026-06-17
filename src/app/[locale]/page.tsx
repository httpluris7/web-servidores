import { Hero } from "@/components/home/Hero";
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

export default function HomePage() {
  return (
    <>
      <Hero />
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
