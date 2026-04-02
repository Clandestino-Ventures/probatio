// @ts-nocheck — Supabase query types will be auto-generated via `supabase gen types`
/**
 * PROBATIO — Analysis Store (Zustand)
 *
 * Manages the current analysis state, match results, and real-time
 * pipeline status tracking. Uses the Supabase browser client and
 * Supabase Realtime for live updates.
 *
 * This store is intended for Client Components only.
 */

import { create } from "zustand";
import { createClient } from "@/lib/supabase/client";
import type {
  AnalysisRow,
  AnalysisMatchRow,
  AnalysisStatus,
} from "@/types/database";
import type { PipelineStep } from "@/types/analysis";
import type { AnalysisListItem } from "@/types/api";
import { PIPELINE_STEPS, type PipelineStepName } from "@/lib/constants";

// ────────────────────────────────────────────────────────────────────────────
// Pipeline Status
// ────────────────────────────────────────────────────────────────────────────

export interface PipelineStatus {
  /** Current step name being executed. */
  currentStep: PipelineStepName | null;
  /** Index of the current step within PIPELINE_STEPS. */
  currentStepIndex: number;
  /** Total number of pipeline steps. */
  totalSteps: number;
  /** Progress percentage (0 - 100). */
  progress: number;
  /** Individual step statuses. */
  steps: PipelineStep[];
  /** Whether the pipeline has completed (success or failure). */
  isComplete: boolean;
  /** Whether the pipeline failed. */
  isFailed: boolean;
  /** Estimated remaining time in seconds, or null if unknown. */
  estimatedRemainingSeconds: number | null;
}

// ────────────────────────────────────────────────────────────────────────────
// State & Actions
// ────────────────────────────────────────────────────────────────────────────

export interface AnalysisState {
  /** The current analysis being viewed/tracked. */
  analysis: AnalysisRow | null;
  /** Matches for the current analysis. */
  matches: AnalysisMatchRow[];
  /** Pipeline progress tracking for the current analysis. */
  pipelineStatus: PipelineStatus | null;
  /** Paginated list of user analyses for the dashboard. */
  analysisList: AnalysisListItem[];
  /** Total count of analyses for pagination. */
  totalCount: number;
  /** Whether a data fetch is in progress. */
  loading: boolean;
  /** Whether a list fetch is in progress. */
  listLoading: boolean;
  /** The most recent error message, or null. */
  error: string | null;
  /** ID of the Realtime subscription channel, or null. */
  realtimeChannelId: string | null;
}

export interface AnalysisActions {
  /**
   * Fetch a single analysis by ID along with its matches.
   *
   * @param analysisId  The UUID of the analysis.
   */
  fetchAnalysis: (analysisId: string) => Promise<void>;

  /**
   * Fetch matches for a given analysis.
   *
   * @param analysisId  The UUID of the analysis.
   */
  fetchMatches: (analysisId: string) => Promise<void>;

  /**
   * Fetch a paginated list of analyses for the current user.
   *
   * @param page      Page number (1-based).
   * @param perPage   Number of items per page.
   * @param status    Optional status filter.
   */
  fetchAnalysisList: (
    page?: number,
    perPage?: number,
    status?: AnalysisStatus,
  ) => Promise<void>;

  /**
   * Subscribe to real-time updates for a specific analysis.
   * Tracks pipeline status changes and auto-refreshes matches on completion.
   *
   * @param analysisId  The UUID of the analysis to subscribe to.
   */
  subscribeToAnalysis: (analysisId: string) => void;

  /**
   * Unsubscribe from real-time updates.
   */
  unsubscribeFromAnalysis: () => void;

  /**
   * Manually update the pipeline status (e.g. from an SSE or polling fallback).
   *
   * @param status  The analysis status string.
   */
  updatePipelineStatus: (status: AnalysisStatus) => void;

  /**
   * Clear the current analysis and all related state.
   */
  clearAnalysis: () => void;

  /**
   * Clear any stored error.
   */
  clearError: () => void;
}

export type AnalysisStore = AnalysisState & AnalysisActions;

// ────────────────────────────────────────────────────────────────────────────
// Helpers
// ────────────────────────────────────────────────────────────────────────────

function buildPipelineStatus(status: AnalysisStatus): PipelineStatus {
  const statusToStepMap: Record<string, PipelineStepName> = {
    uploading: "upload",
    normalizing: "normalize",
    separating: "separate",
    extracting: "extract",
    matching: "match",
    classifying: "classify",
  };

  const currentStep = statusToStepMap[status] ?? null;
  const currentStepIndex = currentStep
    ? PIPELINE_STEPS.indexOf(currentStep)
    : -1;
  const totalSteps = PIPELINE_STEPS.length;

  const isComplete = status === "completed" || status === "failed";
  const isFailed = status === "failed";

  const progress = isComplete
    ? 100
    : currentStepIndex >= 0
      ? Math.round(((currentStepIndex + 0.5) / totalSteps) * 100)
      : 0;

  const steps: PipelineStep[] = PIPELINE_STEPS.map((name, index) => {
    let stepStatus: AnalysisStatus;
    if (isComplete && !isFailed) {
      stepStatus = "completed";
    } else if (isFailed && index >= currentStepIndex) {
      stepStatus = index === currentStepIndex ? "failed" : "pending";
    } else if (index < currentStepIndex) {
      stepStatus = "completed";
    } else if (index === currentStepIndex) {
      stepStatus = status;
    } else {
      stepStatus = "pending";
    }

    return {
      name,
      status: stepStatus,
      startedAt: null,
      completedAt: null,
      durationMs: null,
      error: null,
      metadata: null,
    };
  });

  // Rough estimate: ~30s per remaining step for standard analysis.
  const remainingSteps = isComplete
    ? 0
    : Math.max(0, totalSteps - currentStepIndex - 1);
  const estimatedRemainingSeconds =
    remainingSteps > 0 ? remainingSteps * 30 : null;

  return {
    currentStep,
    currentStepIndex,
    totalSteps,
    progress,
    steps,
    isComplete,
    isFailed,
    estimatedRemainingSeconds,
  };
}

