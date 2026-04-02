"use client";

/**
 * PROBATIO — Accordion Component
 *
 * Expandable sections with animated chevron rotation and
 * Framer Motion smooth height transitions. Used for FAQ, settings, etc.
 */

import * as React from "react";
import { motion, AnimatePresence } from "framer-motion";
import { ChevronDown } from "lucide-react";
import { cn } from "@/lib/utils";

// ────────────────────────────────────────────────────────────────────────────
// Context
// ────────────────────────────────────────────────────────────────────────────

interface AccordionContextValue {
  /** Set of currently expanded item values. */
  expanded: Set<string>;
  toggle: (value: string) => void;
  /** Whether multiple items can be open at once. */
  multiple: boolean;
}

const AccordionContext = React.createContext<AccordionContextValue | null>(null);

function useAccordionContext(): AccordionContextValue {
  const ctx = React.useContext(AccordionContext);
  if (!ctx) throw new Error("Accordion components must be used within <Accordion>");
  return ctx;
}

// ────────────────────────────────────────────────────────────────────────────
// Root
// ────────────────────────────────────────────────────────────────────────────

export interface AccordionProps extends React.HTMLAttributes<HTMLDivElement> {
  /** Allow multiple items to be open simultaneously. */
  multiple?: boolean;
  /** Controlled: set of expanded values. */
  value?: string[];
  /** Callback when expanded values change. */
  onValueChange?: (value: string[]) => void;
  /** Default expanded values for uncontrolled usage. */
  defaultValue?: string[];
}

const Accordion = React.forwardRef<HTMLDivElement, AccordionProps>(
  (
    {
      className,
      multiple = false,
      value: controlledValue,
      onValueChange,
      defaultValue = [],
      children,
      ...props
    },
    ref,
  ) => {
    const [internalValue, setInternalValue] = React.useState<Set<string>>(
      new Set(defaultValue),
    );

    const expanded = controlledValue ? new Set(controlledValue) : internalValue;

    const toggle = React.useCallback(
      (itemValue: string) => {
        const next = new Set(expanded);

        if (next.has(itemValue)) {
          next.delete(itemValue);
        } else {
          if (!multiple) next.clear();
          next.add(itemValue);
        }

        if (onValueChange) {
          onValueChange(Array.from(next));
        } else {
          setInternalValue(next);
        }
      },
      [expanded, multiple, onValueChange],
    );

    return (
      <AccordionContext.Provider value={{ expanded, toggle, multiple }}>
        <div
          ref={ref}
          className={cn("divide-y divide-slate/40", className)}
          {...props}
        >
          {children}
        </div>
      </AccordionContext.Provider>
    );
  },
);

Accordion.displayName = "Accordion";

// ────────────────────────────────────────────────────────────────────────────
// Item
// ────────────────────────────────────────────────────────────────────────────

interface AccordionItemContextValue {
  value: string;
  isOpen: boolean;
}

const AccordionItemContext = React.createContext<AccordionItemContextValue | null>(null);

function useAccordionItemContext(): AccordionItemContextValue {
  const ctx = React.useContext(AccordionItemContext);
  if (!ctx) throw new Error("AccordionItem components must be used within <AccordionItem>");
  return ctx;
}

export interface AccordionItemProps extends React.HTMLAttributes<HTMLDivElement> {
  /** Unique value for this accordion item. */
  value: string;
}

const AccordionItem = React.forwardRef<HTMLDivElement, AccordionItemProps>(
  ({ value, className, children, ...props }, ref) => {
    const { expanded } = useAccordionContext();
    const isOpen = expanded.has(value);

    return (
      <AccordionItemContext.Provider value={{ value, isOpen }}>
        <div ref={ref} className={cn("py-0", className)} {...props}>
          {children}
        </div>
      </AccordionItemContext.Provider>
    );
  },
);

AccordionItem.displayName = "AccordionItem";

// ────────────────────────────────────────────────────────────────────────────
// Trigger
// ────────────────────────────────────────────────────────────────────────────

export interface AccordionTriggerProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement> {}

const AccordionTrigger = React.forwardRef<HTMLButtonElement, AccordionTriggerProps>(
  ({ className, children, ...props }, ref) => {
    const { toggle } = useAccordionContext();
    const { value, isOpen } = useAccordionItemContext();

    return (
      <button
        ref={ref}
        type="button"
        aria-expanded={isOpen}
        aria-controls={`accordion-content-${value}`}
        id={`accordion-trigger-${value}`}
        onClick={() => toggle(value)}
        className={cn(
          "flex w-full items-center justify-between py-4 text-left",
          "text-sm font-sans font-medium text-bone",
          "hover:text-bone/80 transition-colors duration-micro",
          "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-forensic-blue focus-visible:ring-offset-2 focus-visible:ring-offset-obsidian rounded-sm",
          className,
        )}
        {...props}
      >
        <span className="flex-1">{children}</span>
        <motion.span
          animate={{ rotate: isOpen ? 180 : 0 }}
          transition={{ type: "spring", stiffness: 300, damping: 20 }}
          className="shrink-0 ml-2 text-ash"
          aria-hidden="true"
        >
          <ChevronDown size={16} />
        </motion.span>
      </button>
    );
  },
);

AccordionTrigger.displayName = "AccordionTrigger";

// ────────────────────────────────────────────────────────────────────────────
// Content
// ────────────────────────────────────────────────────────────────────────────

export interface AccordionContentProps extends React.HTMLAttributes<HTMLDivElement> {}

const AccordionContent = React.forwardRef<HTMLDivElement, AccordionContentProps>(
  ({ className, children, ...props }, ref) => {
    const { value, isOpen } = useAccordionItemContext();

    return (
      <AnimatePresence initial={false}>
        {isOpen && (
          <motion.div
            ref={ref}
            id={`accordion-content-${value}`}
            role="region"
            aria-labelledby={`accordion-trigger-${value}`}
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ type: "spring", stiffness: 300, damping: 30 }}
            className="overflow-hidden"
          >
            <div
              className={cn("pb-4 text-sm text-ash leading-relaxed", className)}
              {...props}
            >
              {children}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    );
  },
);

AccordionContent.displayName = "AccordionContent";

export { Accordion, AccordionItem, AccordionTrigger, AccordionContent };
