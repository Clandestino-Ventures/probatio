"use client";

/**
 * PROBATIO — Evidence Section
 *
 * Dark card section selling the forensic/evidence capabilities.
 * Chain-link SVG texture background, evidence-gold accents, pull quote.
 */

import { useRef } from "react";
import { motion, useInView } from "framer-motion";
import { Shield, RefreshCw, Scale } from "lucide-react";
import { useTranslations } from "next-intl";
import { cn } from "@/lib/utils";

// ────────────────────────────────────────────────────────────────────────────
// Data
// ────────────────────────────────────────────────────────────────────────────

const capabilities = [
  {
    icon: Shield,
    title: "SHA-256 Hash Chain",
    description:
      "Every step in the pipeline is cryptographically sealed. Tamper-evident by design.",
  },
  {
    icon: RefreshCw,
    title: "Deterministic Pipeline",
    description:
      "Same input, same version, same output. Reproducible results that hold up under scrutiny.",
  },
  {
    icon: Scale,
    title: "Daubert Compliant",
    description:
      "Methodology designed to meet the federal standard for expert testimony admissibility.",
  },
] as const;

// ────────────────────────────────────────────────────────────────────────────
// Chain Link SVG Pattern (decorative background)
// ────────────────────────────────────────────────────────────────────────────

function ChainPattern() {
  return (
    <svg
      className="pointer-events-none absolute inset-0 h-full w-full"
      aria-hidden="true"
    >
      <defs>
        <pattern
          id="chain-pattern"
          x="0"
          y="0"
          width="60"
          height="30"
          patternUnits="userSpaceOnUse"
        >
          {/* Horizontal chain links */}
          <ellipse
            cx="15"
            cy="15"
            rx="12"
            ry="7"
            fill="none"
            stroke="#C4992E"
            strokeWidth="1"
            opacity="0.06"
          />
          <ellipse
            cx="45"
            cy="15"
            rx="12"
            ry="7"
            fill="none"
            stroke="#C4992E"
            strokeWidth="1"
            opacity="0.06"
          />
        </pattern>
      </defs>
      <rect width="100%" height="100%" fill="url(#chain-pattern)" />
    </svg>
  );
}

// ────────────────────────────────────────────────────────────────────────────
// Animation Variants
// ────────────────────────────────────────────────────────────────────────────

const fadeUp = {
  hidden: { opacity: 0, y: 20 },
  visible: (delay: number) => ({
    opacity: 1,
    y: 0,
    transition: {
      duration: 0.7,
      delay,
      ease: [0.16, 1, 0.3, 1] as [number, number, number, number],
    },
  }),
};

// ────────────────────────────────────────────────────────────────────────────
// Export
// ────────────────────────────────────────────────────────────────────────────

export function EvidenceSection() {
  const ref = useRef<HTMLDivElement>(null);
  const isInView = useInView(ref, { once: true, margin: "-80px 0px" });
  const t = useTranslations('landing.evidence');

  return (
    <section className="bg-obsidian py-24" ref={ref}>
      <div className="mx-auto max-w-240 px-6">
        {/* Card */}
        <div className="relative overflow-hidden rounded-lg border border-evidence-gold/20 bg-carbon p-8 md:p-12">
          {/* Decorative chain pattern */}
          <ChainPattern />

          {/* Content */}
          <div className="relative z-10">
            {/* Header */}
            <motion.h2
              className="font-display text-3xl text-evidence-gold"
              variants={fadeUp}
              initial="hidden"
              animate={isInView ? "visible" : "hidden"}
              custom={0}
            >
              {t('title')}
            </motion.h2>
            <motion.p
              className="mt-2 font-sans text-base text-ash"
              variants={fadeUp}
              initial="hidden"
              animate={isInView ? "visible" : "hidden"}
              custom={0.1}
            >
              {t('subtitle')}
            </motion.p>

            {/* Capabilities */}
            <div className="mt-10 flex flex-col gap-8">
              {capabilities.map((cap, i) => {
                const Icon = cap.icon;
                return (
                  <motion.div
                    key={cap.title}
                    className="flex gap-4"
                    variants={fadeUp}
                    initial="hidden"
                    animate={isInView ? "visible" : "hidden"}
                    custom={0.2 + i * 0.1}
                  >
                    {/* Gold dot / icon */}
                    <div className="mt-1 flex h-6 w-6 shrink-0 items-center justify-center">
                      <Icon className="h-5 w-5 text-evidence-gold" />
                    </div>
                    <div>
                      <h3 className="font-sans text-base font-semibold text-bone">
                        {cap.title}
                      </h3>
                      <p className="mt-1 text-sm leading-relaxed text-ash">
                        {cap.description}
                      </p>
                    </div>
                  </motion.div>
                );
              })}
            </div>

            {/* Divider */}
            <div className="my-10 h-px bg-evidence-gold/15" />

            {/* Pull quote */}
            <motion.blockquote
              className="relative pl-6"
              variants={fadeUp}
              initial="hidden"
              animate={isInView ? "visible" : "hidden"}
              custom={0.6}
            >
              {/* Decorative quotation mark */}
              <span
                className="absolute -left-1 -top-4 font-display text-5xl leading-none text-evidence-gold/20 select-none"
                aria-hidden="true"
              >
                &ldquo;
              </span>
              <p className="font-display text-xl italic text-evidence-gold">
                {t('quote')}
              </p>
              <span
                className="ml-1 font-display text-5xl leading-none text-evidence-gold/20 select-none"
                aria-hidden="true"
              >
                &rdquo;
              </span>
            </motion.blockquote>
          </div>
        </div>
      </div>
    </section>
  );
}
