"use client";

import { useEffect } from "react";
import Link from "next/link";

export default function DashboardError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error("[PROBATIO] Dashboard error:", error);
  }, [error]);

  return (
    <div className="flex-1 flex flex-col items-center justify-center p-8">
      <div className="max-w-md text-center">
        <h2 className="text-lg font-semibold text-bone mb-2">Dashboard Error</h2>
        <p className="text-sm text-ash mb-1">
          Your analyses and chain of custody are preserved.
        </p>
        <p className="text-xs text-ash/60 font-mono mb-6">
          {error.message || "An unexpected error occurred"}
        </p>
        <div className="flex items-center justify-center gap-3">
          <button
            onClick={reset}
            className="px-4 py-2 bg-forensic-blue text-bone rounded-md text-sm font-medium hover:bg-forensic-blue/90 transition-colors"
          >
            Try Again
          </button>
          <Link
            href="/dashboard"
            className="px-4 py-2 border border-slate text-ash rounded-md text-sm hover:text-bone transition-colors"
          >
            Back to Dashboard
          </Link>
        </div>
      </div>
    </div>
  );
}
