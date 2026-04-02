"use client";

import { useState } from "react";
import { cn } from "@/lib/utils";
import { ChainOfCustodyDisplay } from "@/components/analysis/chain-of-custody-display";
import { Shield, CheckCircle, AlertTriangle } from "lucide-react";

interface CustodyEntry {
  sequence_num: number;
  action: string;
  entry_hash: string;
  artifact_hash: string | null;
  recorded_at: string;
  detail?: Record<string, string | number | boolean | null>;
}

interface ChainData {
  label: string;
  entries: CustodyEntry[];
  isValid: boolean;
  entityHash?: string;
}

interface TripleCustodyDisplayProps {
  caseChain: ChainData;
  trackAChain: ChainData;
  trackBChain: ChainData;
  className?: string;
}

export function TripleCustodyDisplay({
  caseChain,
  trackAChain,
  trackBChain,
  className,
}: TripleCustodyDisplayProps) {
  const [activeTab, setActiveTab] = useState<"case" | "trackA" | "trackB">("case");

  const chains = [
    { key: "case" as const, data: caseChain },
    { key: "trackA" as const, data: trackAChain },
    { key: "trackB" as const, data: trackBChain },
  ];

  const allValid = caseChain.isValid && trackAChain.isValid && trackBChain.isValid;

  return (
    <div className={cn("bg-carbon border border-slate rounded-lg", className)}>
      {/* Summary header */}
      <div className="p-4 border-b border-slate">
        <div className="flex items-center gap-3 mb-3">
          <Shield size={16} className="text-evidence-gold" />
          <span className="text-sm font-medium text-bone">Chain of Custody</span>
          {allValid ? (
            <span className="inline-flex items-center gap-1 px-2 py-0.5 bg-risk-low/10 text-risk-low text-xs rounded-full">
              <CheckCircle size={10} />
              All Chains Verified
            </span>
          ) : (
            <span className="inline-flex items-center gap-1 px-2 py-0.5 bg-signal-red/10 text-signal-red text-xs rounded-full">
              <AlertTriangle size={10} />
              Chain Integrity Issue
            </span>
          )}
        </div>

        {/* Chain summary */}
        <div className="grid grid-cols-3 gap-2">
          {chains.map(({ key, data }) => (
            <button
              key={key}
              onClick={() => setActiveTab(key)}
              className={cn(
                "p-2 rounded-md text-left transition-colors",
                activeTab === key
                  ? "bg-graphite border border-forensic-blue/30"
                  : "hover:bg-graphite/50"
              )}
            >
              <div className="text-xs font-medium text-bone">{data.label}</div>
              <div className="flex items-center gap-1.5 mt-1">
                <span className="text-[10px] text-ash">{data.entries.length} entries</span>
                {data.isValid ? (
                  <CheckCircle size={10} className="text-risk-low" />
                ) : (
                  <AlertTriangle size={10} className="text-signal-red" />
                )}
              </div>
            </button>
          ))}
        </div>
      </div>

      {/* Active chain detail */}
      <div className="p-4">
        {activeTab === "case" && (
          <ChainOfCustodyDisplay
            entries={caseChain.entries}
            isValid={caseChain.isValid}
            fileHash={caseChain.entityHash}
            pipelineVersion={undefined}
          />
        )}
        {activeTab === "trackA" && (
          <ChainOfCustodyDisplay
            entries={trackAChain.entries}
            isValid={trackAChain.isValid}
            fileHash={trackAChain.entityHash}
            pipelineVersion={undefined}
          />
        )}
        {activeTab === "trackB" && (
          <ChainOfCustodyDisplay
            entries={trackBChain.entries}
            isValid={trackBChain.isValid}
            fileHash={trackBChain.entityHash}
            pipelineVersion={undefined}
          />
        )}
      </div>
    </div>
  );
}
