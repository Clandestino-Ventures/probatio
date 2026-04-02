// @ts-nocheck — Supabase query types will be auto-generated via `supabase gen types`
/**
 * PROBATIO — Catalog Track Ingestion Pipeline (Inngest Function)
 *
 * Processes a SINGLE reference track for the enterprise catalog.
 * Lighter than process-analysis.ts — no report, no risk scoring, no comparison.
 * Just: normalize → stems → features → embeddings → lyrics → fingerprint → done.
 *
 * Design decisions for 50K-scale ingestion:
 * - Only 2 track-level embeddings (full_mix + vocals), not 4.
 *   Harmony and rhythm embeddings generated on-demand during comparison.
 * - Only phrase-level segmentation (no bar/song multi-resolution).
 * - Lyrics extraction IS included (differentiator).
 * - Cost per track: ~$0.15 (all GPU steps combined).
 *
 * Triggered by: 'catalog-track/process'
 * Concurrency: 25 (higher than analysis — catalog is background work)
 */

import { inngest } from "@/lib/inngest/client";
import { createAdminClient } from "@/lib/supabase/admin";
import { callModalEndpoint } from "@/lib/modal/client";
import { MODAL_ENDPOINTS } from "@/lib/modal/endpoints";
import { PIPELINE_VERSION } from "@/lib/constants";
import { extractLyrics } from "@/lib/modal/whisper-lyrics";
import type {
  NormalizeResponse,
  FingerprintResponse,
  SeparateResponse,
  GenerateEmbeddingsResponse,
} from "@/lib/modal/endpoints";

const MAX_RETRIES = 3;

// ────────────────────────────────────────────────────────────────────────────
// Helpers
// ────────────────────────────────────────────────────────────────────────────

async function updateTrackStatus(
  trackId: string,
  status: string,
  extra?: Record<string, unknown>,
): Promise<void> {
  const supabase = createAdminClient();
  await supabase
    .from("reference_tracks")
    .update({ status, ...extra })
    .eq("id", trackId);
}

async function updateCatalogProgress(
  catalogId: string,
  trackId: string,
  success: boolean,
): Promise<void> {
  const supabase = createAdminClient();

  if (success) {
    // Atomically increment tracks_with_embeddings
    await supabase.rpc("increment_catalog_embeddings", {
      p_catalog_id: catalogId,
    }).catch(() => {
      // Fallback: manual increment
      supabase
        .from("enterprise_catalogs")
        .select("tracks_with_embeddings")
        .eq("id", catalogId)
        .single()
        .then(({ data }) => {
          if (data) {
            supabase
              .from("enterprise_catalogs")
              .update({
                tracks_with_embeddings: (data.tracks_with_embeddings ?? 0) + 1,
              })
              .eq("id", catalogId);
          }
        });
    });
  }
}

// ────────────────────────────────────────────────────────────────────────────
// Inngest Function
// ────────────────────────────────────────────────────────────────────────────

