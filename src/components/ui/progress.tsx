"use client";

/**
 * PROBATIO — Progress Component
 *
 * Animated progress bar with graphite track and forensic-blue fill.
 * Supports size variants, labels, and custom colors.
 */

import * as React from "react";
import { motion } from "framer-motion";
import { cn } from "@/lib/utils";

// ────────────────────────────────────────────────────────────────────────────
// Types
// ────────────────────────────────────────────────────────────────────────────

export type ProgressSize = "sm" | "md" | "lg";

const sizeStyles: Record<ProgressSize, string> = {
  sm: "h-1",
  md: "h-2",
  lg: "h-3",
};

export type ProgressColor = "blue" | "red" | "gold" | "green";

const colorStyles: Record<ProgressColor, string> = {
  blue: "bg-forensic-blue",
  red: "bg-signal-red",
  gold: "bg-evidence-gold",
  green: "bg-risk-low",
};

export interface ProgressProps extends React.HTMLAttributes<HTMLDivElement> {
  /** Current progress value (0 - 100). */
  value: number;
  /** Maximum value (default 100). */
  max?: number;
  /** Size of the progress bar track. */
  size?: ProgressSize;
  /** Color of the fill bar. */
  color?: ProgressColor;
  /** Label displayed above the progress bar. */
  label?: string;
  /** Show percentage text next to the label. */
  showPercentage?: boolean;
}

// ────────────────────────────────────────────────────────────────────────────
// Component
// ────────────────────────────────────────────────────────────────────────────

const Progress = React.forwardRef<HTMLDivElement, ProgressProps>(
  (
    {
      className,
      value,
      max = 100,
      size = "md",
      color = "blue",
      label,
      showPercentage = false,
      ...props
    },
    ref,
  ) => {
    const clamped = Math.min(Math.max(value, 0), max);
    const percentage = Math.round((clamped / max) * 100);

    return (
      <div ref={ref} className={cn("w-full", className)} {...props}>
        {(label || showPercentage) && (
          <div className="flex items-center justify-between mb-1.5">
            {label && (
              <span className="text-xs font-sans font-medium text-bone/80">
                {label}
              </span>
            )}
            {showPercentage && (
              <span className="text-xs font-mono text-ash">
                {percentage}%
              </span>
            )}
          </div>
        )}

        <div
          role="progressbar"
          aria-valuenow={clamped}
          aria-valuemin={0}
          aria-valuemax={max}
          aria-label={label ?? "Progress"}
          className={cn(
            "w-full rounded-full bg-graphite overflow-hidden",
            sizeStyles[size],
          )}
        >
          <motion.div
            initial={{ width: 0 }}
            animate={{ width: `${percentage}%` }}
            transition={{ type: "spring", stiffness: 100, damping: 20 }}
            className={cn(
              "h-full rounded-full",
              colorStyles[color],
            )}
          />
        </div>
      </div>
    );
  },
);

Progress.displayName = "Progress";

export { Progress };
