"use client";

/**
 * PROBATIO — Tooltip Component
 *
 * Small hover tooltip with graphite background, bone text, 4px radius,
 * directional arrow, and 200ms open delay.
 */

import * as React from "react";
import { createPortal } from "react-dom";
import { motion, AnimatePresence } from "framer-motion";
import { cn } from "@/lib/utils";

// ────────────────────────────────────────────────────────────────────────────
// Types
// ────────────────────────────────────────────────────────────────────────────

export type TooltipSide = "top" | "bottom" | "left" | "right";

export interface TooltipProps {
  /** Tooltip label text. */
  content: React.ReactNode;
  /** Which side to place the tooltip relative to the trigger. */
  side?: TooltipSide;
  /** Open delay in milliseconds. */
  delayMs?: number;
  /** Additional className for the tooltip container. */
  className?: string;
  children: React.ReactElement;
}

// ────────────────────────────────────────────────────────────────────────────
// Component
// ────────────────────────────────────────────────────────────────────────────

function Tooltip({
  content,
  side = "top",
  delayMs = 200,
  className,
  children,
}: TooltipProps) {
  const [open, setOpen] = React.useState(false);
  const [mounted, setMounted] = React.useState(false);
  const [position, setPosition] = React.useState({ top: 0, left: 0 });
  const triggerRef = React.useRef<HTMLElement>(null);
  const delayRef = React.useRef<ReturnType<typeof setTimeout>>(undefined);

  React.useEffect(() => {
    setMounted(true);
    return () => {
      if (delayRef.current) clearTimeout(delayRef.current);
    };
  }, []);

  const computePosition = React.useCallback(() => {
    if (!triggerRef.current) return;
    const rect = triggerRef.current.getBoundingClientRect();
    const gap = 8;

    let top = 0;
    let left = 0;

    switch (side) {
      case "top":
        top = rect.top - gap + window.scrollY;
        left = rect.left + rect.width / 2 + window.scrollX;
        break;
      case "bottom":
        top = rect.bottom + gap + window.scrollY;
        left = rect.left + rect.width / 2 + window.scrollX;
        break;
      case "left":
        top = rect.top + rect.height / 2 + window.scrollY;
        left = rect.left - gap + window.scrollX;
        break;
      case "right":
        top = rect.top + rect.height / 2 + window.scrollY;
        left = rect.right + gap + window.scrollX;
        break;
    }

    setPosition({ top, left });
  }, [side]);

  const handleOpen = () => {
    delayRef.current = setTimeout(() => {
      computePosition();
      setOpen(true);
    }, delayMs);
  };

  const handleClose = () => {
    if (delayRef.current) clearTimeout(delayRef.current);
    setOpen(false);
  };

  // Transform origin for animations
  const transformOrigin: Record<TooltipSide, string> = {
    top: "bottom center",
    bottom: "top center",
    left: "right center",
    right: "left center",
  };

  // Translate for side positioning
  const translateClass: Record<TooltipSide, string> = {
    top: "-translate-x-1/2 -translate-y-full",
    bottom: "-translate-x-1/2",
    left: "-translate-x-full -translate-y-1/2",
    right: "-translate-y-1/2",
  };

  // Arrow styles
  const arrowClass: Record<TooltipSide, string> = {
    top: "left-1/2 -translate-x-1/2 top-full border-l-transparent border-r-transparent border-b-transparent border-t-graphite",
    bottom: "left-1/2 -translate-x-1/2 bottom-full border-l-transparent border-r-transparent border-t-transparent border-b-graphite",
    left: "top-1/2 -translate-y-1/2 left-full border-t-transparent border-b-transparent border-r-transparent border-l-graphite",
    right: "top-1/2 -translate-y-1/2 right-full border-t-transparent border-b-transparent border-l-transparent border-r-graphite",
  };

  // Clone child to attach event handlers and ref
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const childProps = children.props as any;
  const trigger = React.cloneElement(children, {
    ref: triggerRef,
    onMouseEnter: (e: React.MouseEvent) => {
      childProps.onMouseEnter?.(e);
      handleOpen();
    },
    onMouseLeave: (e: React.MouseEvent) => {
      childProps.onMouseLeave?.(e);
      handleClose();
    },
    onFocus: (e: React.FocusEvent) => {
      childProps.onFocus?.(e);
      handleOpen();
    },
    onBlur: (e: React.FocusEvent) => {
      childProps.onBlur?.(e);
      handleClose();
    },
    "aria-describedby": open ? "probatio-tooltip" : undefined,
  } as Record<string, unknown>);

  return (
    <>
      {trigger}
      {mounted &&
        createPortal(
          <AnimatePresence>
            {open && (
              <motion.div
                id="probatio-tooltip"
                role="tooltip"
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.95 }}
                transition={{ duration: 0.15 }}
                style={{
                  position: "absolute",
                  top: position.top,
                  left: position.left,
                  transformOrigin: transformOrigin[side],
                  pointerEvents: "none",
                  zIndex: 9999,
                }}
                className={cn(translateClass[side])}
              >
                <div
                  className={cn(
                    "relative px-2.5 py-1.5 rounded-sm",
                    "bg-graphite text-bone text-xs font-sans whitespace-nowrap",
                    "shadow-elevated",
                    className,
                  )}
                >
                  {content}
                  {/* Arrow */}
                  <span
                    className={cn(
                      "absolute w-0 h-0 border-4",
                      arrowClass[side],
                    )}
                    aria-hidden="true"
                  />
                </div>
              </motion.div>
            )}
          </AnimatePresence>,
          document.body,
        )}
    </>
  );
}

Tooltip.displayName = "Tooltip";

export { Tooltip };
