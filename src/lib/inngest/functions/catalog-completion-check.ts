// @ts-nocheck — Supabase query types will be auto-generated via `supabase gen types`
/**
 * PROBATIO — Catalog Completion Check (Inngest Function)
 *
 * Triggered each time a catalog track finishes processing (success or failure).
 * Increments the catalog's progress counters and checks whether all tracks
 * are done. When the last track completes, marks the catalog as 'completed'.
 *
 * Triggered by: 'catalog-track/completed'
 */

import { inngest } from "@/lib/inngest/client";
import { createAdminClient } from "@/lib/supabase/admin";

export const catalogCompletionCheck = inngest.createFunction(
  {
    id: "catalog-completion-check",
    name: "Catalog Completion Check",
    retries: 3,
  },
  { event: "catalog-track/completed" },
  async ({ event, step }) => {
    const { catalog_id, reference_track_id, success } = event.data;
    const supabase = createAdminClient();

    // ── Step 1: Update progress counters ──────────────────────────────
    const result = await step.run("update-progress", async () => {
      // Fetch current progress
      const { data: catalog } = await supabase
        .from("enterprise_catalogs")
        .select("ingestion_progress, track_count")
        .eq("id", catalog_id)
        .single();

      if (!catalog) return { done: false };

      const progress = (catalog.ingestion_progress ?? {}) as {
        total?: number;
        processed?: number;
        failed?: number;
        started_at?: string;
      };

      const newProcessed = (progress.processed ?? 0) + (success ? 1 : 0);
      const newFailed = (progress.failed ?? 0) + (success ? 0 : 1);
      const total = progress.total ?? catalog.track_count ?? 0;

      await supabase
        .from("enterprise_catalogs")
        .update({
          ingestion_progress: {
            ...progress,
            processed: newProcessed,
            failed: newFailed,
            last_track_id: reference_track_id,
            last_updated: new Date().toISOString(),
          },
        })
        .eq("id", catalog_id);

      return {
        done: newProcessed + newFailed >= total,
        processed: newProcessed,
        failed: newFailed,
        total,
      };
    });

    // ── Step 2: Mark completed if all tracks done ─────────────────────
    if (result.done) {
      await step.run("mark-completed", async () => {
        const { data: catalog } = await supabase
          .from("enterprise_catalogs")
          .select("tracks_with_embeddings, estimated_cost_cents")
          .eq("id", catalog_id)
          .single();

        // Compute actual cost (15 cents per successfully processed track)
        const actualCostCents = (result.processed ?? 0) * 15;

        await supabase
          .from("enterprise_catalogs")
          .update({
            status: "completed",
            actual_cost_cents: actualCostCents,
            ingestion_progress: {
              total: result.total,
              processed: result.processed,
              failed: result.failed,
              completed_at: new Date().toISOString(),
            },
          })
          .eq("id", catalog_id);
      });
    }

    return {
      catalog_id,
      done: result.done,
      processed: result.processed,
      failed: result.failed,
    };
  },
);
