"use client";

import { useState } from "react";
import { cn } from "@/lib/utils";
import { ChevronDown, Shield, CheckCircle, AlertTriangle, Copy, Check } from "lucide-react";
import { toast } from "sonner";

interface CustodyEntry {
  sequence_num: number;
  action: string;
  entry_hash: string;
  artifact_hash: string | null;
  recorded_at: string;
  detail?: Record<string, string | number | boolean | null>;
}

interface ChainOfCustodyDisplayProps {
  entries: CustodyEntry[];
  isValid?: boolean;
  fileHash?: string;
  finalHash?: string | null;
  pipelineVersion?: string;
  className?: string;
}

// Human-readable action labels
const ACTION_LABELS: Record<string, string> = {
  file_uploaded: "File Uploaded",
  hash_computed: "Hash Verified",
  pipeline_started: "Pipeline Started",
  "step_started:normalize": "Normalizing",
  "step_completed:normalize": "Normalized",
  "step_started:fingerprint": "Fingerprinting",
  "step_completed:fingerprint": "Fingerprinted",
  stems_generated: "Stems Generated",
  features_extracted: "Features Extracted",
  embeddings_generated: "Embeddings Generated",
  "step_completed:match": "Matches Found",
  "step_completed:compare": "Comparison Complete",
  comparison_completed: "Comparison Complete",
  "step_completed:enrich": "Rights Enriched",
  "step_completed:report": "Report Generated",
  report_generated: "Report Generated",
  "step_completed:finalize": "Finalized",
  report_exported: "Report Exported",
  evidence_packaged: "Evidence Packaged",
  step_failed: "Step Failed",
  pipeline_failed: "Pipeline Failed",
};

function CopyButton({ text }: { text: string }) {
  const [copied, setCopied] = useState(false);

  async function copy() {
    await navigator.clipboard.writeText(text);
    setCopied(true);
    toast.success("Copied to clipboard");
    setTimeout(() => setCopied(false), 2000);
  }

  return (
    <button onClick={copy} className="text-ash hover:text-bone transition-colors ml-1">
      {copied ? <Check size={10} /> : <Copy size={10} />}
    </button>
  );
}

function truncHash(hash: string | null, len: number = 12): string {
  if (!hash) return "—";
  return hash.length > len ? `${hash.slice(0, len)}...` : hash;
}

function timeBetween(a: string, b: string): string {
  const diff = new Date(b).getTime() - new Date(a).getTime();
  if (diff < 1000) return "<1s";
  if (diff < 60000) return `${Math.round(diff / 1000)}s`;
  return `${Math.round(diff / 60000)}m`;
}

