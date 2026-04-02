"use client";

import { cn } from "@/lib/utils";
import { useTranslations } from "next-intl";
import { PIPELINE_STEPS, type PipelineStepName } from "@/lib/constants";
import { Check, Loader2, Circle } from "lucide-react";

interface PipelineTrackerProps {
  currentStep: PipelineStepName | null;
  completedSteps: PipelineStepName[];
  failed?: boolean;
  failedStep?: PipelineStepName;
  className?: string;
}

export function PipelineTracker({
  currentStep,
  completedSteps,
  failed = false,
  failedStep,
  className,
}: PipelineTrackerProps) {
  const t = useTranslations('pipeline.steps');
  return (
    <div className={cn("space-y-2", className)}>
      {PIPELINE_STEPS.map((step, idx) => {
        const isCompleted = completedSteps.includes(step);
        const isCurrent = currentStep === step;
        const isFailed = failed && failedStep === step;
        const isPending = !isCompleted && !isCurrent && !isFailed;

        return (
          <div key={step} className="flex items-center gap-3">
            {/* Step indicator */}
            <div
              className={cn(
                "w-6 h-6 rounded-full flex items-center justify-center shrink-0 text-xs",
                isCompleted && "bg-risk-low/20 text-risk-low",
                isCurrent && "bg-forensic-blue/20 text-forensic-blue",
                isFailed && "bg-signal-red/20 text-signal-red",
                isPending && "bg-graphite text-ash"
              )}
            >
              {isCompleted && <Check size={12} />}
              {isCurrent && <Loader2 size={12} className="animate-spin" />}
              {isFailed && <span className="text-xs font-bold">!</span>}
              {isPending && <Circle size={8} />}
            </div>

            {/* Step label */}
            <span
              className={cn(
                "text-sm",
                isCompleted && "text-bone",
                isCurrent && "text-forensic-blue font-medium",
                isFailed && "text-signal-red",
                isPending && "text-ash"
              )}
            >
              {t(`${step}.name`)}
            </span>

            {/* Connecting line (hidden for last) */}
            {idx < PIPELINE_STEPS.length - 1 && (
              <div className="flex-1 h-px bg-slate/50 mx-2" />
            )}
          </div>
        );
      })}
    </div>
  );
}
