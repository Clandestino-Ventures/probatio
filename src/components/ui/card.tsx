"use client";

/**
 * PROBATIO — Card Component
 *
 * Carbon-background card with slate border, header/content/footer slots,
 * and Framer Motion hover elevation effect.
 */

import * as React from "react";
import { motion, type HTMLMotionProps } from "framer-motion";
import { cn } from "@/lib/utils";

// ────────────────────────────────────────────────────────────────────────────
// Card Root
// ────────────────────────────────────────────────────────────────────────────

export interface CardProps extends Omit<HTMLMotionProps<"div">, "ref"> {
  /** Disables the hover elevation effect. */
  static?: boolean;
}

const Card = React.forwardRef<HTMLDivElement, CardProps>(
  ({ className, static: isStatic = false, children, ...props }, ref) => {
    return (
      <motion.div
        ref={ref}
        whileHover={
          isStatic
            ? undefined
            : { y: -2, boxShadow: "0 4px 12px rgba(0, 0, 0, 0.4), 0 2px 4px rgba(0, 0, 0, 0.3)" }
        }
        transition={{ type: "spring", stiffness: 300, damping: 20 }}
        className={cn(
          "rounded-md border border-slate bg-carbon shadow-card",
          "transition-colors duration-micro",
          className,
        )}
        {...props}
      >
        {children}
      </motion.div>
    );
  },
);

Card.displayName = "Card";

// ────────────────────────────────────────────────────────────────────────────
// Card Header
// ────────────────────────────────────────────────────────────────────────────

export interface CardHeaderProps extends React.HTMLAttributes<HTMLDivElement> {}

const CardHeader = React.forwardRef<HTMLDivElement, CardHeaderProps>(
  ({ className, ...props }, ref) => {
    return (
      <div
        ref={ref}
        className={cn(
          "flex flex-col gap-1.5 p-6 pb-0",
          className,
        )}
        {...props}
      />
    );
  },
);

CardHeader.displayName = "CardHeader";

// ────────────────────────────────────────────────────────────────────────────
// Card Title
// ────────────────────────────────────────────────────────────────────────────

export interface CardTitleProps extends React.HTMLAttributes<HTMLHeadingElement> {}

const CardTitle = React.forwardRef<HTMLHeadingElement, CardTitleProps>(
  ({ className, ...props }, ref) => {
    return (
      <h3
        ref={ref}
        className={cn("text-lg font-sans font-semibold text-bone tracking-tight", className)}
        {...props}
      />
    );
  },
);

CardTitle.displayName = "CardTitle";

// ────────────────────────────────────────────────────────────────────────────
// Card Description
// ────────────────────────────────────────────────────────────────────────────

export interface CardDescriptionProps extends React.HTMLAttributes<HTMLParagraphElement> {}

const CardDescription = React.forwardRef<HTMLParagraphElement, CardDescriptionProps>(
  ({ className, ...props }, ref) => {
    return (
      <p
        ref={ref}
        className={cn("text-sm text-ash", className)}
        {...props}
      />
    );
  },
);

CardDescription.displayName = "CardDescription";

// ────────────────────────────────────────────────────────────────────────────
// Card Content
// ────────────────────────────────────────────────────────────────────────────

export interface CardContentProps extends React.HTMLAttributes<HTMLDivElement> {}

const CardContent = React.forwardRef<HTMLDivElement, CardContentProps>(
  ({ className, ...props }, ref) => {
    return (
      <div
        ref={ref}
        className={cn("p-6", className)}
        {...props}
      />
    );
  },
);

CardContent.displayName = "CardContent";

// ────────────────────────────────────────────────────────────────────────────
// Card Footer
// ────────────────────────────────────────────────────────────────────────────

export interface CardFooterProps extends React.HTMLAttributes<HTMLDivElement> {}

const CardFooter = React.forwardRef<HTMLDivElement, CardFooterProps>(
  ({ className, ...props }, ref) => {
    return (
      <div
        ref={ref}
        className={cn(
          "flex items-center p-6 pt-0",
          className,
        )}
        {...props}
      />
    );
  },
);

CardFooter.displayName = "CardFooter";

export { Card, CardHeader, CardTitle, CardDescription, CardContent, CardFooter };
