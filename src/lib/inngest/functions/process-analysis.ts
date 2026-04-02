// @ts-nocheck — Supabase query types will be auto-generated via `supabase gen types`
/**
 * PROBATIO — Screening Analysis Pipeline (Inngest Function)
 *
 * Triggered by "analysis/requested". Orchestrates the full audio
 * screening pipeline through 8 sequential steps:
 *
 *   1. normalize   — Convert to canonical format (44.1 kHz, 16-bit, mono)
 *   2. fingerprint — Generate acoustic fingerprint & SHA-256 hash
 *   3. separate    — Source separation via Modal GPU (vocals, drums, bass, other)
 *   4. extract     — Feature extraction (chroma, MFCC, tempo, key, etc.)
 *   5. embed       — Generate embedding vectors for similarity search
 *   6. match       — Search reference corpus for matches
 *   7. enrich      — Enrich matches with rights/metadata from external APIs
 *   8. report      — Generate final screening report
 *
 * Each step:
 *   - Updates the analysis status in Supabase
 *   - Logs to audit_log with SHA-256 hashes for chain of custody
 *   - Retries up to 3 times with exponential backoff on failure
 *
 * On unrecoverable failure:
 *   - Sets analysis status to "failed"
 *   - Refunds the user's credit
 *   - Logs the error to audit_log
 */

import { inngest } from "@/lib/inngest/client";
import { createAdminClient } from "@/lib/supabase/admin";
import { callModalEndpoint } from "@/lib/modal/client";
import { MODAL_ENDPOINTS } from "@/lib/modal/endpoints";
import { PIPELINE_VERSION } from "@/lib/constants";
import type { AnalysisStatus } from "@/types/database";
import type { AnalysisFeatures, StemUrls } from "@/types/analysis";
import type {
  NormalizeResponse,
  FingerprintResponse,
  SeparateResponse,
  ExtractFeaturesResponse,
  GenerateEmbeddingsResponse,
  SearchMatchesResponse,
  EnrichRightsResponse,
} from "@/lib/modal/endpoints";
import { extractLyrics } from "@/lib/modal/whisper-lyrics";
import { recordCustody } from "@/lib/custody";
import { formatPgVector } from "@/lib/pgvector";

// ────────────────────────────────────────────────────────────────────────────
// Constants
// ────────────────────────────────────────────────────────────────────────────

const MAX_RETRIES = 3;

// ────────────────────────────────────────────────────────────────────────────
// Helpers
// ────────────────────────────────────────────────────────────────────────────

async function updateAnalysisStatus(
  analysisId: string,
  status: AnalysisStatus,
  extra?: Record<string, unknown>,
): Promise<void> {
  const supabase = createAdminClient();
  const { error } = await supabase
    .from("analyses")
    .update({ status, updated_at: new Date().toISOString(), ...extra })
    .eq("id", analysisId);

  if (error) {
    throw new Error(`Failed to update analysis status: ${error.message}`);
  }
}

async function logAudit(params: {
  userId: string;
  analysisId: string;
  action: string;
  hash: string;
  metadata?: Record<string, unknown>;
}): Promise<void> {
  const supabase = createAdminClient();
  const { error } = await supabase.from("audit_log").insert({
    user_id: params.userId,
    entity_type: "analysis",
    entity_id: params.analysisId,
    action: params.action,
    metadata: {
      hash: params.hash,
      pipeline_version: PIPELINE_VERSION,
      ...params.metadata,
    },
  });

  if (error) {
    // Audit log failures should not break the pipeline, but we log them.
    console.error(`Audit log insert failed: ${error.message}`);
  }
}

async function refundCredit(userId: string, analysisId: string): Promise<void> {
  const supabase = createAdminClient();

  // Find the credit usage record for this analysis.
  const { data: usageRecord, error: fetchError } = await supabase
    .from("credit_usage")
    .select("credits_used")
    .eq("analysis_id", analysisId)
    .eq("user_id", userId)
    .limit(1)
    .single();

  if (fetchError || !usageRecord) {
    console.error(`Could not find credit usage for refund: ${fetchError?.message}`);
    return;
  }

  // Restore the credits — read current balance, then increment.
  const { data: currentCredits } = await supabase
    .from("credits")
    .select("balance, lifetime_used")
    .eq("user_id", userId)
    .single();

  if (currentCredits) {
    const refundAmount = Math.abs(usageRecord.amount ?? 1);
    await supabase
      .from("credits")
      .update({
        balance: currentCredits.balance + refundAmount,
        lifetime_used: Math.max(0, (currentCredits.lifetime_used ?? 0) - refundAmount),
        updated_at: new Date().toISOString(),
      })
      .eq("user_id", userId);
  } else {
    console.error(`[PROBATIO] Could not find credits row for user ${userId} during refund`);
  }

  // Log the refund.
  await logAudit({
    userId,
    analysisId,
    action: "credit_refunded",
    hash: "",
    metadata: { credits_refunded: usageRecord.credits_used },
  });
}

// ────────────────────────────────────────────────────────────────────────────
// DTW Path → Aligned Segment Extraction
// ────────────────────────────────────────────────────────────────────────────

/**
 * Extract contiguous aligned segments from a DTW warping path.
 * Groups adjacent path indices into segments and converts to seconds.
 */
function extractAlignedSegments(
  path: [number, number][],
  segmentDurationSec: number,
  globalSimilarity: number,
): Array<{ sourceStart: number; sourceEnd: number; targetStart: number; targetEnd: number; similarity: number }> {
  if (path.length === 0) return [];

  const results: Array<{ sourceStart: number; sourceEnd: number; targetStart: number; targetEnd: number; similarity: number }> = [];

  // Group path into chunks of ~8 indices (representing 2 segments of 4s each)
  const chunkSize = Math.max(4, Math.floor(path.length / 8));
  for (let i = 0; i < path.length; i += chunkSize) {
    const chunk = path.slice(i, i + chunkSize);
    const srcStart = chunk[0][0] * segmentDurationSec;
    const srcEnd = (chunk[chunk.length - 1][0] + 1) * segmentDurationSec;
    const tgtStart = chunk[0][1] * segmentDurationSec;
    const tgtEnd = (chunk[chunk.length - 1][1] + 1) * segmentDurationSec;

    // Local similarity based on diagonal alignment of the path
    const diagonalScore = chunk.reduce((acc, [si, ti], idx) => {
      if (idx === 0) return acc;
      const prevS = chunk[idx - 1][0];
      const prevT = chunk[idx - 1][1];
      return acc + (si - prevS === 1 && ti - prevT === 1 ? 1 : 0);
    }, 0) / Math.max(1, chunk.length - 1);

    const similarity = globalSimilarity * (0.5 + 0.5 * diagonalScore);

    if (similarity > 0.15) {
      results.push({ sourceStart: srcStart, sourceEnd: srcEnd, targetStart: tgtStart, targetEnd: tgtEnd, similarity });
    }
  }

  return results;
}

