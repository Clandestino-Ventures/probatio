"use client";

/**
 * PROBATIO — For Who Section
 *
 * Single-column list of audience segments with staggered fade-up animation.
 * Minimal and authoritative — like a menu at a fine restaurant.
 */

import { useRef } from "react";
import { motion, useInView } from "framer-motion";
import { useTranslations } from "next-intl";
import { cn } from "@/lib/utils";

// ────────────────────────────────────────────────────────────────────────────
// Data
// ────────────────────────────────────────────────────────────────────────────

const audienceKeys = ["artists", "labels", "legal", "distributors"] as const;

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
// Export
// ────────────────────────────────────────────────────────────────────────────

export function ForWho() {
  const ref = useRef<HTMLDivElement>(null);
  const isInView = useInView(ref, { once: true, margin: "-80px 0px" });
  const t = useTranslations('landing.forWho');

  return (
    <section className="bg-obsidian py-24" ref={ref}>
      <div className="mx-auto max-w-160 px-6">
        {/* Header */}
        <motion.h2
          className="mb-14 text-center font-display text-3xl text-bone"
          variants={fadeUp}
          initial="hidden"
          animate={isInView ? "visible" : "hidden"}
          custom={0}
        >
          {t('title')}
        </motion.h2>

        {/* Audience rows */}
        <div className="flex flex-col">
          {audienceKeys.map((key, i) => (
            <motion.div
              key={key}
              className={cn(
                "border-b border-slate/40 py-6",
                i === 0 && "border-t border-t-slate/40",
              )}
              variants={fadeUp}
              initial="hidden"
              animate={isInView ? "visible" : "hidden"}
              custom={0.1 + i * 0.1}
            >
              <h3 className="font-display text-xl text-bone">
                {t(`personas.${key}.title`)}
              </h3>
              <p className="mt-2 flex items-start gap-2 text-base text-ash">
                <span
                  className="mt-2.25 inline-block h-px w-4 shrink-0 bg-ash/50"
                  aria-hidden="true"
                />
                {t(`personas.${key}.description`)}
              </p>
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  );
}
