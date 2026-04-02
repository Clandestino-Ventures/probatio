"use client";

/**
 * PROBATIO — Dropdown Menu Component
 *
 * Accessible dropdown menu with graphite background, hover states,
 * separators, icon support, and Framer Motion animations.
 */

import * as React from "react";
import { createPortal } from "react-dom";
import { motion, AnimatePresence } from "framer-motion";
import { cn } from "@/lib/utils";

// ────────────────────────────────────────────────────────────────────────────
// Context
// ────────────────────────────────────────────────────────────────────────────

interface DropdownContextValue {
  open: boolean;
  setOpen: React.Dispatch<React.SetStateAction<boolean>>;
  triggerRef: React.RefObject<HTMLButtonElement | null>;
}

const DropdownContext = React.createContext<DropdownContextValue | null>(null);

function useDropdownContext(): DropdownContextValue {
  const ctx = React.useContext(DropdownContext);
  if (!ctx) throw new Error("Dropdown compound components must be used within <Dropdown>");
  return ctx;
}

// ────────────────────────────────────────────────────────────────────────────
// Root
// ────────────────────────────────────────────────────────────────────────────

export interface DropdownProps {
  children: React.ReactNode;
}

function Dropdown({ children }: DropdownProps) {
  const [open, setOpen] = React.useState(false);
  const triggerRef = React.useRef<HTMLButtonElement>(null);

  // Close on outside click
  React.useEffect(() => {
    if (!open) return;

    const handleClick = (e: MouseEvent) => {
      if (triggerRef.current?.contains(e.target as Node)) return;
      setOpen(false);
    };

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        setOpen(false);
        triggerRef.current?.focus();
      }
    };

    document.addEventListener("mousedown", handleClick);
    document.addEventListener("keydown", handleKeyDown);
    return () => {
      document.removeEventListener("mousedown", handleClick);
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [open]);

  return (
    <DropdownContext.Provider value={{ open, setOpen, triggerRef }}>
      <div className="relative inline-block">{children}</div>
    </DropdownContext.Provider>
  );
}

// ────────────────────────────────────────────────────────────────────────────
// Trigger
// ────────────────────────────────────────────────────────────────────────────

export interface DropdownTriggerProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement> {}

const DropdownTrigger = React.forwardRef<HTMLButtonElement, DropdownTriggerProps>(
  ({ onClick, ...props }, ref) => {
    const { open, setOpen, triggerRef } = useDropdownContext();

    return (
      <button
        ref={(node) => {
          (triggerRef as React.MutableRefObject<HTMLButtonElement | null>).current = node;
          if (typeof ref === "function") ref(node);
          else if (ref) (ref as React.MutableRefObject<HTMLButtonElement | null>).current = node;
        }}
        type="button"
        aria-haspopup="menu"
        aria-expanded={open}
        onClick={(e) => {
          onClick?.(e);
          setOpen((prev) => !prev);
        }}
        {...props}
      />
    );
  },
);

DropdownTrigger.displayName = "DropdownTrigger";

// ────────────────────────────────────────────────────────────────────────────
// Content
// ────────────────────────────────────────────────────────────────────────────

const contentVariants = {
  hidden: { opacity: 0, scale: 0.95, y: -4 },
  visible: { opacity: 1, scale: 1, y: 0 },
};

export interface DropdownContentProps {
  /** Alignment relative to the trigger. */
  align?: "start" | "center" | "end";
  className?: string;
  children?: React.ReactNode;
}