// ────────────────────────────────────────────────────────────────────────────
// Inngest Function
// ────────────────────────────────────────────────────────────────────────────

export const processAnalysis = inngest.createFunction(
  {
    id: "process-analysis",
    name: "Process Screening Analysis",
    retries: 0, // We handle retries per-step
    onFailure: async ({ event }) => {
      const { analysisId, userId } = event.data.event.data as {
        analysisId: string;
        userId: string;
      };

      try {
        await updateAnalysisStatus(analysisId, "failed", {
          error_message: "Pipeline failed after all retries exhausted.",
        });
        await refundCredit(userId, analysisId);
        await logAudit({
          userId,
          analysisId,
          action: "pipeline_failed",
          hash: "",
          metadata: { error: "Pipeline failed after exhausting retries" },
        });
      } catch (cleanupError) {
        console.error("Error during failure cleanup:", cleanupError);
      }
    },
  },
  { event: "analysis/requested" },
  async ({ event, step }) => {
    const { analysisId, userId, fileUrl, fileHashSha256, mode } = event.data;

    // ── Step 1: Normalize ──────────────────────────────────────────────
    const normalizeResult = await step.run(
      "normalize",
      { retries: MAX_RETRIES },
      async () => {
        await updateAnalysisStatus(analysisId, "normalizing");
        await logAudit({
          userId,
          analysisId,
          action: "step_started:normalize",
          hash: fileHashSha256,
        });

        const result = await callModalEndpoint<
          { fileUrl: string; fileHash: string },
          NormalizeResponse
        >(MODAL_ENDPOINTS.normalize, {
          fileUrl,
          fileHash: fileHashSha256,
        });

        await logAudit({
          userId,
          analysisId,
          action: "step_completed:normalize",
          hash: result.normalizedHash,
          metadata: {
            sampleRate: result.sampleRate,
            duration: result.durationSeconds,
          },
        });

        return result;
      },
    );

    // ── Step 2: Fingerprint ────────────────────────────────────────────
    const fingerprintResult = await step.run(
      "fingerprint",
      { retries: MAX_RETRIES },
      async () => {
        await logAudit({
          userId,
          analysisId,
          action: "step_started:fingerprint",
          hash: normalizeResult.normalizedHash,
        });

        const result = await callModalEndpoint<
          { fileUrl: string; fileHash: string },
          FingerprintResponse
        >(MODAL_ENDPOINTS.fingerprint, {
          fileUrl: normalizeResult.normalizedUrl,
          fileHash: normalizeResult.normalizedHash,
        });

        await logAudit({
          userId,
          analysisId,
          action: "step_completed:fingerprint",
          hash: result.fingerprintHash,
          metadata: { duration_sec: result.durationSec, acoustid_matches: result.acoustidMatches?.length ?? 0 },
        });

        return result;
      },
    );

    // ── Step 3: Separate Stems ─────────────────────────────────────────
    const separateResult = await step.run(
      "separate-stems",
      { retries: MAX_RETRIES },
      async () => {
        await updateAnalysisStatus(analysisId, "separating");
        await logAudit({
          userId,
          analysisId,
          action: "step_started:separate",
          hash: normalizeResult.normalizedHash,
        });

        const result = await callModalEndpoint<
          { audio_url: string; analysis_id: string; user_id: string; pipeline_version: string },
          SeparateResponse
        >(MODAL_ENDPOINTS.separate, {
          audio_url: normalizeResult.normalizedUrl,
          analysis_id: analysisId,
          user_id: userId,
          pipeline_version: PIPELINE_VERSION,
        });

        // SeparateResponse.stems contains StemResult objects with {url, hash, durationSec}
        const stemUrls: StemUrls = {
          vocals: result.stems.vocals.url,
          drums: result.stems.drums.url,
          bass: result.stems.bass.url,
          other: result.stems.other.url,
          original: normalizeResult.normalizedUrl,
        };

        // Persist stem URLs and duration on the analysis record.
        const supabase = createAdminClient();
        await supabase
          .from("analyses")
          .update({
            stems_urls: stemUrls,
            file_duration_sec: result.stems.vocals.durationSec,
            updated_at: new Date().toISOString(),
          })
          .eq("id", analysisId);

        await logAudit({
          userId,
          analysisId,
          action: "step_completed:separate",
          hash: result.inputHash,
          metadata: {
            model: result.model,
            model_version: result.modelVersion,
            processing_time_ms: result.processingTimeMs,
            stem_hashes: {
              vocals: result.stems.vocals.hash,
              bass: result.stems.bass.hash,
              drums: result.stems.drums.hash,
              other: result.stems.other.hash,
            },
          },
        });

        return { stemUrls, inputHash: result.inputHash, stems: result.stems };
      },
    );

    // ── Step 4: Extract Features ───────────────────────────────────────
    const featuresResult = await step.run(
      "extract-features",
      { retries: MAX_RETRIES },
      async () => {
        await updateAnalysisStatus(analysisId, "extracting");
        await logAudit({
          userId,
          analysisId,
          action: "step_started:extract",
          hash: separateResult.inputHash,
        });

        const result = await callModalEndpoint<
          {
            stems_urls: Record<string, string>;
            full_audio_url: string;
            analysis_id: string;
            user_id: string;
          },
          ExtractFeaturesResponse
        >(MODAL_ENDPOINTS.extractFeatures, {
          stems_urls: separateResult.stemUrls,
          full_audio_url: normalizeResult.normalizedUrl,
          analysis_id: analysisId,
          user_id: userId,
        });

        // Save summary features to analyses.features (quick access)
        const supabase = createAdminClient();
        await supabase
          .from("analyses")
          .update({
            features: result.trackLevel as unknown as Record<string, unknown>,
            file_duration_sec: result.trackLevel.durationSec,
            updated_at: new Date().toISOString(),
          })
          .eq("id", analysisId);

        // Clear existing segments (retry safety) then bulk insert
        await supabase
          .from("analysis_segments")
          .delete()
          .eq("analysis_id", analysisId);

        // Insert legacy segments (backward compat, resolution='phrase')
        if (result.segments && result.segments.length > 0) {
          const segmentRows = result.segments.map((seg) => ({
            analysis_id: analysisId,
            start_sec: seg.startSec,
            end_sec: seg.endSec,
            segment_index: seg.index,
            label: seg.label || null,
            pitch_contour: seg.features.pitchContour,
            chroma_vector: seg.features.chromaVector,
            onset_density: seg.features.onsetDensity,
            rms_energy: seg.features.rmsEnergy,
            resolution: "phrase" as const,
          }));

          const BATCH_SIZE = 50;
          for (let i = 0; i < segmentRows.length; i += BATCH_SIZE) {
            const batch = segmentRows.slice(i, i + BATCH_SIZE);
            await supabase.from("analysis_segments").insert(batch);
          }
        }

        // Insert multi-resolution segments (bar, phrase, song)
        const multiRes = result.multiResolutionSegments as
          | Record<string, Array<{ index: number; start_sec: number; end_sec: number; resolution: string; features?: Record<string, unknown> }>>
          | undefined;
        let multiResCount = 0;
        if (multiRes) {
          for (const [resolution, segs] of Object.entries(multiRes)) {
            const rows = segs.map((seg) => ({
              analysis_id: analysisId,
              start_sec: seg.start_sec ?? seg.startSec,
              end_sec: seg.end_sec ?? seg.endSec,
              segment_index: seg.index,
              label: null,
              pitch_contour: (seg.features as Record<string, unknown>)?.pitchContour ?? null,
              chroma_vector: (seg.features as Record<string, unknown>)?.chromaVector ?? null,
              onset_density: (seg.features as Record<string, unknown>)?.onsetDensity ?? null,
              rms_energy: (seg.features as Record<string, unknown>)?.rmsEnergy ?? null,
              resolution: resolution as "bar" | "phrase" | "song",
            }));
            const BATCH_SIZE = 50;
            for (let i = 0; i < rows.length; i += BATCH_SIZE) {
              const batch = rows.slice(i, i + BATCH_SIZE);
              await supabase.from("analysis_segments").insert(batch);
            }
            multiResCount += rows.length;
          }
        }

        await logAudit({
          userId,
          analysisId,
          action: "step_completed:extract",
          hash: result.outputHash,
          metadata: {
            tempo_bpm: result.trackLevel.rhythm?.estimatedTempoBpm,
            key: result.trackLevel.key?.key,
            duration_sec: result.trackLevel.durationSec,
            segments_created: result.segments?.length ?? 0,
            multi_resolution_segments: multiResCount,
            processing_time_ms: result.processingTimeMs,
          },
        });

        return { trackLevel: result.trackLevel, outputHash: result.outputHash, segments: result.segments };
      },
    );

    // ── Step 4.5: Detect Genre ────────────────────────────────────────
    const genreResult = await step.run(
      "detect-genre",
      { retries: MAX_RETRIES },
      async () => {
        const { extractGenreFeatures, detectGenre } = await import("@/lib/scoring/genre-detector");
        const genreFeatures = extractGenreFeatures(
          featuresResult.trackLevel as unknown as Record<string, unknown>,
        );
        const detection = detectGenre(genreFeatures);

        const supabase = createAdminClient();
        await supabase
          .from("analyses")
          .update({
            detected_genre: detection.primary,
            genre_confidence: detection.confidence,
            updated_at: new Date().toISOString(),
          })
          .eq("id", analysisId);

        await logAudit({
          userId,
          analysisId,
          action: "step_completed:genre",
          hash: featuresResult.outputHash,
          metadata: {
            detected_genre: detection.primary,
            genre_confidence: detection.confidence,
            alternatives: detection.alternatives,
          },
        });

        return detection;
      },
    );

    // ── Step 5: Generate Embeddings (Multi-dimensional + Segment) ──────
    const embeddingsResult = await step.run(
      "generate-embeddings",
      { retries: MAX_RETRIES },
      async () => {
        await logAudit({
          userId,
          analysisId,
          action: "step_started:embed",
          hash: featuresResult.outputHash,
        });

        const result = await callModalEndpoint<
          {
            full_audio_url: string;
            stems_urls: Record<string, string>;
            analysis_id: string;
          },
          GenerateEmbeddingsResponse
        >(MODAL_ENDPOINTS.generateEmbeddings, {
          full_audio_url: normalizeResult.normalizedUrl,
          stems_urls: separateResult.stemUrls,
          analysis_id: analysisId,
        });

        // Store track-level embeddings in spectral_signatures table
        const supabase = createAdminClient();
        const dimensionMap: Record<string, string> = {
          timbre: "timbre",
          melody: "melody",
          harmony: "harmony",
          rhythm: "rhythm",
        };

        for (const [dimension, data] of Object.entries(result.trackLevel)) {
          if (data?.embedding) {
            await supabase.from("spectral_signatures").insert({
              analysis_id: analysisId,
              dimension: dimensionMap[dimension] || dimension,
              stem_type: data.stem === "full_mix" ? null : data.stem,
              embedding: data.embedding,
              model_used: result.model,
              confidence: null,
            });
          }
        }

        // Update legacy segment embeddings in analysis_segments
        if (result.segmentEmbeddings && result.segmentEmbeddings.length > 0) {
          for (const segEmb of result.segmentEmbeddings) {
            await supabase
              .from("analysis_segments")
              .update({ embedding: segEmb.embedding })
              .eq("analysis_id", analysisId)
              .eq("segment_index", segEmb.index)
              .eq("resolution", "phrase");
          }
        }

        // Update multi-resolution segment embeddings
        const multiResEmbs = result.multiResolutionEmbeddings as
          | Record<string, Array<{ index: number; embedding: number[]; resolution: string }>>
          | undefined;
        if (multiResEmbs) {
          for (const [resolution, embs] of Object.entries(multiResEmbs)) {
            for (const segEmb of embs) {
              await supabase
                .from("analysis_segments")
                .update({ embedding: segEmb.embedding })
                .eq("analysis_id", analysisId)
                .eq("segment_index", segEmb.index)
                .eq("resolution", resolution);
            }
          }
        }

        await logAudit({
          userId,
          analysisId,
          action: "step_completed:embed",
          hash: result.outputHash,
          metadata: {
            embedding_dim: result.embeddingDim,
            track_level_dimensions: Object.keys(result.trackLevel).length,
            segment_embeddings: result.segmentEmbeddings?.length ?? 0,
            processing_time_ms: result.processingTimeMs,
          },
        });

        return result;
      },
    );

    // ── Step 5.5: Extract Lyrics (Whisper large-v3 + text embedding) ───
    // Transcribes isolated vocals and generates a 512-dim text embedding
    // for pgvector similarity search. The 5th forensic dimension.
    const lyricsResult = await step.run(
      "extract-lyrics",
      { retries: MAX_RETRIES },
      async () => {
        await updateAnalysisStatus(analysisId, "extracting_lyrics");

        const vocalsUrl = separateResult.stemUrls.vocals;
        if (!vocalsUrl) {
          // No vocals stem — skip lyrics extraction (instrumental input)
          await logAudit({
            userId,
            analysisId,
            action: "step_skipped:lyrics",
            hash: embeddingsResult.outputHash,
            metadata: { reason: "no_vocals_stem" },
          });
          return null;
        }

        const result = await extractLyrics({
          vocalsUrl,
          analysisId,
          languageHint: event.data.language_hint ?? null,
        });

        // Save lyrics to analysis row
        const supabase = createAdminClient();
        await supabase
          .from("analyses")
          .update({
            lyrics_text: result.lyrics_text,
            lyrics_language: result.lyrics_language,
            updated_at: new Date().toISOString(),
          })
          .eq("id", analysisId);

        // Store lyrics embedding in spectral_signatures (same table as other dimensions)
        const isInstrumental = result.lyrics_text.trim().length === 0;
        if (!isInstrumental) {
          await supabase.from("spectral_signatures").insert({
            analysis_id: analysisId,
            dimension: "lyrics",
            stem_type: "vocals",
            embedding: result.lyrics_embedding,
            model_used: `${result.whisper_model}+${result.embedding_model}`,
            confidence: null,
          });
        }

        // Record chain of custody
        await recordCustody({
          entityType: "analysis",
          entityId: analysisId,
          action: "lyrics_extracted",
          actorId: userId,
          artifactType: "lyrics_transcript",
          artifactHash: result.output_hash,
          detail: {
            whisper_model: result.whisper_model,
            embedding_model: result.embedding_model,
            language: result.lyrics_language,
            word_count: result.lyrics_text.split(/\s+/).filter(Boolean).length,
            segment_count: result.segments.length,
            is_instrumental: isInstrumental,
          },
          pipelineVersionId: PIPELINE_VERSION,
        });

        await logAudit({
          userId,
          analysisId,
          action: "step_completed:lyrics",
          hash: result.output_hash,
          metadata: {
            language: result.lyrics_language,
            word_count: result.lyrics_text.split(/\s+/).filter(Boolean).length,
            segment_count: result.segments.length,
            is_instrumental: isInstrumental,
            processing_time_ms: result.processing_time_ms,
          },
        });

        return result;
      },
    );

    // ── Step 6: Vector Search (Multi-dimensional, in-database) ─────────
    // Searches by 5 dimensions using Supabase pgvector RPC functions.
    // Melody weighted highest because melodic similarity is the
    // strongest legal indicator of copying in music copyright law.
    const matchesResult = await step.run(
      "search-matches",
      { retries: MAX_RETRIES },
      async () => {
        await updateAnalysisStatus(analysisId, "matching");
        await logAudit({
          userId,
          analysisId,
          action: "step_started:match",
          hash: embeddingsResult.outputHash,
        });

        const supabase = createAdminClient();
        const threshold = 0.3;
        const maxMatches = 10;

        // Dimension weights — use 5-dim weights when lyrics available,
        // redistribute proportionally when not (instrumental tracks)
        const hasLyrics = lyricsResult != null && lyricsResult.lyrics_text.trim().length > 0;
        const WEIGHTS: Record<string, number> = hasLyrics
          ? { melody: 0.30, harmony: 0.20, lyrics: 0.20, timbre: 0.15, rhythm: 0.15 }
          : { melody: 0.375, harmony: 0.25, timbre: 0.1875, rhythm: 0.1875 };

        // Collect candidates from all dimensions
        const allCandidates = new Map<string, {
          analysisId?: string;
          referenceTrackId?: string;
          scores: Record<string, number>;
        }>();

        // Search by each dimension using Supabase RPC
        for (const [dim, data] of Object.entries(embeddingsResult.trackLevel)) {
          if (!data?.embedding) continue;

          // Search spectral_signatures of OTHER analyses
          const { data: sigMatches } = await supabase.rpc("match_by_dimension", {
            query_embedding: data.embedding,
            query_dimension: dim,
            exclude_analysis_id: analysisId,
            match_threshold: threshold,
            match_count: maxMatches * 2,
          });

          if (sigMatches) {
            for (const m of sigMatches) {
              const key = `analysis:${m.analysis_id}`;
              if (!allCandidates.has(key)) {
                allCandidates.set(key, { analysisId: m.analysis_id, scores: {} });
              }
              allCandidates.get(key)!.scores[dim] = m.similarity;
            }
          }

          // Search reference_tracks (timbre dimension = full mix)
          if (dim === "timbre") {
            const { data: refMatches } = await supabase.rpc("match_reference_tracks", {
              query_embedding: data.embedding,
              match_threshold: threshold,
              match_count: maxMatches * 2,
            });

            if (refMatches) {
              for (const m of refMatches) {
                const key = `ref:${m.id}`;
                if (!allCandidates.has(key)) {
                  allCandidates.set(key, { referenceTrackId: m.id, scores: {} });
                }
                allCandidates.get(key)!.scores.timbre = m.similarity;
              }
            }
          }
        }

        // Search by lyrics embedding (5th dimension)
        if (hasLyrics && lyricsResult) {
          // Search reference_tracks by lyrics embedding
          const { data: lyricsRefMatches } = await supabase.rpc("find_similar_tracks_lyrics", {
            p_embedding: formatPgVector(lyricsResult.lyrics_embedding),
            p_catalog_ids: event.data.catalog_ids ?? [],
            p_threshold: threshold,
            p_limit: maxMatches * 2,
          });

          if (lyricsRefMatches) {
            for (const m of lyricsRefMatches) {
              const key = `ref:${m.id}`;
              if (!allCandidates.has(key)) {
                allCandidates.set(key, { referenceTrackId: m.id, scores: {} });
              }
              allCandidates.get(key)!.scores.lyrics = m.similarity;
            }
          }

          // Search spectral_signatures for lyrics dimension (other analyses)
          const { data: lyricsSigMatches } = await supabase.rpc("match_by_dimension", {
            query_embedding: lyricsResult.lyrics_embedding,
            query_dimension: "lyrics",
            exclude_analysis_id: analysisId,
            match_threshold: threshold,
            match_count: maxMatches * 2,
          });

          if (lyricsSigMatches) {
            for (const m of lyricsSigMatches) {
              const key = `analysis:${m.analysis_id}`;
              if (!allCandidates.has(key)) {
                allCandidates.set(key, { analysisId: m.analysis_id, scores: {} });
              }
              allCandidates.get(key)!.scores.lyrics = m.similarity;
            }
          }
        }

        // Score and rank candidates
        const scoredCandidates = Array.from(allCandidates.entries()).map(([, candidate]) => {
          let weightedSum = 0;
          let weightTotal = 0;
          for (const [dim, score] of Object.entries(candidate.scores)) {
            const weight = WEIGHTS[dim] || 0;
            weightedSum += score * weight;
            weightTotal += weight;
          }
          const overallScore = weightTotal > 0 ? weightedSum / weightTotal : 0;

          // Risk classification
          let riskLevel = "low";
          if (overallScore >= 0.85) riskLevel = "critical";
          else if (overallScore >= 0.60) riskLevel = "high";
          else if (overallScore >= 0.30) riskLevel = "moderate";

          return {
            ...candidate,
            score_overall: overallScore,
            score_melody: candidate.scores.melody ?? null,
            score_harmony: candidate.scores.harmony ?? null,
            score_rhythm: candidate.scores.rhythm ?? null,
            score_timbre: candidate.scores.timbre ?? null,
            score_lyrics: candidate.scores.lyrics ?? null,
            risk_level: riskLevel,
            dimensions_matched: Object.keys(candidate.scores).length,
          };
        });

        // Sort by overall score, take top-N
        scoredCandidates.sort((a, b) => b.score_overall - a.score_overall);
        const topMatches = scoredCandidates.slice(0, maxMatches);

        // Clear existing matches (retry safety)
        await supabase.from("analysis_matches").delete().eq("analysis_id", analysisId);

        // Insert matches
        if (topMatches.length > 0) {
          const matchInserts = topMatches.map((m) => ({
            analysis_id: analysisId,
            reference_track_id: m.referenceTrackId ?? null,
            compared_analysis_id: m.analysisId ?? null,
            score_overall: m.score_overall,
            score_melody: m.score_melody,
            score_harmony: m.score_harmony,
            score_rhythm: m.score_rhythm,
            score_timbre: m.score_timbre,
            score_lyrics: m.score_lyrics,
            risk_level: m.risk_level,
          }));

          await supabase.from("analysis_matches").insert(matchInserts);
        }

        // Update analysis with match count and overall risk
        const highestRisk = topMatches[0]?.risk_level ?? "low";
        const highestScore = topMatches[0]?.score_overall ?? 0;

        await supabase.from("analyses").update({
          match_count: topMatches.length,
          overall_risk: highestRisk,
          overall_score: highestScore,
        }).eq("id", analysisId);

        await logAudit({
          userId,
          analysisId,
          action: "step_completed:match",
          hash: embeddingsResult.outputHash,
          metadata: {
            candidates_found: allCandidates.size,
            matches_stored: topMatches.length,
            highest_score: highestScore,
            highest_risk: highestRisk,
            dimension_weights: WEIGHTS,
          },
        });

        return {
          matches: topMatches,
          searchHash: embeddingsResult.outputHash,
          matchCount: topMatches.length,
          highestRisk,
          highestScore,
        };
      },
    );

    // ── Step 7: Detailed Segment Comparison ─────────────────────────────
    // This is the forensic heart. Finds EXACTLY where and how tracks match
    // at the segment level, with DTW + transposition detection.
    const comparisonResult = await step.run(
      "compare-segments",
      { retries: MAX_RETRIES },
      async () => {
        await logAudit({
          userId,
          analysisId,
          action: "step_started:compare",
          hash: matchesResult.searchHash,
        });

        if (matchesResult.matchCount === 0) {
          await logAudit({
            userId,
            analysisId,
            action: "step_completed:compare",
            hash: matchesResult.searchHash,
            metadata: { skipped: true, reason: "no_matches" },
          });
          return { evidenceCount: 0 };
        }

        const supabase = createAdminClient();

        // Fetch matches from Step 6
        const { data: matches } = await supabase
          .from("analysis_matches")
          .select("id, reference_track_id, compared_analysis_id, score_overall")
          .eq("analysis_id", analysisId)
          .order("score_overall", { ascending: false });

        // Determine available resolutions (check if multi-res segments exist)
        const { count: barCount } = await supabase
          .from("analysis_segments")
          .select("*", { count: "exact", head: true })
          .eq("analysis_id", analysisId)
          .eq("resolution", "bar");

        const availableResolutions = (barCount ?? 0) > 0
          ? ["bar", "phrase", "song"] as const
          : ["phrase"] as const; // Legacy — only phrase segments exist

        let totalEvidence = 0;

        for (const match of matches ?? []) {
          // Clear existing evidence for this match (retry safety)
          await supabase.from("match_evidence").delete().eq("match_id", match.id);

          // Accumulate evidence across all resolutions
          const allEvidence: Array<{
            dimension: string;
            similarity_score: number;
            source_start_sec: number;
            source_end_sec: number;
            target_start_sec: number;
            target_end_sec: number;
            detail: Record<string, unknown>;
            description: string;
            resolution: string;
          }> = [];

          // Compare at each resolution level
          for (const resolution of availableResolutions) {
            // Fetch source segments at this resolution
            const { data: sourceSegments } = await supabase
              .from("analysis_segments")
              .select("*")
              .eq("analysis_id", analysisId)
              .eq("resolution", resolution)
              .order("segment_index");

            // Fetch target segments at this resolution
            let targetSegments = sourceSegments; // fallback
            if (match.compared_analysis_id) {
              const { data: tgt } = await supabase
                .from("analysis_segments")
                .select("*")
                .eq("analysis_id", match.compared_analysis_id)
                .eq("resolution", resolution)
                .order("segment_index");
              if (tgt && tgt.length > 0) targetSegments = tgt;
            }

          // Generate segment-level evidence using real DTW comparison.
          // Compare source and target segments per-dimension using their
          // stored features (pitch contour, chroma, onset density, rms energy).
          const { computeDTW, computeTranspositionAwareDTW, hzToMidi, semitonesToIntervalName } = await import("@/lib/forensic/dtw");

          const evidence: typeof allEvidence = [];

          if (sourceSegments && targetSegments && sourceSegments.length > 0 && targetSegments.length > 0) {
            // ── Melody: transposition-aware DTW ───────────────────────
            // Extract pitch contours and use computeTranspositionAwareDTW
            // which catches melodies shifted to a different key
            const extractPitch = (seg: typeof sourceSegments[0]): number[] | null => {
              const pc = seg.pitch_contour as Record<string, unknown> | null;
              if (!pc) return null;
              const freqs = (pc.frequencies ?? pc.values) as number[] | undefined;
              if (!freqs || !Array.isArray(freqs)) return null;
              return freqs.map(hzToMidi);
            };

            const srcMelody = sourceSegments.map(extractPitch).filter((f): f is number[] => f !== null && f.length > 0);
            const tgtMelody = targetSegments.map(extractPitch).filter((f): f is number[] => f !== null && f.length > 0);

            if (srcMelody.length > 0 && tgtMelody.length > 0) {
              const srcFlat = srcMelody.flat();
              const tgtFlat = tgtMelody.flat();

              if (srcFlat.length >= 2 && tgtFlat.length >= 2) {
                const melodyResult = computeTranspositionAwareDTW(srcFlat, tgtFlat);
                const pathSegments = extractAlignedSegments(melodyResult.path, 4.0, melodyResult.similarity);

                for (const ps of pathSegments) {
                  evidence.push({
                    dimension: "melody",
                    similarity_score: ps.similarity,
                    source_start_sec: ps.sourceStart,
                    source_end_sec: ps.sourceEnd,
                    target_start_sec: ps.targetStart,
                    target_end_sec: ps.targetEnd,
                    detail: {
                      dtw_distance: melodyResult.distance,
                      path_length: melodyResult.path.length,
                      transposition_semitones: melodyResult.transposition_semitones,
                      transposition_name: melodyResult.transposition_name,
                      dtw_method: melodyResult.method,
                      interval_similarity: melodyResult.interval_similarity,
                      transposition_similarity: melodyResult.transposition_similarity,
                    },
                    description: `Melody similarity: ${(ps.similarity * 100).toFixed(1)}% ` +
                      `(source ${ps.sourceStart.toFixed(1)}s-${ps.sourceEnd.toFixed(1)}s ↔ ` +
                      `target ${ps.targetStart.toFixed(1)}s-${ps.targetEnd.toFixed(1)}s)` +
                      (melodyResult.transposition_semitones !== 0
                        ? ` [${melodyResult.transposition_name}]`
                        : ""),
                    resolution: resolution ?? "phrase",
                  });
                }
              }
            }

            // ── Harmony, Rhythm, Timbre: standard DTW ─────────────────
            const nonMelodyDimensions: Array<{ name: string; extract: (seg: typeof sourceSegments[0]) => number[] | null }> = [
              {
                name: "harmony",
                extract: (seg) => {
                  const cv = seg.chroma_vector;
                  if (Array.isArray(cv)) return cv as number[];
                  if (cv && typeof cv === "object" && "values" in cv) return (cv as Record<string, unknown>).values as number[];
                  return null;
                },
              },
              {
                name: "rhythm",
                extract: (seg) => (seg.onset_density != null ? [seg.onset_density, seg.rms_energy ?? 0] : null),
              },
              {
                name: "timbre",
                extract: (seg) => (seg.embedding ? (seg.embedding as number[]).slice(0, 64) : null),
              },
            ];

            for (const dim of nonMelodyDimensions) {
              const srcFeatures = sourceSegments.map(dim.extract).filter((f): f is number[] => f !== null);
              const tgtFeatures = targetSegments.map(dim.extract).filter((f): f is number[] => f !== null);

              if (srcFeatures.length === 0 || tgtFeatures.length === 0) continue;

              const srcFlat = srcFeatures.map(f => f.length === 1 ? f[0] : f.reduce((a, b) => a + b, 0) / f.length);
              const tgtFlat = tgtFeatures.map(f => f.length === 1 ? f[0] : f.reduce((a, b) => a + b, 0) / f.length);

              const dtwResult = computeDTW(srcFlat, tgtFlat);
              const similarity = Math.max(0, 1 - dtwResult.normalizedDistance);

              const pathSegments = extractAlignedSegments(dtwResult.path, 4.0, similarity);

              for (const ps of pathSegments) {
                evidence.push({
                  dimension: dim.name,
                  similarity_score: ps.similarity,
                  source_start_sec: ps.sourceStart,
                  source_end_sec: ps.sourceEnd,
                  target_start_sec: ps.targetStart,
                  target_end_sec: ps.targetEnd,
                  detail: {
                    dtw_distance: dtwResult.normalizedDistance,
                    path_length: dtwResult.path.length,
                  },
                  description: `${dim.name} similarity: ${(ps.similarity * 100).toFixed(1)}% ` +
                    `(source ${ps.sourceStart.toFixed(1)}s-${ps.sourceEnd.toFixed(1)}s ↔ ` +
                    `target ${ps.targetStart.toFixed(1)}s-${ps.targetEnd.toFixed(1)}s)`,
                  resolution: resolution ?? "phrase",
                });
              }
            }
          }

          // Accumulate evidence into the cross-resolution collection
          for (const e of evidence) {
            allEvidence.push(e);
          }

          } // End resolution loop

          // Bulk insert all evidence across resolutions
          if (allEvidence.length > 0) {
            const rows = allEvidence.map((e) => ({
              match_id: match.id,
              source_start_sec: e.source_start_sec,
              source_end_sec: e.source_end_sec,
              target_start_sec: e.target_start_sec,
              target_end_sec: e.target_end_sec,
              dimension: e.dimension,
              similarity_score: e.similarity_score,
              detail: e.detail,
              description: e.description,
              resolution: e.resolution,
            }));

            const BATCH_SIZE = 50;
            for (let i = 0; i < rows.length; i += BATCH_SIZE) {
              const batch = rows.slice(i, i + BATCH_SIZE);
              await supabase.from("match_evidence").insert(batch);
            }
            totalEvidence += rows.length;
          }

          // Update match with refined scores — uses MAX across resolutions per dimension
          const { computeRefinedScores, classifyRiskFromScore } = await import("@/lib/comparison/scoring");
          const refined = computeRefinedScores(allEvidence);

          // Compute lyrics similarity for this match if both tracks have lyrics
          let scoreLyrics: number | null = null;
          if (hasLyrics && lyricsResult) {
            // Check if the matched track has a lyrics embedding
            if (match.compared_analysis_id) {
              const { data: targetLyricsSig } = await supabase
                .from("spectral_signatures")
                .select("embedding")
                .eq("analysis_id", match.compared_analysis_id)
                .eq("dimension", "lyrics")
                .single();
              if (targetLyricsSig?.embedding) {
                const { cosineSimilarity } = await import("@/lib/pgvector");
                const targetEmb = Array.isArray(targetLyricsSig.embedding)
                  ? targetLyricsSig.embedding
                  : (typeof targetLyricsSig.embedding === "string"
                    ? JSON.parse(targetLyricsSig.embedding) : []);
                if (targetEmb.length > 0) {
                  scoreLyrics = cosineSimilarity(lyricsResult.lyrics_embedding, targetEmb);
                }
              }
            } else if (match.reference_track_id) {
              const { data: refTrack } = await supabase
                .from("reference_tracks")
                .select("lyrics_embedding")
                .eq("id", match.reference_track_id)
                .single();
              if (refTrack?.lyrics_embedding) {
                const { cosineSimilarity } = await import("@/lib/pgvector");
                const refEmb = Array.isArray(refTrack.lyrics_embedding)
                  ? refTrack.lyrics_embedding
                  : (typeof refTrack.lyrics_embedding === "string"
                    ? JSON.parse(refTrack.lyrics_embedding) : []);
                if (refEmb.length > 0) {
                  scoreLyrics = cosineSimilarity(lyricsResult.lyrics_embedding, refEmb);
                }
              }
            }
          }

          // Recalculate overall with lyrics if available
          const allDimScores: Record<string, number> = {};
          if (refined.melody != null) allDimScores.melody = refined.melody;
          if (refined.harmony != null) allDimScores.harmony = refined.harmony;
          if (refined.rhythm != null) allDimScores.rhythm = refined.rhythm;
          if (refined.timbre != null) allDimScores.timbre = refined.timbre;
          if (scoreLyrics != null) allDimScores.lyrics = scoreLyrics;

          const { DIMENSION_WEIGHTS } = await import("@/lib/comparison/scoring");
          let wSum = 0, wTotal = 0;
          for (const [d, s] of Object.entries(allDimScores)) {
            const w = DIMENSION_WEIGHTS[d] || 0.1;
            wSum += s * w;
            wTotal += w;
          }
          const recalcOverall = wTotal > 0 ? wSum / wTotal : refined.overall;

          // Compute genre-adjusted scores
          const { computeAdjustedScore } = await import("@/lib/scoring/adjusted-scoring");
          const adjustedResult = computeAdjustedScore(
            {
              melody: refined.melody,
              harmony: refined.harmony,
              rhythm: refined.rhythm,
              timbre: refined.timbre,
              lyrics: scoreLyrics,
            },
            genreResult,
            null,
          );

          await supabase.from("analysis_matches").update({
            score_melody: refined.melody,
            score_harmony: refined.harmony,
            score_rhythm: refined.rhythm,
            score_timbre: refined.timbre,
            score_lyrics: scoreLyrics,
            score_overall: recalcOverall,
            score_melody_adjusted: adjustedResult.adjustedScores.melody,
            score_harmony_adjusted: adjustedResult.adjustedScores.harmony,
            score_rhythm_adjusted: adjustedResult.adjustedScores.rhythm,
            score_timbre_adjusted: adjustedResult.adjustedScores.timbre,
            score_lyrics_adjusted: adjustedResult.adjustedScores.lyrics,
            score_overall_adjusted: adjustedResult.overallAdjusted,
            detected_genre: adjustedResult.genreUsed,
            genre_confidence: adjustedResult.genreConfidence,
            risk_level: classifyRiskFromScore(recalcOverall),
            dtw_alignment: refined.dtw_summary,
            temporal_offset_sec: refined.temporal_offset,
          }).eq("id", match.id);
        }

        // Update overall analysis risk with refined scores
        const { data: topMatch } = await supabase
          .from("analysis_matches")
          .select("risk_level, score_overall")
          .eq("analysis_id", analysisId)
          .order("score_overall", { ascending: false })
          .limit(1)
          .single();

        const overallRisk = topMatch?.risk_level ?? "low";
        const overallScore = topMatch?.score_overall ?? 0;

        await supabase.from("analyses").update({
          overall_risk: overallRisk,
          overall_score: overallScore,
        }).eq("id", analysisId);

        await logAudit({
          userId,
          analysisId,
          action: "step_completed:compare",
          hash: matchesResult.searchHash,
          metadata: {
            matches_compared: matches?.length ?? 0,
            evidence_points: totalEvidence,
            overall_risk: overallRisk,
            overall_score: overallScore,
          },
        });

        return { evidenceCount: totalEvidence, overallRisk, overallScore };
      },
    );

    // ── Step 8: Rights Enrichment (MusicBrainz) ─────────────────────────
    const enrichResult = await step.run(
      "enrich-rights",
      { retries: MAX_RETRIES },
      async () => {
        await logAudit({
          userId,
          analysisId,
          action: "step_started:enrich",
          hash: matchesResult.searchHash,
        });

        if (matchesResult.matchCount === 0) {
          await logAudit({
            userId,
            analysisId,
            action: "step_completed:enrich",
            hash: matchesResult.searchHash,
            metadata: { skipped: true, reason: "no_matches" },
          });
          return { enrichedCount: 0 };
        }

        const supabase = createAdminClient();

        const { data: matches } = await supabase
          .from("analysis_matches")
          .select("id, reference_track_id, compared_analysis_id")
          .eq("analysis_id", analysisId);

        let enrichedCount = 0;

        for (const match of matches ?? []) {
          if (!match.reference_track_id) continue;

          // Get reference track metadata
          const { data: refTrack } = await supabase
            .from("reference_tracks")
            .select("musicbrainz_id, isrc")
            .eq("id", match.reference_track_id)
            .single();

          if (!refTrack?.musicbrainz_id && !refTrack?.isrc) continue;

          try {
            const { enrichMatchRights } = await import("@/lib/musicbrainz");
            const rightsInfo = await enrichMatchRights(
              refTrack.musicbrainz_id,
              refTrack.isrc,
            );

            if (rightsInfo) {
              await supabase.from("analysis_matches").update({
                rights_holders: rightsInfo,
              }).eq("id", match.id);
              enrichedCount++;
            }
          } catch (err) {
            console.error(`MusicBrainz lookup failed for match ${match.id}:`, err);
          }
        }

        await logAudit({
          userId,
          analysisId,
          action: "step_completed:enrich",
          hash: matchesResult.searchHash,
          metadata: { enriched_count: enrichedCount },
        });

        return { enrichedCount };
      },
    );

    // ── Step 9: Report Generation (Claude API) ──────────────────────────
    const reportResult = await step.run(
      "generate-report",
      { retries: MAX_RETRIES },
      async () => {
        await updateAnalysisStatus(analysisId, "classifying");
        await logAudit({
          userId,
          analysisId,
          action: "step_started:report",
          hash: matchesResult.searchHash,
        });

        const supabase = createAdminClient();

        // Fetch analysis data for report
        const { data: analysis, error: analysisError } = await supabase
          .from("analyses")
          .select("*")
          .eq("id", analysisId)
          .single();

        if (analysisError || !analysis) {
          throw new Error(`Analysis ${analysisId} not found for report generation: ${analysisError?.message}`);
        }

        const { data: matches } = await supabase
          .from("analysis_matches")
          .select("*")
          .eq("analysis_id", analysisId)
          .order("score_overall", { ascending: false });

        // Fetch evidence for each match
        const matchesWithEvidence = [];
        for (const match of matches ?? []) {
          const { data: evidence } = await supabase
            .from("match_evidence")
            .select("*")
            .eq("match_id", match.id)
            .order("similarity_score", { ascending: false });

          // Get reference track info
          let refTitle = "Unknown Track";
          let refArtist = "Unknown Artist";
          if (match.reference_track_id) {
            const { data: ref } = await supabase
              .from("reference_tracks")
              .select("title, artist")
              .eq("id", match.reference_track_id)
              .single();
            if (ref) { refTitle = ref.title; refArtist = ref.artist; }
          }

          matchesWithEvidence.push({
            id: match.id,
            referenceTitle: refTitle,
            referenceArtist: refArtist,
            scoreOverall: match.score_overall,
            scoreMelody: match.score_melody,
            scoreHarmony: match.score_harmony,
            scoreRhythm: match.score_rhythm,
            scoreTimbre: match.score_timbre,
            scoreLyrics: match.score_lyrics,
            riskLevel: match.risk_level,
            rightsHolders: match.rights_holders,
            evidencePoints: (evidence ?? []).map((e: Record<string, unknown>) => ({
              dimension: e.dimension,
              similarity: e.similarity_score,
              sourceStart: e.source_start_sec,
              sourceEnd: e.source_end_sec,
              targetStart: e.target_start_sec,
              targetEnd: e.target_end_sec,
              description: e.description,
              detail: e.detail ?? {},
            })),
          });
        }

        // Generate report using Claude (or template fallback)
        const { generateReport } = await import("@/lib/report/generate-narrative");
        const features = analysis?.features as Record<string, unknown> | null;

        const report = await generateReport({
          analysisId,
          fileName: analysis?.file_name ?? "Unknown",
          durationSec: analysis?.file_duration_sec ?? 0,
          tempoBpm: (features?.rhythm as Record<string, unknown>)?.estimatedTempoBpm as number ?? null,
          key: (features?.key as Record<string, unknown>)?.key as string ?? null,
          overallRisk: analysis?.overall_risk ?? "low",
          overallScore: analysis?.overall_score ?? 0,
          matchCount: matches?.length ?? 0,
          pipelineVersion: PIPELINE_VERSION,
          matches: matchesWithEvidence,
        });

        // Save narrative to analysis
        await supabase.from("analyses").update({
          report_narrative: report.fullNarrative,
        }).eq("id", analysisId);

        // Save full report to Storage
        const { uploadJsonToStorage } = await import("@/lib/storage");
        const reportPath = `${userId}/${analysisId}/report/report.json`;
        await uploadJsonToStorage(reportPath, report);

        await logAudit({
          userId,
          analysisId,
          action: "step_completed:report",
          hash: matchesResult.searchHash,
          metadata: {
            report_sections: Object.keys(report).length,
            matches_reported: matchesWithEvidence.length,
            llm_used: !!process.env.ANTHROPIC_API_KEY,
          },
        });

        return report;
      },
    );

    // ── Step 10: Finalize ────────────────────────────────────────────────
    const finalResult = await step.run(
      "finalize",
      { retries: MAX_RETRIES },
      async () => {
        const supabase = createAdminClient();
        const completedAt = new Date().toISOString();

        // Self-seed reference library
        let referenceTrackId: string | null = null;
        try {
          const { addToReferenceLibrary } = await import("@/lib/reference/self-seed");
          referenceTrackId = await addToReferenceLibrary(analysisId);
        } catch { /* non-fatal */ }

        // Compute final hash
        const { data: finalAnalysis } = await supabase
          .from("analyses")
          .select("file_hash, overall_risk, overall_score, match_count")
          .eq("id", analysisId)
          .single();

        if (!finalAnalysis) {
          throw new Error(`Analysis ${analysisId} not found for finalization`);
        }

        const finalHashInput = [
          analysisId,
          finalAnalysis.file_hash,
          finalAnalysis.overall_risk,
          String(finalAnalysis.overall_score ?? 0),
          String(finalAnalysis.match_count ?? 0),
          PIPELINE_VERSION,
        ].join("|");

        const { createHash } = await import("node:crypto");
        const finalHash = createHash("sha256").update(finalHashInput).digest("hex");

        // Mark complete
        await supabase.from("analyses").update({
          status: "completed",
          current_step: "Analysis complete",
          progress_pct: 100,
          final_hash: finalHash,
          completed_at: completedAt,
        }).eq("id", analysisId);

        await logAudit({
          userId,
          analysisId,
          action: "step_completed:finalize",
          hash: finalHash,
          metadata: {
            pipeline_version: PIPELINE_VERSION,
            overall_risk: finalAnalysis?.overall_risk,
            overall_score: finalAnalysis?.overall_score,
            self_seeded: !!referenceTrackId,
            completed_at: completedAt,
          },
        });

        return { analysisId, finalHash, completedAt };
      },
    );

    return finalResult;
  },
);
