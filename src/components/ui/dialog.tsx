"use client";

/**
 * PROBATIO — Dialog Component
 *
 * Accessible modal dialog with obsidian backdrop, carbon background,
 * Framer Motion enter/exit animations, and keyboard navigation.
 */

import * as React from "react";
import { createPortal } from "react-dom";
import { motion, AnimatePresence } from "framer-motion";
import { X } from "lucide-react";
import { cn } from "@/lib/utils";

// ────────────────────────────────────────────────────────────────────────────
// Context
// ────────────────────────────────────────────────────────────────────────────

interface DialogContextValue {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

const DialogContext = React.createContext<DialogContextValue | null>(null);

function useDialogContext(): DialogContextValue {
  const ctx = React.useContext(DialogContext);
  if (!ctx) throw new Error("Dialog compound components must be used within <Dialog>");
  return ctx;
}

// ────────────────────────────────────────────────────────────────────────────
// Root
// ────────────────────────────────────────────────────────────────────────────

export interface DialogProps {
  /** Controlled open state. */
  open: boolean;
  /** Callback when the open state changes. */
  onOpenChange: (open: boolean) => void;
  children: React.ReactNode;
}

function Dialog({ open, onOpenChange, children }: DialogProps) {
  return (
    <DialogContext.Provider value={{ open, onOpenChange }}>
      {children}
    </DialogContext.Provider>
  );
}

// ────────────────────────────────────────────────────────────────────────────
// Trigger
// ────────────────────────────────────────────────────────────────────────────

export interface DialogTriggerProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement> {}

const DialogTrigger = React.forwardRef<HTMLButtonElement, DialogTriggerProps>(
  ({ onClick, ...props }, ref) => {
    const { onOpenChange } = useDialogContext();

    return (
      <button
        ref={ref}
        type="button"
        onClick={(e) => {
          onClick?.(e);
          onOpenChange(true);
        }}
        {...props}
      />
    );
  },
);

DialogTrigger.displayName = "DialogTrigger";

// ────────────────────────────────────────────────────────────────────────────
// Portal + Overlay + Content
// ────────────────────────────────────────────────────────────────────────────

const overlayVariants = {
  hidden: { opacity: 0 },
  visible: { opacity: 1 },
};

const contentVariants = {
  hidden: { opacity: 0, scale: 0.95, y: 8 },
  visible: { opacity: 1, scale: 1, y: 0 },
};

export interface DialogContentProps {
  /** Optional title for the dialog — used by aria-label. */
  "aria-label"?: string;
  /** Optional accessible description. */
  "aria-describedby"?: string;
  className?: string;
  children?: React.ReactNode;
}

const DialogContent = React.forwardRef<HTMLDivElement, DialogContentProps>(
  ({ className, children, ...props }, ref) => {
    const { open, onOpenChange } = useDialogContext();
    const [mounted, setMounted] = React.useState(false);
    const contentRef = React.useRef<HTMLDivElement>(null);

    // Ensure portal only renders client-side
    React.useEffect(() => {
      setMounted(true);
    }, []);

    // Trap focus & close on Escape
    React.useEffect(() => {
      if (!open) return;

      const handleKeyDown = (e: KeyboardEvent) => {
        if (e.key === "Escape") {
          e.preventDefault();
          onOpenChange(false);
        }
      };

      // Prevent body scroll
      const originalOverflow = document.body.style.overflow;
      document.body.style.overflow = "hidden";

      document.addEventListener("keydown", handleKeyDown);

      // Focus the content on open
      const timer = setTimeout(() => {
        const focusable = contentRef.current?.querySelector<HTMLElement>(
          'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])',
        );
        focusable?.focus();
      }, 50);

      return () => {
        document.removeEventListener("keydown", handleKeyDown);
        document.body.style.overflow = originalOverflow;
        clearTimeout(timer);
      };
    }, [open, onOpenChange]);

    if (!mounted) return null;

    return createPortal(
      <AnimatePresence>
        {open && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            {/* Overlay */}
            <motion.div
              variants={overlayVariants}
              initial="hidden"
              animate="visible"
              exit="hidden"
              transition={{ duration: 0.2 }}
              className="absolute inset-0 bg-obsidian/50 backdrop-blur-sm"
              onClick={() => onOpenChange(false)}
              aria-hidden="true"
            />

            {/* Content */}
            <motion.div
              ref={(node) => {
                // Merge refs
                (contentRef as React.MutableRefObject<HTMLDivElement | null>).current = node;
                if (typeof ref === "function") ref(node);
                else if (ref) (ref as React.MutableRefObject<HTMLDivElement | null>).current = node;
              }}
              role="dialog"
              aria-modal="true"
              variants={contentVariants}
              initial="hidden"
              animate="visible"
              exit="hidden"
              transition={{ type: "spring", stiffness: 300, damping: 24 }}
              className={cn(
                "relative z-10 w-full max-w-lg",
                "rounded-lg border border-slate bg-carbon shadow-elevated",
                "p-6",
                className,
              )}
              {...props}
            >
              {children}
            </motion.div>
          </div>
        )}
      </AnimatePresence>,
      document.body,
    );
  },
);

