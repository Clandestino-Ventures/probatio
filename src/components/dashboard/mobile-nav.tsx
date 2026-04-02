"use client";

import { useState, useEffect } from "react";
import { Menu, X } from "lucide-react";
import { cn } from "@/lib/utils";
import { usePathname } from "next/navigation";

interface MobileNavProps {
  children: React.ReactNode; // The sidebar content
}

export function MobileNav({ children }: MobileNavProps) {
  const [open, setOpen] = useState(false);
  const pathname = usePathname();

  // Close on navigation
  useEffect(() => {
    setOpen(false);
  }, [pathname]);

  // Close on ESC
  useEffect(() => {
    function handleEsc(e: KeyboardEvent) {
      if (e.key === "Escape") setOpen(false);
    }
    window.addEventListener("keydown", handleEsc);
    return () => window.removeEventListener("keydown", handleEsc);
  }, []);

  return (
    <>
      {/* Hamburger button — visible only on mobile */}
      <button
        onClick={() => setOpen(true)}
        className="lg:hidden fixed top-3 left-3 z-50 p-2 bg-carbon border border-slate rounded-md text-ash hover:text-bone transition-colors"
        aria-label="Open navigation"
      >
        <Menu size={20} />
      </button>

      {/* Backdrop */}
      {open && (
        <div
          className="lg:hidden fixed inset-0 bg-obsidian/80 backdrop-blur-sm z-40"
          onClick={() => setOpen(false)}
        />
      )}

      {/* Slide-in sidebar */}
      <div
        className={cn(
          "lg:hidden fixed inset-y-0 left-0 z-50 w-[280px] bg-carbon border-r border-slate transition-transform duration-300",
          open ? "translate-x-0" : "-translate-x-full"
        )}
      >
        <div className="flex items-center justify-between p-4 border-b border-slate">
          <span className="font-display text-lg tracking-wide uppercase text-bone">
            PROBATIO
          </span>
          <button
            onClick={() => setOpen(false)}
            className="p-1 text-ash hover:text-bone transition-colors"
            aria-label="Close navigation"
          >
            <X size={18} />
          </button>
        </div>
        <div className="overflow-y-auto h-[calc(100%-60px)]">
          {children}
        </div>
      </div>
    </>
  );
}
