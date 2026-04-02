"use client";

import { cn } from "@/lib/utils";
import { useAnalysisStatus } from "@/hooks/use-analysis-status";
import { Loader2 } from "lucide-react";
import Link from "next/link";

// Pipeline step labels
const STEP_LABELS: Record<string, string> = {
  pending: "Queued",
  uploading: "Uploading",
  normalizing: "Normalizing audio",
  separating: "Separating stems",
  extracting: "Extracting features",
  matching: "Searching matches",
  classifying: "Generating report",
};

interface ActiveAnalysisCardProps {
  analysis: {
    id: string;
    file_name?: string;
    title?: string;
    status: string;
    current_step: string | null;
    progress_pct: number;
    mode: string;
    created_at: string;
  };
  className?: string;
}

function timeAgo(dateStr: string): string {
  const diff = Date.now() - new Date(dateStr).getTime();
  const seconds = Math.floor(diff / 1000);
  if (seconds < 60) return `${seconds}s ago`;
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  return `${hours}h ago`;
}

export function ActiveAnalysisCard({ analysis, className }: ActiveAnalysisCardProps) {
  // Subscribe to realtime updates for this specific analysis
  const liveStatus = useAnalysisStatus(analysis.id);

  const status = liveStatus.status ?? analysis.status;
  const progress = liveStatus.progressPct ?? analysis.progress_pct ?? 0;
  const stepLabel = STEP_LABELS[status] ?? status;
  const fileName = analysis.file_name ?? analysis.title ?? "Untitled";

  // Progress bar color based on completion
  const barColor = progress >= 70 ? "bg-forensic-blue" : progress >= 30 ? "bg-forensic-blue/80" : "bg-slate";

  if (liveStatus.isCompleted || liveStatus.isFailed) {
    // Analysis finished — this card will be removed by the parent
    return null;
  }

  return (
    <Link href={`/dashboard/analyses/${analysis.id}`}>
      <div
        className={cn(
          "bg-carbon border border-slate rounded-lg p-4 hover:border-forensic-blue/30 transition-colors",
          className
        )}
      >
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2 min-w-0">
            <Loader2 size={14} className="text-forensic-blue animate-spin shrink-0" />
            <span className="text-sm font-medium text-bone truncate">{fileName}</span>
          </div>
          {analysis.mode === "forensic" && (
            <span className="text-[10px] px-1.5 py-0.5 bg-evidence-gold/10 text-evidence-gold rounded font-medium">
              Forensic
            </span>
          )}
        </div>

        <div className="mb-2">
          <div className="flex items-center justify-between mb-1">
            <span className="text-xs text-ash">{stepLabel}</span>
            <span className="text-xs font-mono text-ash">{progress}%</span>
          </div>
          <div className="h-1.5 bg-graphite rounded-full overflow-hidden">
            <div
              className={cn("h-full rounded-full transition-all duration-700 ease-out", barColor)}
              style={{ width: `${progress}%` }}
            />
          </div>
        </div>

        <span className="text-[10px] text-ash">{timeAgo(analysis.created_at)}</span>
      </div>
    </Link>
  );
}
