"use client";

/**
 * PROBATIO — Real-Time Analysis Status Hook
 *
 * Subscribes to Supabase Realtime `postgres_changes` for a specific
 * analysis row. Provides live status, progress, risk level, and error
 * state to any component that needs to track an in-flight analysis.
 */

import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";

// AnalysisStatus from src/types/database.ts:
// "pending" | "uploading" | "normalizing" | "separating" | "extracting" | "matching" | "classifying" | "completed" | "failed"

interface AnalysisStatusState {
  status: string | null;
  currentStep: string | null;
  progressPct: number;
  overallRisk: string | null;
  errorMessage: string | null;
  isCompleted: boolean;
  isFailed: boolean;
  isProcessing: boolean;
}

const INITIAL_STATE: AnalysisStatusState = {
  status: null,
  currentStep: null,
  progressPct: 0,
  overallRisk: null,
  errorMessage: null,
  isCompleted: false,
  isFailed: false,
  isProcessing: false,
};

/** Terminal and idle statuses that are NOT actively processing. */
const NON_PROCESSING_STATUSES = ["completed", "failed", "pending"];

function deriveState(row: Record<string, unknown>): AnalysisStatusState {
  const status = row.status as string;
  return {
    status,
    currentStep: (row.current_step as string | null) ?? null,
    progressPct: (row.progress_pct as number) ?? 0,
    overallRisk: (row.overall_risk as string | null) ?? null,
    errorMessage: (row.error_message as string | null) ?? null,
    isCompleted: status === "completed",
    isFailed: status === "failed",
    isProcessing: !NON_PROCESSING_STATUSES.includes(status),
  };
}

/**
 * Subscribe to real-time status updates for an analysis.
 *
 * Performs an initial fetch of the current row, then opens a Supabase
 * Realtime channel filtered to `UPDATE` events on the given `analysisId`.
 * The channel is cleaned up automatically when `analysisId` changes or
 * the component unmounts.
 *
 * @param analysisId  UUID of the analysis to watch, or `null` to disable.
 * @returns           Live status state derived from the `analyses` row.
 */
export function useAnalysisStatus(analysisId: string | null): AnalysisStatusState {
  const [state, setState] = useState<AnalysisStatusState>(INITIAL_STATE);

  useEffect(() => {
    if (!analysisId) {
      setState(INITIAL_STATE);
      return;
    }

    const supabase = createClient();

    // ── Initial fetch ────────────────────────────────────────────────────
    supabase
      .from("analyses")
      .select("status, current_step, progress_pct, overall_risk, error_message")
      .eq("id", analysisId)
      .single()
      .then(({ data }) => {
        if (data) {
          setState(deriveState(data as Record<string, unknown>));
        }
      });

    // ── Realtime subscription ────────────────────────────────────────────
    const channel = supabase
      .channel(`analysis-${analysisId}`)
      .on(
        "postgres_changes",
        {
          event: "UPDATE",
          schema: "public",
          table: "analyses",
          filter: `id=eq.${analysisId}`,
        },
        (payload) => {
          const row = payload.new as Record<string, unknown>;
          setState(deriveState(row));
        },
      )
      .subscribe();

    // ── Cleanup ──────────────────────────────────────────────────────────
    return () => {
      supabase.removeChannel(channel);
    };
  }, [analysisId]);

  return state;
}
