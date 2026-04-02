"use client";

/**
 * PROBATIO — Two Modes Section
 *
 * Split-card layout contrasting Screening vs Forensic analysis modes.
 * Interactive hover effect: hovering one card subtly dims the other.
 */

import { useState } from "react";
import { motion } from "framer-motion";
import { Shield, Scale } from "lucide-react";
import { useTranslations } from "next-intl";
import { cn } from "@/lib/utils";

// ────────────────────────────────────────────────────────────────────────────
// Data
// ────────────────────────────────────────────────────────────────────────────

const modes = [
  {
    id: "screening" as const,
    icon: Shield,
    accent: "forensic-blue",
    accentHex: "#2E6CE6",
  },
  {
    id: "forensic" as const,
    icon: Scale,
    accent: "evidence-gold",
    accentHex: "#C4992E",
  },
];

// ────────────────────────────────────────────────────────────────────────────
// Animation
// ────────────────────────────────────────────────────────────────────────────

const sectionFade = {
  hidden: { opacity: 0, y: 32 },
  visible: {
    opacity: 1,
    y: 0,
    transition: {
      duration: 0.7,
      ease: [0.16, 1, 0.3, 1] as [number, number, number, number],
      staggerChildren: 0.15,
    },
  },
};

const cardFade = {
  hidden: { opacity: 0, y: 24 },
  visible: {
    opacity: 1,
    y: 0,
    transition: { duration: 0.6, ease: [0.16, 1, 0.3, 1] as [number, number, number, number] },
  },
};

// ────────────────────────────────────────────────────────────────────────────
// Component
// ────────────────────────────────────────────────────────────────────────────

export function TwoModes() {
  const [hoveredId, setHoveredId] = useState<string | null>(null);
  const t = useTranslations('landing.modes');

  return (
    <section className="bg-obsidian px-6 py-24">
      <motion.div
        className="mx-auto max-w-prose"
        variants={sectionFade}
        initial="hidden"
        whileInView="visible"
        viewport={{ once: true, margin: "-80px" }}
      >
        {/* Title */}
        <motion.h2
          className="mb-14 text-center font-display text-3xl text-bone md:text-4xl"
          variants={cardFade}
        >
          {t('title')}
        </motion.h2>

        {/* Cards */}
        <div className="grid gap-6 md:grid-cols-2">
          {modes.map((mode) => {
            const Icon = mode.icon;
            const isDimmed = hoveredId !== null && hoveredId !== mode.id;

            return (
              <motion.div
                key={mode.id}
                variants={cardFade}
                onMouseEnter={() => setHoveredId(mode.id)}
                onMouseLeave={() => setHoveredId(null)}
                className={cn(
                  "group relative rounded-lg border border-slate bg-carbon p-8",
                  "transition-opacity duration-300 ease-out",
                  isDimmed && "opacity-50",
                )}
              >
                {/* Accent top line */}
                <div
                  className="absolute inset-x-0 top-0 h-px rounded-t-lg"
                  style={{ backgroundColor: mode.accentHex }}
                />

                {/* Icon */}
                <div className="mb-5">
                  <Icon
                    className="h-7 w-7"
                    style={{ color: mode.accentHex }}
                    strokeWidth={1.5}
                  />
                </div>

                {/* Title */}
                <h3 className="mb-3 font-display text-2xl text-bone">
                  {t(`${mode.id}.title`)}
                </h3>

                {/* Description */}
                <p className="mb-6 font-sans text-sm leading-relaxed text-ash">
                  {t(`${mode.id}.description`)}
                </p>

                {/* Meta */}
                <div className="space-y-2 border-t border-slate pt-5">
                  <div className="flex items-start gap-2">
                    <span className="font-mono text-xs uppercase tracking-wider text-ash/60">
                      {t(`${mode.id}.label`)}
                    </span>
                  </div>
                </div>
              </motion.div>
            );
          })}
        </div>
      </motion.div>
    </section>
  );
}
