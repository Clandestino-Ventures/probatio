// @ts-nocheck — Supabase query types will be auto-generated via `supabase gen types`
/**
 * PROBATIO — Catalog Batch Ingestion Orchestrator (Inngest Function)
 *
 * Orchestrates a full catalog ingestion. Receives the catalog ID,
 * queries all unprocessed tracks, and emits individual events for each.
 *
 * The individual track processing is handled by process-catalog-track.ts.
 * This function does NOT wait for completion — that's tracked by
 * catalog-completion-check.ts via the 'catalog-track/completed' event.
 *
 * Triggered by: 'catalog/ingest'
 */

import { inngest } from "@/lib/inngest/client";
import { createAdminClient } from "@/lib/supabase/admin";
import { PIPELINE_VERSION } from "@/lib/constants";

const EMIT_BATCH_SIZE = 100;

export const processCatalogBatch = inngest.createFunction(
  {
    id: "process-catalog-batch",
    name: "Process Catalog Batch",
    retries: 2,
  },
  { event: "catalog/ingest" },
  async ({ event, step }) => {
    const { catalog_id, organization_id } = event.data;
    const supabase = createAdminClient();

    // ── Step 1: Validate ──────────────────────────────────────────────
    const catalog = await step.run("validate", async () => {
      const { data, error } = await supabase
        .from("enterprise_catalogs")
        .select("*")
        .eq("id", catalog_id)
        .eq("organization_id", organization_id)
        .single();

      if (error || !data) {
        throw new Error(`Catalog ${catalog_id} not found or access denied`);
      }
      return data;
    });

    // ── Step 2: Count unprocessed tracks ───────────────────────────────
    const trackInfo = await step.run("count-tracks", async () => {
      const { data: tracks, error } = await supabase
        .from("reference_tracks")
        .select("id, audio_url")
        .eq("catalog_id", catalog_id)
        .eq("fingerprinted", false)
        .not("audio_url", "is", null);

      if (error) throw new Error(`Failed to query tracks: ${error.message}`);
      return { tracks: tracks ?? [], count: tracks?.length ?? 0 };
    });

    if (trackInfo.count === 0) {
      await step.run("no-tracks", async () => {
        await supabase
          .from("enterprise_catalogs")
          .update({ status: "completed" })
          .eq("id", catalog_id);
      });
      return { catalog_id, processed: 0, status: "completed" };
    }

    // ── Step 3: Estimate cost ─────────────────────────────────────────
    await step.run("cost-estimate", async () => {
      const costPerTrack = 15; // cents
      const estimatedCents = trackInfo.count * costPerTrack;
      await supabase
        .from("enterprise_catalogs")
        .update({
          estimated_cost_cents: estimatedCents,
          status: "ingesting",
          ingestion_progress: {
            total: trackInfo.count,
            processed: 0,
            failed: 0,
            started_at: new Date().toISOString(),
          },
        })
        .eq("id", catalog_id);
    });

    // ── Step 4: Emit events in batches ────────────────────────────────
    const totalBatches = Math.ceil(
      trackInfo.tracks.length / EMIT_BATCH_SIZE,
    );

    for (let batch = 0; batch < totalBatches; batch++) {
      await step.run(`emit-batch-${batch}`, async () => {
        const batchTracks = trackInfo.tracks.slice(
          batch * EMIT_BATCH_SIZE,
          (batch + 1) * EMIT_BATCH_SIZE,
        );

        const events = batchTracks
          .filter((t) => t.audio_url)
          .map((track) => ({
            name: "catalog-track/process" as const,
            data: {
              reference_track_id: track.id,
              audio_url: track.audio_url!,
              catalog_id,
              organization_id,
              pipeline_version_id: PIPELINE_VERSION,
            },
          }));

        if (events.length > 0) {
          await inngest.send(events);
        }
      });
    }

    return {
      catalog_id,
      tracks_queued: trackInfo.count,
      batches_emitted: totalBatches,
      status: "ingesting",
    };
  },
);
