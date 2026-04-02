"use client";

/**
 * PROBATIO — Button Component
 *
 * Dark-first button with brand variants, sizes, loading states,
 * and Framer Motion hover/tap animations.
 */

import * as React from "react";
import { motion, type HTMLMotionProps } from "framer-motion";
import { Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";

// ────────────────────────────────────────────────────────────────────────────
// Variants & Sizes
// ────────────────────────────────────────────────────────────────────────────

const variantStyles = {
  primary:
    "bg-forensic-blue text-bone hover:bg-forensic-blue/90 focus-visible:ring-forensic-blue shadow-glow-blue/0 hover:shadow-glow-blue",
  destructive:
    "bg-signal-red text-bone hover:bg-signal-red/90 focus-visible:ring-signal-red shadow-glow-red/0 hover:shadow-glow-red",
  outline:
    "border border-slate bg-transparent text-bone hover:bg-slate/20 focus-visible:ring-forensic-blue",
  ghost:
    "bg-transparent text-bone hover:bg-slate/20 focus-visible:ring-forensic-blue",
  gold:
    "bg-evidence-gold text-obsidian hover:bg-evidence-gold/90 focus-visible:ring-evidence-gold shadow-glow-gold/0 hover:shadow-glow-gold",
} as const;

const sizeStyles = {
  sm: "h-8 px-3 text-xs gap-1.5 rounded-sm",
  md: "h-10 px-4 text-sm gap-2 rounded-md",
  lg: "h-12 px-6 text-base gap-2.5 rounded-md",
} as const;

// ────────────────────────────────────────────────────────────────────────────
// Types
// ────────────────────────────────────────────────────────────────────────────

export type ButtonVariant = keyof typeof variantStyles;
export type ButtonSize = keyof typeof sizeStyles;

export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  /** Visual style variant. */
  variant?: ButtonVariant;
  /** Size preset. */
  size?: ButtonSize;
  /** Shows a spinner and disables the button. */
  loading?: boolean;
  /** Renders as a full-width block element. */
  fullWidth?: boolean;
}

// ────────────────────────────────────────────────────────────────────────────
// Component
// ────────────────────────────────────────────────────────────────────────────

const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  (
    {
      className,
      variant = "primary",
      size = "md",
      loading = false,
      fullWidth = false,
      disabled,
      children,
      ...props
    },
    ref,
  ) => {
    const isDisabled = disabled || loading;

    return (
      <motion.button
        ref={ref}
        disabled={isDisabled}
        whileHover={isDisabled ? undefined : { scale: 1.02 }}
        whileTap={isDisabled ? undefined : { scale: 0.97 }}
        transition={{ type: "spring", stiffness: 400, damping: 17 }}
        className={cn(
          // Base styles
          "inline-flex items-center justify-center font-sans font-medium",
          "transition-colors duration-micro ease-out-probatio",
          "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-offset-obsidian",
          "disabled:pointer-events-none disabled:opacity-50",
          // Variant
          variantStyles[variant],
          // Size
          sizeStyles[size],
          // Full width
          fullWidth && "w-full",
          className,
        )}
        {...(props as React.ComponentPropsWithoutRef<typeof motion.button>)}
      >
        {loading && (
          <Loader2
            className="animate-spin shrink-0"
            aria-hidden="true"
            size={size === "sm" ? 14 : size === "lg" ? 20 : 16}
          />
        )}
        {children as React.ReactNode}
      </motion.button>
    );
  },
);

Button.displayName = "Button";

export { Button };
