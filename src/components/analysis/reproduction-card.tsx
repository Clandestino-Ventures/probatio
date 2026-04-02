"use client";

import { useState, useCallback, useEffect } from "react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui";
import {
  RefreshCw,
  CheckCircle,
  XCircle,
  Loader2,
  AlertTriangle,
} from "lucide-react";
import type { ReproductionStepComparison } from "@/types/database";

interface ReproductionCardProps {
  analysisId: string;
  hasAudio: boolean;
  className?: string;
}

type ReproResult = {
  id: string;
  status: string;
  comparisons: ReproductionStepComparison[];
  total_steps: number | null;
  matching_steps: number | null;
  mismatched_steps: number | null;
  pipeline_version: string | null;
  completed_at: string | null;
  requested_at: string;
};

const STEP_LABELS: Record<string, string> = {
  normalize: "Audio Normalization",
  stem_separation: "Stem Separation",
  feature_extraction: "Feature Extraction",
  embedding_generation: "Embedding Generation",
  lyrics_extraction: "Lyrics Extraction",
  fingerprint: "Fingerprint",
  score_comparison: "Score Comparison",
};

export function ReproductionCard({
  analysisId,
  hasAudio,
  className,
}: ReproductionCardProps) {
  const [loading, setLoading] = useState(false);
  const [confirming, setConfirming] = useState(false);
  const [result, setResult] = useState<ReproResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [polling, setPolling] = useState(false);

  // Fetch existing results on mount
  useEffect(() => {
    fetch(`/api/analyses/${analysisId}/reproduce`)
      .then((r) => r.json())
      .then((data) => {
        const results = data.results as ReproResult[] | undefined;
        if (results && results.length > 0) {
          setResult(results[0]);
          if (
            results[0].status === "pending" ||
            results[0].status === "running"
          ) {
            setPolling(true);
          }
        }
      })
      .catch(() => {});
  }, [analysisId]);

  // Poll while running
  useEffect(() => {
    if (!polling || !result) return;
    const interval = setInterval(async () => {
      const r = await fetch(
        `/api/analyses/${analysisId}/reproduce/${result.id}`,
      );
      if (r.ok) {
        const data = await r.json();
        setResult(data);
        if (data.status !== "pending" && data.status !== "running") {
          setPolling(false);
        }
      }
    }, 5000);
    return () => clearInterval(interval);
  }, [polling, result, analysisId]);

  const startReproduction = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const r = await fetch(`/api/analyses/${analysisId}/reproduce`, {
        method: "POST",
      });
      if (!r.ok) {
        const data = await r.json();
        setError(data.error ?? "Failed to start reproduction");
        return;
      }
      const data = await r.json();
      setResult({
        id: data.reproduction_id,
        status: "running",
        comparisons: [],
        total_steps: null,
        matching_steps: null,
        mismatched_steps: null,
        pipeline_version: null,
        completed_at: null,
        requested_at: new Date().toISOString(),
      });
      setPolling(true);
      setConfirming(false);
    } finally {
      setLoading(false);
    }
  }, [analysisId]);

  const isRunning =
    result?.status === "pending" || result?.status === "running";
  const isMatch = result?.status === "match";
  const isMismatch = result?.status === "mismatch";

  return (
    <div
      className={cn(
        "bg-carbon border border-slate rounded-lg overflow-hidden",
        className,
      )}
    >
      <div className="px-5 py-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <RefreshCw size={16} className="text-forensic-blue" />
            <h4 className="text-sm font-medium text-bone">
              Reproducibility Verification
            </h4>
          </div>

          {!result && !confirming && (
            <Button
              variant="outline"
              size="sm"
              onClick={() => setConfirming(true)}
              disabled={!hasAudio}
              title={
                hasAudio
                  ? "Re-run analysis to verify reproducibility"
                  : "Original audio unavailable"
              }
            >
              <RefreshCw size={14} />
              Reproduce
            </Button>
          )}
        </div>

        {/* Confirmation dialog */}
        {confirming && !result && (
          <div className="mt-4 p-3 bg-graphite rounded-lg">
            <p className="text-xs text-ash mb-3">
              This will re-run the complete analysis pipeline to verify
              reproducibility. Typically takes 2-3 minutes.
            </p>
            <div className="flex gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => setConfirming(false)}
              >
                Cancel
              </Button>
              <Button
                size="sm"
                onClick={startReproduction}
                disabled={loading}
              >
                {loading && (
                  <Loader2 size={14} className="animate-spin" />
                )}
                Proceed
              </Button>
            </div>
          </div>
        )}

        {error && (
          <p className="mt-3 text-xs text-signal-red">{error}</p>
        )}

        {/* Running state */}
        {isRunning && (
          <div className="mt-4 flex items-center gap-2 text-sm text-forensic-blue">
            <Loader2 size={14} className="animate-spin" />
            <span>Reproducing... comparing step-by-step</span>
          </div>
        )}

        {/* Result: Match */}
        {isMatch && result && (
          <div className="mt-4">
            <div className="flex items-center gap-2 mb-3">
              <CheckCircle size={18} className="text-risk-low" />
              <span className="text-sm font-medium text-risk-low">
                REPRODUCIBLE — All {result.total_steps} steps match
              </span>
            </div>
            <ComparisonTable comparisons={result.comparisons} />
            {result.completed_at && (
              <p className="text-[10px] text-ash mt-2">
                Reproduced:{" "}
                {new Date(result.completed_at).toLocaleString()}
                {result.pipeline_version &&
                  ` · Pipeline v${result.pipeline_version}`}
              </p>
            )}
          </div>
        )}

        {/* Result: Mismatch */}
        {isMismatch && result && (
          <div className="mt-4">
            <div className="flex items-center gap-2 mb-3">
              <AlertTriangle size={18} className="text-evidence-gold" />
              <span className="text-sm font-medium text-evidence-gold">
                {result.matching_steps}/{result.total_steps} steps match
                — {result.mismatched_steps} discrepancy(ies)
              </span>
            </div>
            <ComparisonTable comparisons={result.comparisons} />
            <p className="text-[10px] text-ash mt-2">
              GPU floating-point variations (&lt;0.00001) are expected
              and do not affect conclusions.
            </p>
          </div>
        )}

        {/* Result: Failed */}
        {result?.status === "failed" && (
          <div className="mt-4 flex items-center gap-2">
            <XCircle size={18} className="text-signal-red" />
            <span className="text-sm text-signal-red">
              Reproduction failed
            </span>
          </div>
        )}
      </div>
    </div>
  );
}