const DropdownContent = React.forwardRef<HTMLDivElement, DropdownContentProps>(
  ({ className, align = "end", children }, ref) => {
    const { open } = useDropdownContext();
    const menuRef = React.useRef<HTMLDivElement>(null);

    // Focus first item on open
    React.useEffect(() => {
      if (!open) return;
      const timer = setTimeout(() => {
        const first = menuRef.current?.querySelector<HTMLElement>(
          '[role="menuitem"]:not([disabled])',
        );
        first?.focus();
      }, 50);
      return () => clearTimeout(timer);
    }, [open]);

    // Keyboard navigation within menu
    const handleKeyDown = (e: React.KeyboardEvent) => {
      const items = Array.from(
        menuRef.current?.querySelectorAll<HTMLElement>('[role="menuitem"]:not([disabled])') ?? [],
      );
      const current = document.activeElement as HTMLElement;
      const index = items.indexOf(current);

      if (e.key === "ArrowDown") {
        e.preventDefault();
        items[(index + 1) % items.length]?.focus();
      } else if (e.key === "ArrowUp") {
        e.preventDefault();
        items[(index - 1 + items.length) % items.length]?.focus();
      } else if (e.key === "Home") {
        e.preventDefault();
        items[0]?.focus();
      } else if (e.key === "End") {
        e.preventDefault();
        items[items.length - 1]?.focus();
      }
    };

    const alignClass =
      align === "start" ? "left-0" : align === "center" ? "left-1/2 -translate-x-1/2" : "right-0";

    return (
      <AnimatePresence>
        {open && (
          <motion.div
            ref={(node) => {
              (menuRef as React.MutableRefObject<HTMLDivElement | null>).current = node;
              if (typeof ref === "function") ref(node);
              else if (ref) (ref as React.MutableRefObject<HTMLDivElement | null>).current = node;
            }}
            role="menu"
            variants={contentVariants}
            initial="hidden"
            animate="visible"
            exit="hidden"
            transition={{ type: "spring", stiffness: 400, damping: 24 }}
            onKeyDown={handleKeyDown}
            className={cn(
              "absolute z-50 mt-1 min-w-[180px]",
              "rounded-md border border-slate bg-graphite shadow-elevated",
              "py-1",
              alignClass,
              className,
            )}
          >
            {children}
          </motion.div>
        )}
      </AnimatePresence>
    );
  },
);

DropdownContent.displayName = "DropdownContent";

// ────────────────────────────────────────────────────────────────────────────
// Item
// ────────────────────────────────────────────────────────────────────────────

export interface DropdownItemProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  /** Icon rendered before the label. */
  icon?: React.ReactNode;
  /** Renders in destructive (signal-red) style. */
  destructive?: boolean;
}

const DropdownItem = React.forwardRef<HTMLButtonElement, DropdownItemProps>(
  ({ className, icon, destructive = false, disabled, children, onClick, ...props }, ref) => {
    const { setOpen } = useDropdownContext();

    return (
      <button
        ref={ref}
        role="menuitem"
        disabled={disabled}
        tabIndex={-1}
        onClick={(e) => {
          onClick?.(e);
          setOpen(false);
        }}
        className={cn(
          "flex w-full items-center gap-2.5 px-3 py-2 text-sm font-sans text-left",
          "transition-colors duration-micro",
          "focus:outline-none focus:bg-slate/40",
          destructive
            ? "text-signal-red hover:bg-signal-red/10 focus:bg-signal-red/10"
            : "text-bone hover:bg-slate/30",
          disabled && "opacity-50 pointer-events-none",
          className,
        )}
        {...props}
      >
        {icon && (
          <span className="shrink-0 w-4 h-4" aria-hidden="true">
            {icon}
          </span>
        )}
        {children}
      </button>
    );
  },
);

DropdownItem.displayName = "DropdownItem";

// ────────────────────────────────────────────────────────────────────────────
// Label
// ────────────────────────────────────────────────────────────────────────────

export interface DropdownLabelProps extends React.HTMLAttributes<HTMLDivElement> {}

const DropdownLabel = React.forwardRef<HTMLDivElement, DropdownLabelProps>(
  ({ className, ...props }, ref) => (
    <div
      ref={ref}
      className={cn("px-3 py-1.5 text-xs font-sans font-medium text-ash", className)}
      {...props}
    />
  ),
);

DropdownLabel.displayName = "DropdownLabel";

// ────────────────────────────────────────────────────────────────────────────
// Separator
// ────────────────────────────────────────────────────────────────────────────

export interface DropdownSeparatorProps extends React.HTMLAttributes<HTMLDivElement> {}

const DropdownSeparator = React.forwardRef<HTMLDivElement, DropdownSeparatorProps>(
  ({ className, ...props }, ref) => (
    <div
      ref={ref}
      role="separator"
      className={cn("my-1 h-px bg-slate/50", className)}
      {...props}
    />
  ),
);

DropdownSeparator.displayName = "DropdownSeparator";

export {
  Dropdown,
  DropdownTrigger,
  DropdownContent,
  DropdownItem,
  DropdownLabel,
  DropdownSeparator,
};