DialogContent.displayName = "DialogContent";

// ────────────────────────────────────────────────────────────────────────────
// Close Button
// ────────────────────────────────────────────────────────────────────────────

export interface DialogCloseProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement> {}

const DialogClose = React.forwardRef<HTMLButtonElement, DialogCloseProps>(
  ({ className, onClick, ...props }, ref) => {
    const { onOpenChange } = useDialogContext();

    return (
      <button
        ref={ref}
        type="button"
        onClick={(e) => {
          onClick?.(e);
          onOpenChange(false);
        }}
        className={cn(
          "absolute right-4 top-4 p-1 rounded-sm text-ash",
          "hover:text-bone hover:bg-slate/30",
          "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-forensic-blue focus-visible:ring-offset-2 focus-visible:ring-offset-carbon",
          "transition-colors duration-micro",
          className,
        )}
        aria-label="Close dialog"
        {...props}
      >
        <X size={16} aria-hidden="true" />
      </button>
    );
  },
);

DialogClose.displayName = "DialogClose";

// ────────────────────────────────────────────────────────────────────────────
// Header & Footer helpers
// ────────────────────────────────────────────────────────────────────────────

export interface DialogHeaderProps extends React.HTMLAttributes<HTMLDivElement> {}

const DialogHeader = React.forwardRef<HTMLDivElement, DialogHeaderProps>(
  ({ className, ...props }, ref) => (
    <div
      ref={ref}
      className={cn("flex flex-col gap-1.5 mb-4", className)}
      {...props}
    />
  ),
);

DialogHeader.displayName = "DialogHeader";

export interface DialogTitleProps extends React.HTMLAttributes<HTMLHeadingElement> {}

const DialogTitle = React.forwardRef<HTMLHeadingElement, DialogTitleProps>(
  ({ className, ...props }, ref) => (
    <h2
      ref={ref}
      className={cn("text-lg font-sans font-semibold text-bone", className)}
      {...props}
    />
  ),
);

DialogTitle.displayName = "DialogTitle";

export interface DialogDescriptionProps extends React.HTMLAttributes<HTMLParagraphElement> {}

const DialogDescription = React.forwardRef<HTMLParagraphElement, DialogDescriptionProps>(
  ({ className, ...props }, ref) => (
    <p
      ref={ref}
      className={cn("text-sm text-ash", className)}
      {...props}
    />
  ),
);

DialogDescription.displayName = "DialogDescription";

export interface DialogFooterProps extends React.HTMLAttributes<HTMLDivElement> {}

const DialogFooter = React.forwardRef<HTMLDivElement, DialogFooterProps>(
  ({ className, ...props }, ref) => (
    <div
      ref={ref}
      className={cn("flex items-center justify-end gap-3 mt-6", className)}
      {...props}
    />
  ),
);

DialogFooter.displayName = "DialogFooter";

export {
  Dialog,
  DialogTrigger,
  DialogContent,
  DialogClose,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
};
