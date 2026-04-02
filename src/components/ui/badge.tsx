/**
 * PROBATIO — Badge Component
 *
 * Small, pill-shaped badges with brand risk-level and info variants.
 */

import * as React from "react";
import { cn } from "@/lib/utils";

// ────────────────────────────────────────────────────────────────────────────
// Variants
// ────────────────────────────────────────────────────────────────────────────

const variantStyles = {
  default:
    "bg-slate/40 text-bone border-slate",
  "risk-low":
    "bg-risk-low/15 text-risk-low border-risk-low/30",
  "risk-medium":
    "bg-risk-moderate/15 text-risk-moderate border-risk-moderate/30",
  "risk-high":
    "bg-risk-high/15 text-risk-high border-risk-high/30",
  "risk-critical":
    "bg-risk-critical/15 text-risk-critical border-risk-critical/30 animate-pulse-risk",
  info:
    "bg-forensic-blue/15 text-forensic-blue border-forensic-blue/30",
  verified:
    "bg-evidence-gold/15 text-evidence-gold border-evidence-gold/30",
} as const;

// ────────────────────────────────────────────────────────────────────────────
// Types
// ────────────────────────────────────────────────────────────────────────────

export type BadgeVariant = keyof typeof variantStyles;

export interface BadgeProps extends React.HTMLAttributes<HTMLSpanElement> {
  /** Visual style variant. */
  variant?: BadgeVariant;
  /** Optional icon rendered before the label. */
  icon?: React.ReactNode;
}

// ────────────────────────────────────────────────────────────────────────────
// Component
// ────────────────────────────────────────────────────────────────────────────

const Badge = React.forwardRef<HTMLSpanElement, BadgeProps>(
  ({ className, variant = "default", icon, children, ...props }, ref) => {
    return (
      <span
        ref={ref}
        className={cn(
          // Base
          "inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full",
          "text-xs font-sans font-medium leading-none whitespace-nowrap",
          "border",
          // Variant
          variantStyles[variant],
          className,
        )}
        {...props}
      >
        {icon && (
          <span className="shrink-0" aria-hidden="true">
            {icon}
          </span>
        )}
        {children}
      </span>
    );
  },
);

Badge.displayName = "Badge";

export { Badge };
