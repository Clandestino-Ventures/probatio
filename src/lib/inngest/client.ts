/**
 * PROBATIO — Inngest Client
 *
 * Shared Inngest client instance used by all event-driven functions.
 * Import this from function definitions and from the API route that
 * serves the Inngest endpoint.
 */

import { Inngest } from "inngest";

// ────────────────────────────────────────────────────────────────────────────
// Event Types
// ────────────────────────────────────────────────────────────────────────────

/**
 * Strongly-typed event map for all PROBATIO Inngest events.
 *
 * Adding a new event? Define it here so that `inngest.send()` and
 * function triggers are type-checked at compile time.
 */
type ProbatioEvents = {
  "analysis/requested": {
    data: {
      analysisId: string;
      userId: string;
      fileUrl: string;
      fileHashSha256: string;
      mode: "screening" | "forensic";
    };
  };
  "forensic-analysis/requested": {
    data: {
      forensicCaseId: string;
      analysisId: string;
      userId: string;
      trackAUrl: string;
      trackAHashSha256: string;
      trackBUrl: string;
      trackBHashSha256: string;
      paymentIntentId: string;
      tier: "standard" | "expert";
    };
  };
  "clearance/requested": {
    data: {
      analysisId: string;
      userId: string;
      fileUrl: string;
      fileHashSha256: string;
      catalogIds: string[];
      organizationId: string | null;
      batchId?: string | null;
    };
  };
  "catalog/ingest": {
    data: {
      catalog_id: string;
      organization_id: string;
    };
  };
  "catalog-track/process": {
    data: {
      reference_track_id: string;
      audio_url: string;
      catalog_id: string;
      organization_id: string;
      pipeline_version_id: string;
    };
  };
  "catalog-track/completed": {
    data: {
      catalog_id: string;
      reference_track_id: string;
      success: boolean;
    };
  };
  "clearance-batch/process": {
    data: {
      batch_id: string;
      analysis_ids: string[];
      catalog_ids: string[];
      user_id: string;
    };
  };
  "clearance/completed": {
    data: {
      analysis_id: string;
      batch_id: string | null;
      clearance_status: string;
      overall_score: number;
    };
  };
  "analysis/reproduce": {
    data: {
      original_analysis_id: string;
      reproduction_id: string;
      user_id: string;
    };
  };
};

// ────────────────────────────────────────────────────────────────────────────
// Client Instance
// ────────────────────────────────────────────────────────────────────────────

/**
 * The shared Inngest client for PROBATIO.
 *
 * - `id` is the app identifier visible in the Inngest dashboard.
 * - Events are strongly typed via the generic parameter.
 */
export const inngest = new Inngest({ id: "probatio" });

export type { ProbatioEvents };
