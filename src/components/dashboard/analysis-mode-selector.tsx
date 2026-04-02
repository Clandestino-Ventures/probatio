"use client";

/**
 * PROBATIO — Analysis Mode Selector
 *
 * Two prominent cards for choosing between standard analysis
 * and pre-release clearance on the dashboard.
 */

import { cn } from "@/lib/utils";
import { Search, ShieldCheck } from "lucide-react";

export type AnalysisModeSelection = "screening" | "clearance";

interface AnalysisModeSelectorProps {
  selected: AnalysisModeSelection;
  onSelect: (mode: AnalysisModeSelection) => void;
  className?: string;
}

export function AnalysisModeSelector({
  selected,
  onSelect,
  className,
}: AnalysisModeSelectorProps) {
  return (
    <div className={cn("grid grid-cols-1 sm:grid-cols-2 gap-3", className)}>
      {/* Standard Analysis */}
      <button
        type="button"
        onClick={() => onSelect("screening")}
        className={cn(
          "flex flex-col items-start gap-3 p-5 rounded-lg border-2 transition-all duration-200 text-left",
          selected === "screening"
            ? "border-forensic-blue bg-forensic-blue/5"
            : "border-slate hover:border-ash bg-carbon/50"
        )}
      >
        <div
          className={cn(
            "w-10 h-10 rounded-full flex items-center justify-center",
            selected === "screening"
              ? "bg-forensic-blue/15"
              : "bg-graphite"
          )}
        >
          <Search
            size={18}
            className={cn(
              selected === "screening" ? "text-forensic-blue" : "text-ash"
            )}
          />
        </div>
        <div>
          <p className="text-sm font-medium text-bone">Compare Two Tracks</p>
          <p className="text-xs text-ash mt-1">
            Upload a track and compare against another. Standard similarity
            analysis with 4-dimension scoring.
          </p>
        </div>
        <span className="text-xs font-mono text-ash/60">1 credit</span>
      </button>

      {/* Pre-Release Clearance */}
      <button
        type="button"
        onClick={() => onSelect("clearance")}
        className={cn(
          "flex flex-col items-start gap-3 p-5 rounded-lg border-2 transition-all duration-200 text-left relative overflow-hidden",
          selected === "clearance"
            ? "border-evidence-gold bg-evidence-gold/5"
            : "border-slate hover:border-ash bg-carbon/50"
        )}
      >
        <div
          className={cn(
            "w-10 h-10 rounded-full flex items-center justify-center",
            selected === "clearance"
              ? "bg-evidence-gold/15"
              : "bg-graphite"
          )}
        >
          <ShieldCheck
            size={18}
            className={cn(
              selected === "clearance" ? "text-evidence-gold" : "text-ash"
            )}
          />
        </div>
        <div>
          <p className="text-sm font-medium text-bone">
            Pre-Release Clearance
          </p>
          <p className="text-xs text-ash mt-1">
            Scan your track against entire catalogs before release. Find
            potential conflicts automatically.
          </p>
        </div>
        <span className="text-xs font-mono text-ash/60">2 credits</span>
      </button>
    </div>
  );
}
