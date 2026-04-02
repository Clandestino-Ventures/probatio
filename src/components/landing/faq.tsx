"use client";

/**
 * PROBATIO — FAQ Section
 *
 * Accordion FAQ with 8 questions. Custom inline accordion built with
 * useState — no external UI library dependency.
 */

import { useState, useRef } from "react";
import { motion, useInView } from "framer-motion";
import { ChevronDown } from "lucide-react";
import { useTranslations } from "next-intl";
import { cn } from "@/lib/utils";

// ────────────────────────────────────────────────────────────────────────────
// Data
// ────────────────────────────────────────────────────────────────────────────

const faqKeys = [
  "whatIs",
  "howAccurate",
  "courtAdmissible",
  "fileFormats",
  "howLong",
  "privacy",
  "api",
  "refund",
] as const;

// ────────────────────────────────────────────────────────────────────────────
// Accordion Item
// ────────────────────────────────────────────────────────────────────────────

function AccordionItem({
  question,
  answer,
  isOpen,
  onToggle,
}: {
  question: string;
  answer: string;
  isOpen: boolean;
  onToggle: () => void;
}) {
  const contentRef = useRef<HTMLDivElement>(null);

  return (
    <div className="border-b border-slate/40">
      <button
        type="button"
        onClick={onToggle}
        className={cn(
          "flex w-full items-center justify-between gap-4 py-5 text-left",
          "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-forensic-blue focus-visible:ring-offset-2 focus-visible:ring-offset-obsidian",
        )}
        aria-expanded={isOpen}
      >
        <span className="font-sans text-base font-medium text-bone">
          {question}
        </span>
        <ChevronDown
          className={cn(
            "h-4 w-4 shrink-0 text-ash transition-transform duration-300",
            isOpen && "rotate-180",
          )}
        />
      </button>

      {/* Collapsible answer */}
      <div
        ref={contentRef}
        className="overflow-hidden transition-all duration-300 ease-[cubic-bezier(0.16,1,0.3,1)]"
        style={{
          maxHeight: isOpen
            ? `${contentRef.current?.scrollHeight ?? 200}px`
            : "0px",
        }}
      >
        <p className="pb-5 text-sm leading-relaxed text-ash">{answer}</p>
      </div>
    </div>
  );
}

// ────────────────────────────────────────────────────────────────────────────
// Animation
// ────────────────────────────────────────────────────────────────────────────

const fadeUp = {
  hidden: { opacity: 0, y: 20 },
  visible: {
    opacity: 1,
    y: 0,
    transition: {
      duration: 0.6,
      ease: [0.16, 1, 0.3, 1] as [number, number, number, number],
    },
  },
};

// ────────────────────────────────────────────────────────────────────────────
// Export
// ────────────────────────────────────────────────────────────────────────────

export function FAQ() {
  const [openIndex, setOpenIndex] = useState<number | null>(null);
  const ref = useRef<HTMLDivElement>(null);
  const isInView = useInView(ref, { once: true, margin: "-80px 0px" });
  const t = useTranslations('landing.faq');

  return (
    <section className="bg-obsidian py-24" ref={ref}>
      <div className="mx-auto max-w-160 px-6">
        {/* Header */}
        <motion.h2
          className="mb-12 text-center font-display text-3xl text-bone"
          variants={fadeUp}
          initial="hidden"
          animate={isInView ? "visible" : "hidden"}
        >
          {t('title')}
        </motion.h2>

        {/* Accordion */}
        <motion.div
          variants={fadeUp}
          initial="hidden"
          animate={isInView ? "visible" : "hidden"}
        >
          {faqKeys.map((key, i) => (
            <AccordionItem
              key={key}
              question={t(`items.${key}.question`)}
              answer={t(`items.${key}.answer`)}
              isOpen={openIndex === i}
              onToggle={() =>
                setOpenIndex((prev) => (prev === i ? null : i))
              }
            />
          ))}
        </motion.div>
      </div>
    </section>
  );
}
