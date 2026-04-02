// @ts-nocheck — Supabase query types will be auto-generated via `supabase gen types`
/**
 * PROBATIO — Clearance Batch Orchestrator (Inngest Function)
 *
 * Orchestrates bulk pre-release clearance: emits individual clearance
 * events for each track in the batch. The existing process-clearance.ts
 * handles each track independently.
 *
 * Triggered by: 'clearance-batch/process'
 */

import { inngest } from "@/lib/inngest/client";
import { createAdminClient } from "@/lib/supabase/admin";

export const processClearanceBatch = inngest.createFunction(
  {
    id: "process-clearance-batch",
    name: "Process Clearance Batch",
    retries: 2,
  },
  { event: "clearance-batch/process" },
  async ({ event, step }) => {
    const { batch_id, analysis_ids, catalog_ids, user_id } = event.data;
    const supabase = createAdminClient();

    // ── Step 1: Update batch status ───────────────────────────────────
    await step.run("update-status", async () => {
      await supabase
        .from("clearance_batches")
        .update({
          status: "processing",
          updated_at: new Date().toISOString(),
        })
        .eq("id", batch_id);
    });

    // ── Step 2: Emit clearance events for each track ──────────────────
    // Batch the emissions to avoid overwhelming Inngest
    const BATCH_SIZE = 20;
    const totalBatches = Math.ceil(analysis_ids.length / BATCH_SIZE);

    for (let i = 0; i < totalBatches; i++) {
      await step.run(`emit-batch-${i}`, async () => {
        const batchIds = analysis_ids.slice(
          i * BATCH_SIZE,
          (i + 1) * BATCH_SIZE,
        );

        // Fetch analysis rows for this batch to get file URLs and hashes
        const { data: analyses } = await supabase
          .from("analyses")
          .select("id, audio_url, file_hash, user_id")
          .in("id", batchIds);

        if (!analyses || analyses.length === 0) return;

        const events = analyses
          .filter((a) => a.audio_url)
          .map((a) => ({
            name: "clearance/requested" as const,
            data: {
              analysisId: a.id,
              userId: a.user_id ?? user_id,
              fileUrl: a.audio_url!,
              fileHashSha256: a.file_hash ?? "",
              catalogIds: catalog_ids,
              organizationId: null,
              batchId: batch_id,
            },
          }));

        if (events.length > 0) {
          await inngest.send(events);
        }
      });
    }

    return {
      batch_id,
      tracks_queued: analysis_ids.length,
      status: "processing",
    };
  },
);
