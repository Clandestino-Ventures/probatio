"use client";

import { cn } from "@/lib/utils";

// ────────────────────────────────────────────────────────────────────────────
// Types
// ────────────────────────────────────────────────────────────────────────────

type RiskLevel = "low" | "medium" | "high" | "critical";

interface RiskIndicatorProps {
  level: RiskLevel;
  showLabel?: boolean;
  size?: "sm" | "md";
  className?: string;
}

// ────────────────────────────────────────────────────────────────────────────
// Level → style mapping
// ────────────────────────────────────────────────────────────────────────────

const dotColorClasses: Record<RiskLevel, string> = {
  low: "bg-risk-low",
  medium: "bg-risk-moderate",
  high: "bg-risk-high",
  critical: "bg-risk-critical animate-pulse-risk",
};

const labelColorClasses: Record<RiskLevel, string> = {
  low: "text-risk-low",
  medium: "text-risk-moderate",
  high: "text-risk-high",
  critical: "text-risk-critical",
};

const labels: Record<RiskLevel, string> = {
  low: "Low",
  medium: "Medium",
  high: "High",
  critical: "Critical",
};

const dotSizes: Record<NonNullable<RiskIndicatorProps["size"]>, string> = {
  sm: "h-1.5 w-1.5",
  md: "h-2 w-2",
};

const textSizes: Record<NonNullable<RiskIndicatorProps["size"]>, string> = {
  sm: "text-xs",
  md: "text-sm",
};

// ────────────────────────────────────────────────────────────────────────────
// Component
// ────────────────────────────────────────────────────────────────────────────

export function RiskIndicator({
  level,
  showLabel = true,
  size = "md",
  className,
}: RiskIndicatorProps) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5",
        className,
      )}
      role="status"
      aria-label={`Risk level: ${labels[level]}`}
    >
      <span
        className={cn(
          "shrink-0 rounded-full",
          dotSizes[size],
          dotColorClasses[level],
        )}
        aria-hidden="true"
      />
      {showLabel && (
        <span
          className={cn(
            "font-sans font-medium leading-none",
            textSizes[size],
            labelColorClasses[level],
          )}
        >
          {labels[level]}
        </span>
      )}
    </span>
  );
}
