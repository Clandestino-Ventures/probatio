"use client";

/**
 * PROBATIO — Pipeline Visual Section
 *
 * Vertical timeline showing the eight-stage analysis pipeline.
 * Each step fades up on scroll via framer-motion useInView.
 */

import { useRef } from "react";
import { motion, useInView } from "framer-motion";
import {
  Upload,
  AudioWaveform,
  Fingerprint,
  Layers,
  ScanLine,
  Binary,
  Search,
  FileText,
} from "lucide-react";
import { useTranslations } from "next-intl";
import { cn } from "@/lib/utils";

// ────────────────────────────────────────────────────────────────────────────
// Pipeline Step Data
// ────────────────────────────────────────────────────────────────────────────

interface PipelineStep {
  number: string;
  name: string;
  description: string;
  icon: React.ElementType;
  viz: React.ReactNode;
}

/** Small colored bar mock visualization */
function BarViz({ widths, color }: { widths: number[]; color: string }) {
  return (
    <div className="mt-2 flex flex-col gap-1">
      {widths.map((w, i) => (
        <div
          key={i}
          className="h-1 rounded-full"
          style={{ width: `${w}%`, backgroundColor: color, opacity: 0.7 }}
        />
      ))}
    </div>
  );
}

/** Small dot cluster visualization */
function DotViz({ count, color }: { count: number; color: string }) {
  return (
    <div className="mt-2 flex flex-wrap gap-1">
      {Array.from({ length: count }).map((_, i) => (
        <div
          key={i}
          className="h-1.5 w-1.5 rounded-full"
          style={{ backgroundColor: color, opacity: 0.5 + (Math.sin(i * 2.39996) * 0.5 + 0.5) * 0.5 }}
        />
      ))}
    </div>
  );
}

/** Hash display visualization */
function HashViz() {
  return (
    <div className="mt-2 font-mono text-[10px] text-forensic-blue/60 leading-tight">
      sha256:a3f8c1d4...
    </div>
  );
}

/** Score visualization */
function ScoreViz({ scores }: { scores: { label: string; value: number }[] }) {
  return (
    <div className="mt-2 flex gap-3">
      {scores.map((s) => (
        <div key={s.label} className="flex flex-col items-center">
          <span className="font-mono text-[10px] text-forensic-blue">
            {s.value}%
          </span>
          <span className="text-[9px] text-ash">{s.label}</span>
        </div>
      ))}
    </div>
  );
}

const steps: PipelineStep[] = [
  {
    number: "01",
    name: "Upload & Hash",
    description:
      "Audio ingested and SHA-256 hashed. Chain of custody begins here.",
    icon: Upload,
    viz: <HashViz />,
  },
  {
    number: "02",
    name: "Normalize",
    description:
      "Sample rate, bit depth, and loudness standardized for consistent analysis.",
    icon: AudioWaveform,
    viz: <BarViz widths={[90, 70, 85]} color="#2E6CE6" />,
  },
  {
    number: "03",
    name: "Fingerprint",
    description:
      "Acoustic fingerprint generated for rapid reference database lookup.",
    icon: Fingerprint,
    viz: <DotViz count={18} color="#2E6CE6" />,
  },
  {
    number: "04",
    name: "Separate Stems",
    description:
      "Vocals, drums, bass, and other instruments isolated via source separation.",
    icon: Layers,
    viz: (
      <BarViz
        widths={[75, 60, 50, 85]}
        color="#2E6CE6"
      />
    ),
  },
  {
    number: "05",
    name: "Extract Features",
    description:
      "Melody, harmony, rhythm, and timbral features quantified across every stem.",
    icon: ScanLine,
    viz: (
      <ScoreViz
        scores={[
          { label: "mel", value: 94 },
          { label: "har", value: 87 },
          { label: "rhy", value: 72 },
        ]}
      />
    ),
  },
  {
    number: "06",
    name: "Generate Embeddings",
    description:
      "High-dimensional vector representations created for similarity search.",
    icon: Binary,
    viz: <DotViz count={24} color="#2E6CE6" />,
  },
  {
    number: "07",
    name: "Search & Match",
    description:
      "Reference library queried. Candidate matches ranked by composite similarity.",
    icon: Search,
    viz: (
      <ScoreViz
        scores={[
          { label: "top", value: 91 },
          { label: "#2", value: 68 },
          { label: "#3", value: 42 },
        ]}
      />
    ),
  },
  {
    number: "08",
    name: "Generate Report",
    description:
      "Forensic-grade report assembled with evidence chain, scores, and methodology.",
    icon: FileText,
    viz: (
      <div className="mt-2 font-mono text-[10px] text-forensic-blue/60 leading-tight">
        report_v2.4.pdf — sealed
      </div>
    ),
  },
];

// ────────────────────────────────────────────────────────────────────────────
// Animated Step
// ────────────────────────────────────────────────────────────────────────────

function PipelineStepRow({
  step,
  index,
  isLast,
}: {
  step: PipelineStep;
  index: number;
  isLast: boolean;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const isInView = useInView(ref, { once: true, margin: "-60px 0px" });
  const Icon = step.icon;

  return (
    <motion.div
      ref={ref}
      className="relative flex gap-6"
      initial={{ opacity: 0, y: 24 }}
      animate={isInView ? { opacity: 1, y: 0 } : { opacity: 0, y: 24 }}
      transition={{
        duration: 0.6,
        delay: index * 0.08,
        ease: [0.16, 1, 0.3, 1] as [number, number, number, number],
      }}
    >
      {/* Timeline column */}
      <div className="relative flex flex-col items-center">
        {/* Dot */}
        <div className="relative z-10 flex h-8 w-8 items-center justify-center rounded-full border border-forensic-blue/40 bg-carbon">
          <Icon className="h-3.5 w-3.5 text-forensic-blue" />
        </div>
        {/* Line */}
        {!isLast && (
          <div className="w-px flex-1 bg-slate/50" />
        )}
      </div>

      {/* Content column */}
      <div className={cn("pb-10", isLast && "pb-0")}>
        <span className="font-mono text-xs text-forensic-blue">
          {step.number}
        </span>
        <h3 className="mt-1 font-sans text-base font-medium text-bone">
          {step.name}
        </h3>
        <p className="mt-1 text-sm leading-relaxed text-ash">
          {step.description}
        </p>
        {step.viz}
      </div>
    </motion.div>
  );
}

// ────────────────────────────────────────────────────────────────────────────
// Export
// ────────────────────────────────────────────────────────────────────────────

export function PipelineVisual() {
  const t = useTranslations('landing.howItWorks');

  return (
    <section className="bg-obsidian py-24">
      <div className="mx-auto max-w-160 px-6">
        {/* Header */}
        <div className="mb-16 text-center">
          <h2 className="font-display text-3xl text-bone">
            {t('title')}
          </h2>
          <p className="mt-3 font-sans text-base text-ash">
            {t('subtitle')}
          </p>
        </div>

        {/* Timeline */}
        <div className="flex flex-col">
          {steps.map((step, i) => (
            <PipelineStepRow
              key={step.number}
              step={step}
              index={i}
              isLast={i === steps.length - 1}
            />
          ))}
        </div>
      </div>
    </section>
  );
}
