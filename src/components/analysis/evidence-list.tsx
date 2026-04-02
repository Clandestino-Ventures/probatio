"use client";

import { cn } from "@/lib/utils";
import { DIMENSION_COLORS } from "@/lib/config/risk-config";

interface EvidencePoint {
  dimension: string;
  similarity_score: number;
  source_start_sec: number;
  source_end_sec: number;
  target_start_sec: number;
  target_end_sec: number;
  description: string | null;
  detail: Record<string, unknown>;
}

interface EvidenceListProps {
  evidence: EvidencePoint[];
  maxItems?: number;
  className?: string;
}

function formatTime(sec: number): string {
  const m = Math.floor(sec / 60);
  const s = Math.floor(sec % 60);
  return `${m}:${s.toString().padStart(2, "0")}`;
}

export function EvidenceList({ evidence, maxItems = 8, className }: EvidenceListProps) {
  const sorted = [...evidence].sort((a, b) => b.similarity_score - a.similarity_score);
  const display = sorted.slice(0, maxItems);

  if (display.length === 0) {
    return (
      <p className="text-sm text-ash">No segment-level evidence available.</p>
    );
  }

  return (
    <div className={cn("space-y-2", className)}>
      {display.map((ev, i) => {
        const dimColor = DIMENSION_COLORS[ev.dimension] ?? "#8A8A8E";
        const transposition = ev.detail?.transposition_semitones as number | undefined;

        return (
          <div
            key={i}
            className="flex items-start gap-3 p-2.5 rounded-md bg-graphite/50"
          >
            <div
              className="w-1 h-full min-h-8 rounded-full shrink-0 mt-0.5"
              style={{ backgroundColor: dimColor }}
            />
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 mb-0.5">
                <span className="text-xs font-medium capitalize" style={{ color: dimColor }}>
                  {ev.dimension}
                </span>
                <span className="text-xs font-mono text-bone">
                  {Math.round(ev.similarity_score * 100)}%
                </span>
                {transposition != null && transposition !== 0 && (
                  <span className="text-xs font-mono text-evidence-gold">
                    {transposition > 0 ? "+" : ""}{transposition} st
                  </span>
                )}
              </div>
              <div className="text-xs text-ash">
                <span className="font-mono">
                  {formatTime(ev.source_start_sec)}-{formatTime(ev.source_end_sec)}
                </span>
                <span className="mx-1.5">→</span>
                <span className="font-mono">
                  {formatTime(ev.target_start_sec)}-{formatTime(ev.target_end_sec)}
                </span>
              </div>
              {ev.description && (
                <p className="text-xs text-ash/70 mt-1 line-clamp-2">
                  {ev.description}
                </p>
              )}
            </div>
          </div>
        );
      })}
      {evidence.length > maxItems && (
        <p className="text-xs text-ash">
          +{evidence.length - maxItems} more evidence points
        </p>
      )}
    </div>
  );
}