export function ChainOfCustodyDisplay({
  entries,
  isValid = true,
  fileHash,
  finalHash,
  pipelineVersion,
  className,
}: ChainOfCustodyDisplayProps) {
  const [expanded, setExpanded] = useState(false);

  return (
    <div className={cn("bg-carbon border border-slate rounded-lg", className)}>
      {/* Header */}
      <button
        onClick={() => setExpanded(!expanded)}
        className="w-full flex items-center justify-between p-4 hover:bg-graphite/30 transition-colors"
      >
        <div className="flex items-center gap-3">
          <Shield size={16} className="text-evidence-gold" />
          <span className="text-sm font-medium text-bone">Chain of Custody</span>
          <span className="text-xs text-ash">{entries.length} entries</span>
          {isValid ? (
            <span className="inline-flex items-center gap-1 px-2 py-0.5 bg-risk-low/10 text-risk-low text-xs rounded-full">
              <CheckCircle size={10} />
              Verified
            </span>
          ) : (
            <span className="inline-flex items-center gap-1 px-2 py-0.5 bg-signal-red/10 text-signal-red text-xs rounded-full">
              <AlertTriangle size={10} />
              Chain Broken
            </span>
          )}
        </div>
        <ChevronDown
          size={16}
          className={cn("text-ash transition-transform", expanded && "rotate-180")}
        />
      </button>

      {expanded && (
        <div className="border-t border-slate p-4">
          {/* Hash summary */}
          {(fileHash || finalHash || pipelineVersion) && (
            <div className="mb-4 space-y-1.5">
              {fileHash && (
                <div className="flex items-center gap-2 text-xs">
                  <span className="text-ash w-32 shrink-0">File Hash (SHA-256):</span>
                  <span className="font-mono text-forensic-blue truncate">{truncHash(fileHash, 16)}</span>
                  <CopyButton text={fileHash} />
                </div>
              )}
              {finalHash && (
                <div className="flex items-center gap-2 text-xs">
                  <span className="text-ash w-32 shrink-0">Final Hash:</span>
                  <span className="font-mono text-evidence-gold truncate">{truncHash(finalHash, 16)}</span>
                  <CopyButton text={finalHash} />
                </div>
              )}
              {pipelineVersion && (
                <div className="flex items-center gap-2 text-xs">
                  <span className="text-ash w-32 shrink-0">Pipeline:</span>
                  <span className="text-bone">{pipelineVersion}</span>
                </div>
              )}
            </div>
          )}

          {/* Vertical timeline */}
          <div className="relative pl-6">
            {/* Vertical line */}
            <div className="absolute left-2.25 top-2 bottom-2 w-px bg-slate" />

            {entries.map((entry, i) => {
              const isFailed = entry.action.includes("failed");
              const isLast = i === entries.length - 1;
              const label = ACTION_LABELS[entry.action] ?? entry.action;
              const stepName = entry.detail?.step_name as string | undefined;
              const timing = i > 0 ? timeBetween(entries[i - 1].recorded_at, entry.recorded_at) : null;

              return (
                <div key={entry.sequence_num} className="relative mb-4 last:mb-0">
                  {/* Node */}
                  <div
                    className={cn(
                      "absolute -left-6 top-0.5 w-4.5 h-4.5 rounded-full border-2 flex items-center justify-center",
                      isFailed
                        ? "border-signal-red bg-signal-red/20"
                        : isLast
                          ? "border-evidence-gold bg-evidence-gold/20"
                          : "border-slate bg-carbon"
                    )}
                  >
                    {isLast && !isFailed && (
                      <div className="w-2 h-2 rounded-full bg-evidence-gold" />
                    )}
                    {isFailed && (
                      <div className="w-2 h-2 rounded-full bg-signal-red" />
                    )}
                  </div>

                  {/* Content */}
                  <div className="ml-2">
                    <div className="flex items-center gap-2">
                      <span className={cn("text-xs font-medium", isFailed ? "text-signal-red" : "text-bone")}>
                        {label}
                      </span>
                      {timing && (
                        <span className="text-[10px] text-ash">+{timing}</span>
                      )}
                    </div>
                    <div className="text-[10px] text-ash mt-0.5">
                      {new Date(entry.recorded_at).toLocaleString()}
                    </div>
                    {/* Detail excerpts */}
                    {stepName && (
                      <div className="text-[10px] text-ash mt-0.5">
                        Step: {stepName}
                      </div>
                    )}
                    {entry.artifact_hash && (
                      <div className="flex items-center gap-1 text-[10px] mt-0.5">
                        <span className="text-ash">Hash:</span>
                        <span className="font-mono text-forensic-blue">{truncHash(entry.artifact_hash, 10)}</span>
                        <CopyButton text={entry.artifact_hash} />
                      </div>
                    )}
                    {entry.detail?.segments_created && (
                      <div className="text-[10px] text-ash mt-0.5">
                        {entry.detail.segments_created as number} segments created
                      </div>
                    )}
                    {entry.detail?.matches_stored != null && (
                      <div className="text-[10px] text-ash mt-0.5">
                        {entry.detail.matches_stored as number} matches found
                      </div>
                    )}
                    {entry.detail?.processing_time_ms && (
                      <div className="text-[10px] text-ash mt-0.5">
                        {Math.round((entry.detail.processing_time_ms as number) / 1000)}s processing
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
