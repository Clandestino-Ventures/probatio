"use client";

/**
 * PROBATIO — Pipeline Progress Component
 *
 * Displays the analysis pipeline as an ordered list of stages with
 * live status icons (pending / active / completed / failed) and a
 * horizontal progress bar driven by `progressPct`.
 */

import { useMemo } from "react";
import { cn } from "@/lib/utils";
import { Progress } from "@/components/ui";
import { Loader2, Check, X, Circle } from "lucide-react";

// ────────────────────────────────────────────────────────────────────────────
// Types
// ────────────────────────────────────────────────────────────────────────────

interface PipelineProgressProps {
  /** Current analysis status string from the database. */
  status: string;
  /** Overall progress percentage (0-100). */
  progressPct: number;
  /** Human-readable name of the current step, if available. */
  currentStep: string | null;
  /** Additional CSS classes. */
  className?: string;
}

type StageStatus = "pending" | "active" | "completed" | "failed";

interface PipelineStage {
  /** Display name. */
  name: string;
  /** Unique key used for status mapping. */
  key: string;
}

// ────────────────────────────────────────────────────────────────────────────
// Pipeline Stages
// ────────────────────────────────────────────────────────────────────────────

const STAGES: PipelineStage[] = [
  { name: "Queued", key: "queued" },
  { name: "Fingerprinting", key: "fingerprinting" },
  { name: "Separating stems", key: "separating" },
  { name: "Extracting features", key: "extracting" },
  { name: "Generating embeddings", key: "embeddings" },
  { name: "Searching matches", key: "matching" },
  { name: "Enriching rights", key: "enriching" },
  { name: "Generating report", key: "reporting" },
];

/**
 * Map a database `AnalysisStatus` string to the index of the currently
 * active stage. Returns -1 for "pending" (nothing started) and
 * STAGES.length for terminal states.
 */
function getActiveStageIndex(status: string): number {
  switch (status) {
    case "pending":
      return -1;
    case "uploading":
    case "normalizing":
      return 0; // Queued
    case "separating":
      return 2; // Separating stems (stages 0-1 complete)
    case "extracting":
      return 3; // Extracting features
    case "matching":
      return 5; // Searching matches
    case "classifying":
      return 7; // Generating report
    case "completed":
      return STAGES.length; // All complete
    case "failed":
      return -2; // Special: failed
    default:
      return -1;
  }
}

function deriveStageStatuses(status: string): StageStatus[] {
  if (status === "completed") {
    return STAGES.map(() => "completed");
  }

  if (status === "failed") {
    const activeIndex = getActiveStageIndex(status);
    // Find the last known active stage from progressPct or mark last non-pending as failed
    return STAGES.map(() => "failed");
  }

  const activeIndex = getActiveStageIndex(status);

  return STAGES.map((_, i) => {
    if (i < activeIndex) return "completed";
    if (i === activeIndex) return "active";
    return "pending";
  });
}

// ────────────────────────────────────────────────────────────────────────────
// Stage Icon
// ────────────────────────────────────────────────────────────────────────────

function StageIcon({ stageStatus }: { stageStatus: StageStatus }) {
  switch (stageStatus) {
    case "completed":
      return (
        <Check
          size={14}
          className="text-risk-low shrink-0"
          aria-label="Completed"
        />
      );
    case "active":
      return (
        <Loader2
          size={14}
          className="text-forensic-blue animate-spin shrink-0"
          aria-label="In progress"
        />
      );
    case "failed":
      return (
        <X
          size={14}
          className="text-signal-red shrink-0"
          aria-label="Failed"
        />
      );
    case "pending":
    default:
      return (
        <Circle
          size={14}
          className="text-ash/50 shrink-0"
          aria-label="Pending"
        />
      );
  }
}

// ────────────────────────────────────────────────────────────────────────────
// Component
// ────────────────────────────────────────────────────────────────────────────

export function PipelineProgress({
  status,
  progressPct,
  currentStep,
  className,
}: PipelineProgressProps) {
  const stageStatuses = useMemo(() => {
    if (status === "failed") {
      // For failed: mark stages up to the failure point as completed,
      // the failure point as failed, and the rest as pending.
      const activeIndex = getActiveStageIndex(
        // We don't know exactly which stage failed, so use progressPct
        // to estimate how far along we were.
        status,
      );

      // Use progressPct to estimate which stage failed
      const estimatedStage = Math.min(
        Math.floor((progressPct / 100) * STAGES.length),
        STAGES.length - 1,
      );

      return STAGES.map((_, i) => {
        if (i < estimatedStage) return "completed" as StageStatus;
        if (i === estimatedStage) return "failed" as StageStatus;
        return "pending" as StageStatus;
      });
    }

    return deriveStageStatuses(status);
  }, [status, progressPct]);

  const isTerminal = status === "completed" || status === "failed";
  const progressColor = status === "failed" ? "red" : status === "completed" ? "green" : "blue";

  return (
    <div className={cn("w-full space-y-4", className)}>
      {/* Progress bar */}
      <Progress
        value={progressPct}
        size="sm"
        color={progressColor}
        showPercentage
        label={
          status === "completed"
            ? "Analysis complete"
            : status === "failed"
              ? "Analysis failed"
              : currentStep ?? "Processing..."
        }
      />

      {/* Stage list */}
      <div className="space-y-1.5">
        {STAGES.map((stage, i) => {
          const stageStatus = stageStatuses[i];
          return (
            <div
              key={stage.key}
              className={cn(
                "flex items-center gap-2.5 py-1 px-2 rounded-sm transition-colors duration-micro",
                stageStatus === "active" && "bg-forensic-blue/5",
                stageStatus === "failed" && "bg-signal-red/5",
              )}
            >
              <StageIcon stageStatus={stageStatus} />
              <span
                className={cn(
                  "text-xs font-sans",
                  stageStatus === "completed" && "text-bone/70",
                  stageStatus === "active" && "text-forensic-blue font-medium",
                  stageStatus === "failed" && "text-signal-red font-medium",
                  stageStatus === "pending" && "text-ash/50",
                )}
              >
                {stage.name}
              </span>
            </div>
          );
        })}
      </div>

      {/* Terminal status message */}
      {isTerminal && (
        <div
          className={cn(
            "flex items-center gap-2 px-3 py-2 rounded-md text-xs font-sans font-medium",
            status === "completed" && "bg-risk-low/10 text-risk-low border border-risk-low/20",
            status === "failed" && "bg-signal-red/10 text-signal-red border border-signal-red/20",
          )}
        >
          {status === "completed" ? (
            <>
              <Check size={14} />
              <span>Analysis completed successfully</span>
            </>
          ) : (
            <>
              <X size={14} />
              <span>Analysis failed</span>
            </>
          )}
        </div>
      )}
    </div>
  );
}
