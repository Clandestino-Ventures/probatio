// @ts-nocheck — Supabase query types will be auto-generated via `supabase gen types`
/**
 * PROBATIO — Clearance Batch Completion Tracker (Inngest Function)
 *
 * Triggered when an individual clearance analysis completes.
 * Updates batch counters and determines overall batch verdict
 * when all tracks are done.
 *
 * Verdict logic:
 * - ANY blocked → batch = blocked
 * - ANY conditional (no blocked) → batch = conditional
 * - ALL cleared → batch = cleared
 *
 * Triggered by: 'clearance/completed'
 */

import { inngest } from "@/lib/inngest/client";
import { createAdminClient } from "@/lib/supabase/admin";

export const clearanceBatchCompletion = inngest.createFunction(
  {
    id: "clearance-batch-completion",
    name: "Clearance Batch Completion",
    retries: 3,
  },
  { event: "clearance/completed" },
  async ({ event, step }) => {
    const { analysis_id, batch_id, clearance_status, overall_score } =
      event.data;

    // Skip if not part of a batch
    if (!batch_id) {
      return { skipped: true, reason: "no_batch_id" };
    }

    const supabase = createAdminClient();

    // ── Step 1: Update batch counters ─────────────────────────────────
    const result = await step.run("update-counters", async () => {
      const { data: batch } = await supabase
        .from("clearance_batches")
        .select("*")
        .eq("id", batch_id)
        .single();

      if (!batch) return { done: false };

      const newCompleted = (batch.tracks_completed ?? 0) + 1;
      const newCleared =
        (batch.tracks_cleared ?? 0) +
        (clearance_status === "cleared" ? 1 : 0);
      const newConditional =
        (batch.tracks_conditional ?? 0) +
        (clearance_status === "conditional" ? 1 : 0);
      const newBlocked =
        (batch.tracks_blocked ?? 0) +
        (clearance_status === "blocked" ? 1 : 0);

      const isDone = newCompleted >= batch.track_count;

      // Compute overall verdict
      let overallVerdict: string | null = null;
      if (isDone) {
        if (newBlocked > 0) overallVerdict = "blocked";
        else if (newConditional > 0) overallVerdict = "conditional";
        else overallVerdict = "cleared";
      }

      await supabase
        .from("clearance_batches")
        .update({
          tracks_completed: newCompleted,
          tracks_cleared: newCleared,
          tracks_conditional: newConditional,
          tracks_blocked: newBlocked,
          overall_verdict: overallVerdict,
          status: isDone ? "completed" : "processing",
          updated_at: new Date().toISOString(),
        })
        .eq("id", batch_id);

      return {
        done: isDone,
        completed: newCompleted,
        total: batch.track_count,
        verdict: overallVerdict,
      };
    });

    return {
      batch_id,
      analysis_id,
      done: result.done,
      verdict: result.verdict,
    };
  },
);
