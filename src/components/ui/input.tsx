"use client";

/**
 * PROBATIO — Input Component
 *
 * Dark-first text input with graphite background, slate border,
 * focus ring, error states, optional label, and mono variant.
 */

import * as React from "react";
import { cn } from "@/lib/utils";

// ────────────────────────────────────────────────────────────────────────────
// Types
// ────────────────────────────────────────────────────────────────────────────

export interface InputProps
  extends Omit<React.InputHTMLAttributes<HTMLInputElement>, "ref"> {
  /** Optional label rendered above the input. */
  label?: string;
  /** Error message displayed below the input. */
  error?: string;
  /** Hint text displayed below the input (hidden when error is present). */
  hint?: string;
  /** Renders in monospace font — ideal for hashes, IDs, and raw data. */
  mono?: boolean;
  /** Left-side icon or element. */
  startIcon?: React.ReactNode;
  /** Right-side icon or element. */
  endIcon?: React.ReactNode;
}

// ────────────────────────────────────────────────────────────────────────────
// Component
// ────────────────────────────────────────────────────────────────────────────

const Input = React.forwardRef<HTMLInputElement, InputProps>(
  (
    {
      className,
      label,
      error,
      hint,
      mono = false,
      startIcon,
      endIcon,
      type = "text",
      id: idProp,
      "aria-describedby": ariaDescribedBy,
      ...props
    },
    ref,
  ) => {
    const generatedId = React.useId();
    const id = idProp ?? generatedId;
    const errorId = `${id}-error`;
    const hintId = `${id}-hint`;

    const describedBy = [
      ariaDescribedBy,
      error ? errorId : undefined,
      hint && !error ? hintId : undefined,
    ]
      .filter(Boolean)
      .join(" ") || undefined;

    return (
      <div className="flex flex-col gap-1.5 w-full">
        {label && (
          <label
            htmlFor={id}
            className="text-sm font-sans font-medium text-bone/80"
          >
            {label}
          </label>
        )}

        <div className="relative flex items-center">
          {startIcon && (
            <span className="absolute left-3 text-ash pointer-events-none" aria-hidden="true">
              {startIcon}
            </span>
          )}

          <input
            ref={ref}
            id={id}
            type={type}
            aria-invalid={error ? "true" : undefined}
            aria-describedby={describedBy}
            className={cn(
              // Base
              "w-full h-10 px-3 rounded-md text-sm text-bone placeholder:text-ash/60",
              "bg-graphite border border-slate",
              "transition-colors duration-micro ease-out-probatio",
              // Focus
              "focus:outline-none focus:ring-2 focus:ring-forensic-blue focus:ring-offset-1 focus:ring-offset-obsidian focus:border-forensic-blue",
              // Disabled
              "disabled:opacity-50 disabled:cursor-not-allowed",
              // Error
              error && "border-signal-red focus:ring-signal-red focus:border-signal-red",
              // Mono
              mono && "font-mono tracking-wide text-xs",
              // Icons padding
              startIcon && "pl-10",
              endIcon && "pr-10",
              className,
            )}
            {...props}
          />

          {endIcon && (
            <span className="absolute right-3 text-ash pointer-events-none" aria-hidden="true">
              {endIcon}
            </span>
          )}
        </div>

        {error && (
          <p id={errorId} className="text-xs text-signal-red font-sans" role="alert">
            {error}
          </p>
        )}

        {hint && !error && (
          <p id={hintId} className="text-xs text-ash font-sans">
            {hint}
          </p>
        )}
      </div>
    );
  },
);

Input.displayName = "Input";

export { Input };
