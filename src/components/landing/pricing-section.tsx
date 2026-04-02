"use client";

/**
 * PROBATIO — Pricing Section
 *
 * Three SaaS tiers displayed in cards plus a forensic pricing callout.
 * Responsive: stacks on mobile, row on desktop.
 */

import { useRef } from "react";
import { motion, useInView } from "framer-motion";
import { Check } from "lucide-react";
import Link from "next/link";
import { useTranslations } from "next-intl";
import { cn } from "@/lib/utils";

// ────────────────────────────────────────────────────────────────────────────
// Data
// ────────────────────────────────────────────────────────────────────────────

interface PricingTier {
  planKey: string;
  highlighted: boolean;
}

const tiers: PricingTier[] = [
  { planKey: "free", highlighted: false },
  { planKey: "starter", highlighted: true },
  { planKey: "professional", highlighted: false },
  { planKey: "enterprise", highlighted: false },
];

// ────────────────────────────────────────────────────────────────────────────
// Animation
// ────────────────────────────────────────────────────────────────────────────

const fadeUp = {
  hidden: { opacity: 0, y: 20 },
  visible: (delay: number) => ({
    opacity: 1,
    y: 0,
    transition: {
      duration: 0.6,
      delay,
      ease: [0.16, 1, 0.3, 1] as [number, number, number, number],
    },
  }),
};

// ────────────────────────────────────────────────────────────────────────────
// Pricing Card
// ────────────────────────────────────────────────────────────────────────────

function PricingCard({
  tier,
  index,
  isInView,
  t,
}: {
  tier: PricingTier;
  index: number;
  isInView: boolean;
  t: ReturnType<typeof useTranslations>;
}) {
  const features = t.raw(`plans.${tier.planKey}.features`) as string[];

  return (
    <motion.div
      className={cn(
        "flex flex-col rounded-lg border bg-carbon p-6 md:p-8",
        tier.highlighted
          ? "border-forensic-blue shadow-glow-blue"
          : "border-slate",
      )}
      variants={fadeUp}
      initial="hidden"
      animate={isInView ? "visible" : "hidden"}
      custom={0.1 + index * 0.1}
    >
      {/* Plan name */}
      <h3 className="font-display text-xl text-bone">{t(`plans.${tier.planKey}.name`)}</h3>

      {/* Price */}
      <div className="mt-4 flex items-baseline gap-1">
        <span className={cn(
          "font-sans font-bold text-bone",
          t(`plans.${tier.planKey}.price`).length > 4 ? "text-2xl" : "text-3xl"
        )}>
          {t(`plans.${tier.planKey}.price`)}
        </span>
        <span className="text-sm text-ash">{t(`plans.${tier.planKey}.period`)}</span>
      </div>

      {/* Features */}
      <ul className="mt-6 flex flex-1 flex-col gap-3">
        {features.map((feature: string) => (
          <li key={feature} className="flex items-start gap-2.5">
            <Check className="mt-0.5 h-4 w-4 shrink-0 text-forensic-blue" />
            <span className="text-sm text-ash">{feature}</span>
          </li>
        ))}
      </ul>

      {/* CTA */}
      <Link
        href={tier.planKey === "enterprise" ? "/contact" : "/signup"}
        className={cn(
          "mt-8 inline-flex items-center justify-center rounded-md px-6 py-2.5",
          "font-sans text-sm font-medium transition-all duration-200",
          tier.highlighted
            ? "bg-forensic-blue text-bone hover:bg-forensic-blue/85 hover:shadow-glow-blue"
            : "border border-slate bg-transparent text-bone hover:border-ash hover:bg-graphite",
          "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-forensic-blue focus-visible:ring-offset-2 focus-visible:ring-offset-obsidian",
        )}
      >
        {t(`plans.${tier.planKey}.cta`)}
      </Link>
    </motion.div>
  );
}

// ────────────────────────────────────────────────────────────────────────────
// Export
// ────────────────────────────────────────────────────────────────────────────

export function PricingSection() {
  const ref = useRef<HTMLDivElement>(null);
  const isInView = useInView(ref, { once: true, margin: "-80px 0px" });
  const t = useTranslations('landing.pricing');

  return (
    <section className="bg-obsidian py-24" ref={ref}>
      <div className="mx-auto max-w-240 px-6">
        {/* Header */}
        <motion.div
          className="mb-14 text-center"
          variants={fadeUp}
          initial="hidden"
          animate={isInView ? "visible" : "hidden"}
          custom={0}
        >
          <h2 className="font-display text-3xl text-bone">{t('title')}</h2>
          <p className="mt-3 font-sans text-base text-ash">
            {t('subtitle')}
          </p>
        </motion.div>

        {/* Tier cards */}
        <div className="grid gap-6 md:grid-cols-4">
          {tiers.map((tier, i) => (
            <PricingCard
              key={tier.planKey}
              tier={tier}
              index={i}
              isInView={isInView}
              t={t}
            />
          ))}
        </div>

        {/* Forensic pricing section */}
        <motion.div
          className="mt-10 rounded-lg border border-evidence-gold/30 bg-carbon p-6 md:p-8"
          variants={fadeUp}
          initial="hidden"
          animate={isInView ? "visible" : "hidden"}
          custom={0.5}
        >
          <div className="mb-6">
            <h3 className="font-display text-xl text-evidence-gold">
              {t('forensic.title')}
            </h3>
            <p className="mt-1 text-sm text-ash">
              {t('forensic.subtitle')}
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* Standard */}
            <div className="rounded-md border border-slate p-5">
              <div className="flex items-baseline justify-between mb-3">
                <h4 className="font-sans text-base font-semibold text-bone">
                  {t('forensic.standard.name')}
                </h4>
                <span className="text-lg font-bold text-evidence-gold">
                  {t('forensic.standard.price')}
                </span>
              </div>
              <ul className="space-y-2">
                {(t.raw('forensic.standard.features') as string[]).map((f: string) => (
                  <li key={f} className="flex items-start gap-2">
                    <Check className="mt-0.5 h-3.5 w-3.5 shrink-0 text-evidence-gold" />
                    <span className="text-xs text-ash">{f}</span>
                  </li>
                ))}
              </ul>
            </div>

            {/* Expert */}
            <div className="rounded-md border border-evidence-gold/50 bg-evidence-gold/5 p-5">
              <div className="flex items-baseline justify-between mb-3">
                <h4 className="font-sans text-base font-semibold text-bone">
                  {t('forensic.expert.name')}
                </h4>
                <span className="text-lg font-bold text-evidence-gold">
                  {t('forensic.expert.price')}
                </span>
              </div>
              <ul className="space-y-2">
                {(t.raw('forensic.expert.features') as string[]).map((f: string) => (
                  <li key={f} className="flex items-start gap-2">
                    <Check className="mt-0.5 h-3.5 w-3.5 shrink-0 text-evidence-gold" />
                    <span className="text-xs text-ash">{f}</span>
                  </li>
                ))}
              </ul>
            </div>
          </div>

          <p className="mt-4 text-xs text-ash text-center">
            Requires Professional or Enterprise subscription
          </p>
        </motion.div>
      </div>
    </section>
  );
}
