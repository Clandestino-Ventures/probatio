import type { Metadata } from "next";
import { PricingSection } from "@/components/landing/pricing-section";

export const metadata: Metadata = {
  title: "Pricing",
  description: "Plans from $149/month. Forensic analysis from $5,000 per case. Enterprise unlimited.",
};
import { FAQ } from "@/components/landing/faq";

export default function PricingPage() {
  return (
    <div className="bg-obsidian">
      <PricingSection />
      <FAQ />
    </div>
  );
}