// ────────────────────────────────────────────────────────────────────────────
// Store Implementation
// ────────────────────────────────────────────────────────────────────────────

const initialState: AnalysisState = {
  analysis: null,
  matches: [],
  pipelineStatus: null,
  analysisList: [],
  totalCount: 0,
  loading: false,
  listLoading: false,
  error: null,
  realtimeChannelId: null,
};

export const useAnalysisStore = create<AnalysisStore>()((set, get) => {
  const supabase = createClient();

  return {
    ...initialState,

    // ── Fetch Analysis ──────────────────────────────────────────────────
    fetchAnalysis: async (analysisId) => {
      set({ loading: true, error: null });

      const { data, error } = await supabase
        .from("analyses")
        .select("*")
        .eq("id", analysisId)
        .single();

      if (error) {
        set({ error: error.message, loading: false });
        return;
      }

      const analysis = data as AnalysisRow;
      const pipelineStatus = buildPipelineStatus(analysis.status);

      set({ analysis, pipelineStatus, loading: false });

      // Also fetch matches.
      await get().fetchMatches(analysisId);
    },

    // ── Fetch Matches ───────────────────────────────────────────────────
    fetchMatches: async (analysisId) => {
      const { data, error } = await supabase
        .from("analysis_matches")
        .select("*")
        .eq("analysis_id", analysisId)
        .order("overall_similarity", { ascending: false });

      if (error) {
        set({ error: error.message });
        return;
      }

      set({ matches: (data as AnalysisMatchRow[]) ?? [] });
    },

    // ── Fetch Analysis List ─────────────────────────────────────────────
    fetchAnalysisList: async (page = 1, perPage = 20, status) => {
      set({ listLoading: true, error: null });

      let query = supabase
        .from("analyses")
        .select("id, file_name, mode, status, overall_risk, created_at, updated_at", {
          count: "exact",
        })
        .order("created_at", { ascending: false })
        .range((page - 1) * perPage, page * perPage - 1);

      if (status) {
        query = query.eq("status", status);
      }

      const { data, error, count } = await query;

      if (error) {
        set({ error: error.message, listLoading: false });
        return;
      }

      // Map database rows to API list items.
      const analysisList: AnalysisListItem[] = (data ?? []).map((row) => ({
        id: row.id,
        title: row.file_name,
        mode: row.mode,
        status: row.status,
        overallRisk: row.overall_risk,
        matchCount: 0,
        createdAt: row.created_at,
        completedAt: row.updated_at,
      }));

      set({
        analysisList,
        totalCount: count ?? 0,
        listLoading: false,
      });
    },

    // ── Subscribe to Real-time Updates ──────────────────────────────────
    subscribeToAnalysis: (analysisId) => {
      // Unsubscribe from any existing subscription.
      get().unsubscribeFromAnalysis();

      const channelId = `analysis-${analysisId}`;

      const channel = supabase
        .channel(channelId)
        .on(
          "postgres_changes",
          {
            event: "UPDATE",
            schema: "public",
            table: "analyses",
            filter: `id=eq.${analysisId}`,
          },
          (payload) => {
            const updated = payload.new as AnalysisRow;
            const pipelineStatus = buildPipelineStatus(updated.status);

            set({ analysis: updated, pipelineStatus });

            // Auto-refresh matches when the analysis completes.
            if (updated.status === "completed") {
              get().fetchMatches(analysisId);
            }
          },
        )
        .subscribe();

      set({ realtimeChannelId: channelId });

      // Store channel reference for cleanup (using a closure).
      (get() as { _channel?: typeof channel })._channel = channel;
    },

    // ── Unsubscribe ─────────────────────────────────────────────────────
    unsubscribeFromAnalysis: () => {
      const state = get() as AnalysisStore & { _channel?: ReturnType<typeof supabase.channel> };
      if (state._channel) {
        supabase.removeChannel(state._channel);
        state._channel = undefined;
      }
      set({ realtimeChannelId: null });
    },

    // ── Update Pipeline Status ──────────────────────────────────────────
    updatePipelineStatus: (status) => {
      const pipelineStatus = buildPipelineStatus(status);
      set((state) => ({
        pipelineStatus,
        analysis: state.analysis
          ? { ...state.analysis, status }
          : null,
      }));
    },

    // ── Clear Analysis ──────────────────────────────────────────────────
    clearAnalysis: () => {
      get().unsubscribeFromAnalysis();
      set({
        analysis: null,
        matches: [],
        pipelineStatus: null,
        error: null,
      });
    },

    // ── Clear Error ─────────────────────────────────────────────────────
    clearError: () => {
      set({ error: null });
    },
  };
});