function ComparisonTable({
  comparisons,
}: {
  comparisons: ReproductionStepComparison[];
}) {
  if (comparisons.length === 0) return null;

  return (
    <div className="overflow-x-auto">
      <table className="w-full text-xs">
        <thead>
          <tr className="border-b border-slate/50 text-ash">
            <th className="px-2 py-1.5 text-left font-medium">Step</th>
            <th className="px-2 py-1.5 text-left font-medium">
              Original
            </th>
            <th className="px-2 py-1.5 text-left font-medium">
              Reproduced
            </th>
            <th className="px-2 py-1.5 text-center font-medium w-12">
              Match
            </th>
          </tr>
        </thead>
        <tbody>
          {comparisons.map((c, i) => (
            <tr
              key={i}
              className="border-b border-slate/20 hover:bg-graphite/30"
            >
              <td className="px-2 py-1.5 text-bone">
                {STEP_LABELS[c.step] ?? c.step}
              </td>
              <td className="px-2 py-1.5 font-mono text-ash">
                {c.original_hash}...
              </td>
              <td className="px-2 py-1.5 font-mono text-ash">
                {c.reproduced_hash}...
              </td>
              <td className="px-2 py-1.5 text-center">
                {c.match ? (
                  <span
                    className={
                      c.approximate
                        ? "text-evidence-gold"
                        : "text-risk-low"
                    }
                    title={c.tolerance ?? ""}
                  >
                    {c.approximate ? "\u2248*" : "\u2713"}
                  </span>
                ) : (
                  <span className="text-signal-red">\u2717</span>
                )}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
      {comparisons.some((c) => c.approximate) && (
        <p className="text-[10px] text-ash mt-1 px-2">
          * Approximate match: embedding values within 1e-5 tolerance.
          Expected GPU floating-point behavior.
        </p>
      )}
    </div>
  );
}
