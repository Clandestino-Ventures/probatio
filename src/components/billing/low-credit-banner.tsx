"use client";

import { useState, useEffect } from "react";
import { cn } from "@/lib/utils";
import { useAuthStore } from "@/stores/auth-store";
import { AlertTriangle, X, ArrowRight } from "lucide-react";
import Link from "next/link";

export function LowCreditBanner() {
  const { creditBalance: balance } = useAuthStore();
  const [dismissed, setDismissed] = useState(false);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
    // Check localStorage for dismissal
    const key = `probatio_credit_banner_dismissed_${new Date().toISOString().slice(0, 10)}`;
    if (localStorage.getItem(key)) {
      setDismissed(true);
    }
  }, []);

  function dismiss() {
    const key = `probatio_credit_banner_dismissed_${new Date().toISOString().slice(0, 10)}`;
    localStorage.setItem(key, "true");
    setDismissed(true);
  }

  if (!mounted || dismissed) return null;

  const isZero = balance <= 0;
  const isLow = balance > 0 && balance <= 5;

  if (!isZero && !isLow) return null;

  return (
    <div
      className={cn(
        "flex items-center justify-between gap-3 px-4 py-2.5 text-sm",
        isZero
          ? "bg-signal-red/10 border-b border-signal-red/20"
          : "bg-risk-moderate/10 border-b border-risk-moderate/20"
      )}
    >
      <div className="flex items-center gap-2">
        <AlertTriangle
          size={14}
          className={isZero ? "text-signal-red" : "text-risk-moderate"}
        />
        <span className={isZero ? "text-signal-red" : "text-risk-moderate"}>
          {isZero
            ? "You've used all your analyses this month."
            : `You have ${balance} ${balance === 1 ? "analysis" : "analyses"} remaining.`}
        </span>
      </div>
      <div className="flex items-center gap-3">
        <Link
          href="/pricing"
          className={cn(
            "flex items-center gap-1 text-xs font-medium",
            isZero ? "text-signal-red hover:text-signal-red/80" : "text-risk-moderate hover:text-risk-moderate/80"
          )}
        >
          Upgrade Plan
          <ArrowRight size={12} />
        </Link>
        {!isZero && (
          <button
            onClick={dismiss}
            className="text-ash hover:text-bone transition-colors"
          >
            <X size={14} />
          </button>
        )}
      </div>
    </div>
  );
}
