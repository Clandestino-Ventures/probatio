import type { Metadata } from "next";
import { Hero } from "@/components/landing/hero";

export const metadata: Metadata = {
  title: "Probatio — Forensic Audio Intelligence",
  description: "Court-admissible audio similarity analysis for the music industry. Cryptographic chain of custody. 4-dimension forensic comparison. The proof is in the signal.",
};
import { TwoModes } from "@/components/landing/two-modes";
import { PipelineVisual } from "@/components/landing/pipeline-visual";
import { EvidenceSection } from "@/components/landing/evidence-section";
import { ForWho } from "@/components/landing/for-who";
import { PricingSection } from "@/components/landing/pricing-section";
import { FAQ } from "@/components/landing/faq";

export default function LandingPage() {
  return (
    <div className="bg-obsidian">
      <Hero />
      <div id="modes">
        <TwoModes />
      </div>
      <div id="how-it-works">
        <PipelineVisual />
      </div>
      <EvidenceSection />
      <ForWho />
      <div id="pricing">
        <PricingSection />
      </div>
      <div id="faq">
        <FAQ />
      </div>
    </div>
  );
}
