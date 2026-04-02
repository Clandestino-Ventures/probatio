"use client";

/**
 * PROBATIO — Tabs Component
 *
 * Accessible tabs with subtle animated underline indicator,
 * bone active / ash inactive text, and keyboard navigation.
 */

import * as React from "react";
import { motion } from "framer-motion";
import { cn } from "@/lib/utils";

// ────────────────────────────────────────────────────────────────────────────
// Context
// ────────────────────────────────────────────────────────────────────────────

interface TabsContextValue {
  value: string;
  onValueChange: (value: string) => void;
}

const TabsContext = React.createContext<TabsContextValue | null>(null);

function useTabsContext(): TabsContextValue {
  const ctx = React.useContext(TabsContext);
  if (!ctx) throw new Error("Tabs compound components must be used within <Tabs>");
  return ctx;
}

// ────────────────────────────────────────────────────────────────────────────
// Root
// ────────────────────────────────────────────────────────────────────────────

export interface TabsProps extends React.HTMLAttributes<HTMLDivElement> {
  /** The currently active tab value. */
  value: string;
  /** Callback when active tab changes. */
  onValueChange: (value: string) => void;
}

const Tabs = React.forwardRef<HTMLDivElement, TabsProps>(
  ({ value, onValueChange, className, children, ...props }, ref) => {
    return (
      <TabsContext.Provider value={{ value, onValueChange }}>
        <div ref={ref} className={cn("w-full", className)} {...props}>
          {children}
        </div>
      </TabsContext.Provider>
    );
  },
);

Tabs.displayName = "Tabs";

// ────────────────────────────────────────────────────────────────────────────
// Tab List
// ────────────────────────────────────────────────────────────────────────────

export interface TabsListProps extends React.HTMLAttributes<HTMLDivElement> {}

const TabsList = React.forwardRef<HTMLDivElement, TabsListProps>(
  ({ className, children, ...props }, ref) => {
    const handleKeyDown = (e: React.KeyboardEvent) => {
      const tabs = Array.from(
        (e.currentTarget as HTMLElement).querySelectorAll<HTMLElement>('[role="tab"]'),
      );
      const current = document.activeElement as HTMLElement;
      const index = tabs.indexOf(current);

      let next: HTMLElement | undefined;
      if (e.key === "ArrowRight") {
        next = tabs[(index + 1) % tabs.length];
      } else if (e.key === "ArrowLeft") {
        next = tabs[(index - 1 + tabs.length) % tabs.length];
      } else if (e.key === "Home") {
        next = tabs[0];
      } else if (e.key === "End") {
        next = tabs[tabs.length - 1];
      }

      if (next) {
        e.preventDefault();
        next.focus();
        next.click();
      }
    };

    return (
      <div
        ref={ref}
        role="tablist"
        onKeyDown={handleKeyDown}
        className={cn(
          "flex items-center gap-1 border-b border-slate/50",
          className,
        )}
        {...props}
      >
        {children}
      </div>
    );
  },
);

TabsList.displayName = "TabsList";

// ────────────────────────────────────────────────────────────────────────────
// Tab Trigger
// ────────────────────────────────────────────────────────────────────────────

export interface TabsTriggerProps
  extends Omit<React.ButtonHTMLAttributes<HTMLButtonElement>, "value"> {
  /** Unique value identifying this tab. */
  value: string;
}

const TabsTrigger = React.forwardRef<HTMLButtonElement, TabsTriggerProps>(
  ({ value, className, children, ...props }, ref) => {
    const { value: activeValue, onValueChange } = useTabsContext();
    const isActive = value === activeValue;

    return (
      <button
        ref={ref}
        role="tab"
        type="button"
        tabIndex={isActive ? 0 : -1}
        aria-selected={isActive}
        aria-controls={`tabpanel-${value}`}
        id={`tab-${value}`}
        onClick={() => onValueChange(value)}
        className={cn(
          "relative px-4 py-2.5 text-sm font-sans font-medium",
          "transition-colors duration-micro",
          "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-forensic-blue focus-visible:ring-offset-2 focus-visible:ring-offset-obsidian",
          "rounded-t-sm",
          isActive ? "text-bone" : "text-ash hover:text-bone/70",
          className,
        )}
        {...props}
      >
        {children}
        {isActive && (
          <motion.div
            layoutId="tab-indicator"
            className="absolute bottom-0 left-0 right-0 h-0.5 bg-forensic-blue rounded-full"
            transition={{ type: "spring", stiffness: 400, damping: 28 }}
          />
        )}
      </button>
    );
  },
);

TabsTrigger.displayName = "TabsTrigger";

// ────────────────────────────────────────────────────────────────────────────
// Tab Content
// ────────────────────────────────────────────────────────────────────────────

export interface TabsContentProps extends React.HTMLAttributes<HTMLDivElement> {
  /** Must match the value of its corresponding TabsTrigger. */
  value: string;
}

const TabsContent = React.forwardRef<HTMLDivElement, TabsContentProps>(
  ({ value, className, children, onDrag: _onDrag, onDragStart: _onDragStart, onDragEnd: _onDragEnd, ...props }, ref) => {
    const { value: activeValue } = useTabsContext();

    if (value !== activeValue) return null;

    return (
      <motion.div
        ref={ref}
        role="tabpanel"
        id={`tabpanel-${value}`}
        aria-labelledby={`tab-${value}`}
        tabIndex={0}
        initial={{ opacity: 0, y: 4 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.2 }}
        className={cn("mt-4 focus-visible:outline-none", className)}
        {...(props as React.ComponentPropsWithoutRef<typeof motion.div>)}
      >
        {children}
      </motion.div>
    );
  },
);

TabsContent.displayName = "TabsContent";

export { Tabs, TabsList, TabsTrigger, TabsContent };
