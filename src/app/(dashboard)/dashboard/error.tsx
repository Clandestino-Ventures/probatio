"use client";

import { useEffect } from "react";
import { Button } from "@/components/ui";
import { AlertTriangle, RefreshCw } from "lucide-react";

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
    <div className="flex-1 flex items-center justify-center bg-obsidian p-8">
      <div className="max-w-md text-center">
        <div className="w-14 h-14 rounded-full bg-signal-red/10 flex items-center justify-center mx-auto mb-4">
          <AlertTriangle size={28} className="text-signal-red" />
        </div>
        <h2 className="text-lg font-semibold text-bone mb-2">Something went wrong</h2>
        <p className="text-sm text-ash mb-6">
          An unexpected error occurred. If the issue persists, contact support.
        </p>
        <Button onClick={reset}>
          <RefreshCw size={14} />
          Try again
        </Button>
      </div>
    </div>
  );
}
