/**
 * PROBATIO — Skeleton Component
 *
 * Loading placeholders with pulse animation.
 * Variants for text lines, cards, avatars, and charts.
 */

import * as React from "react";
import { cn } from "@/lib/utils";

// ────────────────────────────────────────────────────────────────────────────
// Base Skeleton
// ────────────────────────────────────────────────────────────────────────────

export interface SkeletonProps extends React.HTMLAttributes<HTMLDivElement> {}

const Skeleton = React.forwardRef<HTMLDivElement, SkeletonProps>(
  ({ className, ...props }, ref) => {
    return (
      <div
        ref={ref}
        aria-hidden="true"
        className={cn(
          "animate-pulse rounded-md bg-slate/30",
          className,
        )}
        {...props}
      />
    );
  },
);

Skeleton.displayName = "Skeleton";

// ────────────────────────────────────────────────────────────────────────────
// Text Skeleton
// ────────────────────────────────────────────────────────────────────────────

export interface SkeletonTextProps extends React.HTMLAttributes<HTMLDivElement> {
  /** Number of text lines to render. */
  lines?: number;
}

const SkeletonText = React.forwardRef<HTMLDivElement, SkeletonTextProps>(
  ({ className, lines = 3, ...props }, ref) => {
    return (
      <div ref={ref} className={cn("flex flex-col gap-2", className)} {...props}>
        {Array.from({ length: lines }).map((_, i) => (
          <Skeleton
            key={i}
            className={cn(
              "h-3.5",
              // Last line is shorter for realistic text shape
              i === lines - 1 && lines > 1 ? "w-2/3" : "w-full",
            )}
          />
        ))}
      </div>
    );
  },
);

SkeletonText.displayName = "SkeletonText";

// ────────────────────────────────────────────────────────────────────────────
// Card Skeleton
// ────────────────────────────────────────────────────────────────────────────

export interface SkeletonCardProps extends React.HTMLAttributes<HTMLDivElement> {}

const SkeletonCard = React.forwardRef<HTMLDivElement, SkeletonCardProps>(
  ({ className, ...props }, ref) => {
    return (
      <div
        ref={ref}
        className={cn(
          "rounded-md border border-slate/30 bg-carbon p-6 space-y-4",
          className,
        )}
        aria-hidden="true"
        {...props}
      >
        {/* Header */}
        <div className="flex items-center gap-3">
          <Skeleton className="h-10 w-10 rounded-full" />
          <div className="flex-1 space-y-2">
            <Skeleton className="h-4 w-1/3" />
            <Skeleton className="h-3 w-1/2" />
          </div>
        </div>
        {/* Body */}
        <SkeletonText lines={3} />
        {/* Footer */}
        <div className="flex gap-2 pt-2">
          <Skeleton className="h-8 w-20 rounded-sm" />
          <Skeleton className="h-8 w-20 rounded-sm" />
        </div>
      </div>
    );
  },
);

SkeletonCard.displayName = "SkeletonCard";

// ────────────────────────────────────────────────────────────────────────────
// Avatar Skeleton
// ────────────────────────────────────────────────────────────────────────────

export interface SkeletonAvatarProps extends React.HTMLAttributes<HTMLDivElement> {
  /** Diameter of the avatar skeleton. */
  size?: "sm" | "md" | "lg";
}

const avatarSizes = {
  sm: "h-8 w-8",
  md: "h-10 w-10",
  lg: "h-14 w-14",
} as const;

const SkeletonAvatar = React.forwardRef<HTMLDivElement, SkeletonAvatarProps>(
  ({ className, size = "md", ...props }, ref) => {
    return (
      <Skeleton
        ref={ref}
        className={cn("rounded-full", avatarSizes[size], className)}
        {...props}
      />
    );
  },
);

SkeletonAvatar.displayName = "SkeletonAvatar";

// ────────────────────────────────────────────────────────────────────────────
// Chart Skeleton
// ────────────────────────────────────────────────────────────────────────────

export interface SkeletonChartProps extends React.HTMLAttributes<HTMLDivElement> {}

const SkeletonChart = React.forwardRef<HTMLDivElement, SkeletonChartProps>(
  ({ className, ...props }, ref) => {
    return (
      <div
        ref={ref}
        className={cn(
          "rounded-md border border-slate/30 bg-carbon p-6",
          className,
        )}
        aria-hidden="true"
        {...props}
      >
        {/* Title */}
        <Skeleton className="h-4 w-32 mb-6" />
        {/* Chart bars */}
        <div className="flex items-end gap-2 h-40">
          {[60, 85, 45, 70, 90, 55, 75, 40, 80, 65].map((height, i) => (
            <Skeleton
              key={i}
              className="flex-1 rounded-t-sm"
              style={{ height: `${height}%` }}
            />
          ))}
        </div>
        {/* X-axis labels */}
        <div className="flex gap-2 mt-3">
          {Array.from({ length: 10 }).map((_, i) => (
            <Skeleton key={i} className="flex-1 h-2.5" />
          ))}
        </div>
      </div>
    );
  },
);

SkeletonChart.displayName = "SkeletonChart";

export { Skeleton, SkeletonText, SkeletonCard, SkeletonAvatar, SkeletonChart };