export const processCatalogTrack = inngest.createFunction(
  {
    id: "process-catalog-track",
    name: "Process Catalog Track",
    retries: 0,
    concurrency: { limit: 25 },
    onFailure: async ({ event }) => {
      const { reference_track_id, catalog_id } = event.data.event
        .data as {
        reference_track_id: string;
        catalog_id: string;
      };
      try {
        await updateTrackStatus(reference_track_id, "failed", {
          error_message: "Pipeline failed after all retries exhausted.",
        });
        // Emit completion event so batch orchestrator can track progress
        await inngest.send({
          name: "catalog-track/completed",
          data: {
            catalog_id,
            reference_track_id,
            success: false,
          },
        });
      } catch {
        // Cleanup failure should not throw
      }
    },
  },
  { event: "catalog-track/process" },
  async ({ event, step }) => {
    const {
      reference_track_id,
      audio_url,
      catalog_id,
      organization_id,
      pipeline_version_id,
    } = event.data;

    // ── Step 1: Update Status ─────────────────────────────────────────
    await step.run("update-status", { retries: MAX_RETRIES }, async () => {
      await updateTrackStatus(reference_track_id, "processing");
    });

    // ── Step 2: Normalize ─────────────────────────────────────────────
    const normalizeResult = await step.run(
      "normalize",
      { retries: MAX_RETRIES },
      async () => {
        const result = await callModalEndpoint<
          { fileUrl: string; fileHash: string },
          NormalizeResponse
        >(MODAL_ENDPOINTS.normalize, {
          fileUrl: audio_url,
          fileHash: "", // hash computed later
        });
        return result;
      },
    );

    // ── Step 3: Separate Stems ────────────────────────────────────────
    const separateResult = await step.run(
      "separate-stems",
      { retries: MAX_RETRIES },
      async () => {
        const result = await callModalEndpoint<
          {
            audio_url: string;
            analysis_id: string;
            user_id: string;
            pipeline_version: string;
          },
          SeparateResponse
        >(MODAL_ENDPOINTS.separate, {
          audio_url: normalizeResult.normalizedUrl,
          analysis_id: reference_track_id,
          user_id: organization_id,
          pipeline_version: pipeline_version_id ?? PIPELINE_VERSION,
        });

        return {
          vocalsUrl: result.stems.vocals.url,
          vocalsHash: result.stems.vocals.hash,
          fullMixUrl: normalizeResult.normalizedUrl,
          durationSec: result.stems.vocals.durationSec,
        };
      },
    );

    // ── Step 4: Generate Embeddings (2 only: full_mix + vocals) ──────
    const embeddingsResult = await step.run(
      "generate-embeddings",
      { retries: MAX_RETRIES },
      async () => {
        const result = await callModalEndpoint<
          {
            full_audio_url: string;
            stems_urls: Record<string, string>;
            analysis_id: string;
          },
          GenerateEmbeddingsResponse
        >(MODAL_ENDPOINTS.generateEmbeddings, {
          full_audio_url: separateResult.fullMixUrl,
          stems_urls: { vocals: separateResult.vocalsUrl },
          analysis_id: reference_track_id,
        });

        // Store only full_mix (timbre) and vocals (melody) embeddings
        const supabase = createAdminClient();
        const updateData: Record<string, unknown> = {
          duration_seconds: separateResult.durationSec,
        };

        if (result.trackLevel.timbre?.embedding) {
          updateData.embedding = result.trackLevel.timbre.embedding;
        }
        if (result.trackLevel.melody?.embedding) {
          updateData.embedding_vocals = result.trackLevel.melody.embedding;
        }

        await supabase
          .from("reference_tracks")
          .update(updateData)
          .eq("id", reference_track_id);

        return {
          hasTimbre: !!result.trackLevel.timbre,
          hasMelody: !!result.trackLevel.melody,
          outputHash: result.outputHash,
        };
      },
    );

    // ── Step 5: Extract Lyrics ────────────────────────────────────────
    await step.run(
      "extract-lyrics",
      { retries: MAX_RETRIES },
      async () => {
        if (!separateResult.vocalsUrl) return null;

        const result = await extractLyrics({
          vocalsUrl: separateResult.vocalsUrl,
          analysisId: reference_track_id,
          languageHint: null,
        });

        const supabase = createAdminClient();
        const isInstrumental = result.lyrics_text.trim().length === 0;

        await supabase
          .from("reference_tracks")
          .update({
            lyrics_text: result.lyrics_text,
            lyrics_language: result.lyrics_language,
            lyrics_embedding: isInstrumental ? null : result.lyrics_embedding,
          })
          .eq("id", reference_track_id);

        return {
          language: result.lyrics_language,
          isInstrumental,
          wordCount: result.lyrics_text.split(/\s+/).filter(Boolean).length,
        };
      },
    );

    // ── Step 6: Fingerprint ───────────────────────────────────────────
    await step.run(
      "fingerprint",
      { retries: MAX_RETRIES },
      async () => {
        const result = await callModalEndpoint<
          { fileUrl: string; fileHash: string },
          FingerprintResponse
        >(MODAL_ENDPOINTS.fingerprint, {
          fileUrl: normalizeResult.normalizedUrl,
          fileHash: normalizeResult.normalizedHash,
        });

        const supabase = createAdminClient();
        await supabase
          .from("reference_tracks")
          .update({
            fingerprint: result.fingerprint,
            acoustid:
              result.acoustidMatches?.[0]?.acoustidId ?? null,
          })
          .eq("id", reference_track_id);

        return { fingerprint: result.fingerprint };
      },
    );

    // ── Step 7: Finalize ──────────────────────────────────────────────
    await step.run("finalize", { retries: MAX_RETRIES }, async () => {
      const supabase = createAdminClient();

      await supabase
        .from("reference_tracks")
        .update({
          fingerprinted: true,
          status: "completed",
        })
        .eq("id", reference_track_id);

      await updateCatalogProgress(catalog_id, reference_track_id, true);

      // Emit completion event
      await inngest.send({
        name: "catalog-track/completed",
        data: {
          catalog_id,
          reference_track_id,
          success: true,
        },
      });
    });

    return { reference_track_id, status: "completed" };
  },
);
