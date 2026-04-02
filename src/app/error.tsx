"use client";

import { useEffect } from "react";
import Link from "next/link";

export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error("[PROBATIO] Application error:", error);
  }, [error]);

  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-obsidian text-bone px-4">
      <div className="max-w-md text-center">
        <h1 className="text-xl font-semibold mb-2">Something went wrong</h1>
        <p className="text-sm text-ash mb-2">
          Your data and analyses are preserved. Chain of custody integrity is maintained.
        </p>
        <p className="text-xs text-ash/60 font-mono mb-6">
          {error.message || "An unexpected error occurred"}
        </p>
        <div className="flex items-center justify-center gap-4">
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
        <p className="text-xs text-ash/40 mt-8">
          If this persists, contact support@probatio.audio
        </p>
      </div>
    </div>
  );
}
