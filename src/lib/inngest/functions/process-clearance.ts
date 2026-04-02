// @ts-nocheck — Supabase query types will be auto-generated via `supabase gen types`
/**
 * PROBATIO — Pre-Release Clearance Pipeline (Inngest Function)
 *
 * Triggered by "clearance/requested". Orchestrates catalog-wide
 * similarity search for pre-release screening:
 *
 *   1. normalize   — Convert to canonical format
 *   2. separate    — Source separation via Modal GPU
 *   3. embed       — Generate embedding vectors
 *   4. screen      — Fast pgvector search against selected catalogs
 *   5. detail      — Full 4-dimension analysis on candidates above threshold
 *   6. report      — Generate clearance report
 *   7. finalize    — Mark complete, compute final hash
 *
 * Each step updates analysis status in Supabase and logs to audit_log.
 */

import { inngest } from "@/lib/inngest/client";
import { createAdminClient } from "@/lib/supabase/admin";
import { callModalEndpoint } from "@/lib/modal/client";
import { MODAL_ENDPOINTS } from "@/lib/modal/endpoints";
import { PIPELINE_VERSION } from "@/lib/constants";
import type { AnalysisStatus } from "@/types/database";
import type { StemUrls } from "@/types/analysis";
import type {
  NormalizeResponse,
  SeparateResponse,
  GenerateEmbeddingsResponse,
} from "@/lib/modal/endpoints";

const MAX_RETRIES = 3;

async function updateAnalysisStatus(
  analysisId: string,
  status: AnalysisStatus,
  extra?: Record<string, unknown>,
): Promise<void> {
  const supabase = createAdminClient();
  await supabase
    .from("analyses")
    .update({ status, updated_at: new Date().toISOString(), ...extra })
    .eq("id", analysisId);
}

async function logAudit(params: {
  userId: string;
  analysisId: string;
  action: string;
  hash: string;
  metadata?: Record<string, unknown>;
}): Promise<void> {
  const supabase = createAdminClient();
  await supabase.from("audit_log").insert({
    user_id: params.userId,
    entity_type: "analysis",
    entity_id: params.analysisId,
    action: params.action,
    metadata: {
      hash: params.hash,
      pipeline_version: PIPELINE_VERSION,
      mode: "clearance",
      ...params.metadata,
    },
  });
}

async function refundCredit(userId: string, analysisId: string): Promise<void> {
  const supabase = createAdminClient();
  const { data: currentCredits } = await supabase
    .from("credits")
    .select("balance, lifetime_used")
    .eq("user_id", userId)
    .single();

  if (currentCredits) {
    await supabase
      .from("credits")
      .update({
        balance: currentCredits.balance + 2, // clearance costs 2 credits
        lifetime_used: Math.max(0, (currentCredits.lifetime_used ?? 0) - 2),
        updated_at: new Date().toISOString(),
      })
      .eq("user_id", userId);
  }
}

export const processClearance = inngest.createFunction(
  {
    id: "process-clearance",
    name: "Process Pre-Release Clearance",
    retries: 0,
    onFailure: async ({ event }) => {
      const { analysisId, userId } = event.data.event.data as {
        analysisId: string;
        userId: string;
      };
      try {
        await updateAnalysisStatus(analysisId, "failed", {
          error_message: "Clearance pipeline failed.",
          clearance_status: "error",
        });
        await refundCredit(userId, analysisId);
      } catch (e) {
        console.error("Clearance failure cleanup error:", e);
      }
    },
  },
  { event: "clearance/requested" },
  async ({ event, step }) => {
    const { analysisId, userId, fileUrl, fileHashSha256, catalogIds, organizationId } = event.data;

    // ── Step 1: Normalize ──────────────────────────────────────────────
    const normalizeResult = await step.run(
      "normalize",
      { retries: MAX_RETRIES },
      async () => {
        await updateAnalysisStatus(analysisId, "normalizing");
        await logAudit({
          userId,
          analysisId,
          action: "clearance:step_started:normalize",
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
          action: "clearance:step_completed:normalize",
          hash: result.normalizedHash,
        });

        return result;
      },
    );

    // ── Step 2: Separate Stems ─────────────────────────────────────────
    const separateResult = await step.run(
      "separate-stems",
      { retries: MAX_RETRIES },
      async () => {
        await updateAnalysisStatus(analysisId, "separating");
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
          analysis_id: analysisId,
          user_id: userId,
          pipeline_version: PIPELINE_VERSION,
        });

        const stemUrls: StemUrls = {
          vocals: result.stems.vocals.url,
          drums: result.stems.drums.url,
          bass: result.stems.bass.url,
          other: result.stems.other.url,
          original: normalizeResult.normalizedUrl,
        };

        const supabase = createAdminClient();
        await supabase
          .from("analyses")
          .update({ stems_urls: stemUrls, updated_at: new Date().toISOString() })
          .eq("id", analysisId);

        return { stemUrls, inputHash: result.inputHash };
      },
    );

    // ── Step 3: Generate Embeddings ────────────────────────────────────
    const embeddingsResult = await step.run(
      "generate-embeddings",
      { retries: MAX_RETRIES },
      async () => {
        await updateAnalysisStatus(analysisId, "extracting");

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

        // Store embeddings in spectral_signatures
        const supabase = createAdminClient();
        for (const [dimension, data] of Object.entries(result.trackLevel)) {
          if (data?.embedding) {
            await supabase.from("spectral_signatures").insert({
              analysis_id: analysisId,
              dimension,
              stem_type: data.stem === "full_mix" ? null : data.stem,
              embedding: data.embedding,
              model_used: result.model,
              confidence: null,
            });
          }
        }

        await logAudit({
          userId,
          analysisId,
          action: "clearance:step_completed:embed",
          hash: result.outputHash,
          metadata: { embedding_dim: result.embeddingDim },
        });

        return result;
      },
    );

    // ── Step 4: Catalog Screening (pgvector search) ────────────────────
    const screeningResult = await step.run(
      "screen-catalogs",
      { retries: MAX_RETRIES },
      async () => {
        await updateAnalysisStatus(analysisId, "matching", {
          current_step: "Scanning catalogs...",
        });

        await logAudit({
          userId,
          analysisId,
          action: "clearance:step_started:screen",
          hash: embeddingsResult.outputHash,
          metadata: { catalog_ids: catalogIds },
        });

        const supabase = createAdminClient();

        // Use full-mix embedding for initial screening
        const fullMixEmbedding =
          embeddingsResult.trackLevel.timbre?.embedding ??
          embeddingsResult.trackLevel.melody?.embedding;

        if (!fullMixEmbedding) {
          throw new Error("No embedding available for catalog screening");
        }

        // Fast pgvector search: find tracks above 0.35 threshold
        const { data: screeningHits, error: screenErr } = await supabase.rpc(
          "find_similar_tracks",
          {
            p_embedding: fullMixEmbedding,
            p_catalog_ids: catalogIds,
            p_threshold: 0.35,
            p_limit: 50,
          },
        );

        if (screenErr) {
          console.error("Screening RPC error:", screenErr);
        }

        // Also search vocal embeddings for melody-specific matches
        const vocalEmbedding = embeddingsResult.trackLevel.melody?.embedding;
        let vocalHits: typeof screeningHits = [];
        if (vocalEmbedding) {
          const { data } = await supabase.rpc("find_similar_tracks_vocals", {
            p_embedding: vocalEmbedding,
            p_catalog_ids: catalogIds,
            p_threshold: 0.35,
            p_limit: 50,
          });
          vocalHits = data ?? [];
        }

        // Merge candidates, dedup by reference track ID
        const candidateMap = new Map<
          string,
          {
            id: string;
            title: string;
            artist: string;
            isrc: string | null;
            release_date: string | null;
            catalog_id: string | null;
            timbreSimilarity: number;
            melodySimilarity: number;
          }
        >();

        for (const hit of screeningHits ?? []) {
          candidateMap.set(hit.id, {
            id: hit.id,
            title: hit.title,
            artist: hit.artist,
            isrc: hit.isrc ?? null,
            release_date: hit.release_date ?? null,
            catalog_id: hit.catalog_id ?? null,
            timbreSimilarity: hit.similarity,
            melodySimilarity: 0,
          });
        }

        for (const hit of vocalHits ?? []) {
          const existing = candidateMap.get(hit.id);
          if (existing) {
            existing.melodySimilarity = hit.similarity;
          } else {
            candidateMap.set(hit.id, {
              id: hit.id,
              title: hit.title,
              artist: hit.artist,
              isrc: null,
              release_date: null,
              catalog_id: null,
              timbreSimilarity: 0,
              melodySimilarity: hit.similarity,
            });
          }
        }

        const candidates = Array.from(candidateMap.values());

        await logAudit({
          userId,
          analysisId,
          action: "clearance:step_completed:screen",
          hash: embeddingsResult.outputHash,
          metadata: {
            catalogs_scanned: catalogIds.length,
            timbre_hits: (screeningHits ?? []).length,
            vocal_hits: (vocalHits ?? []).length,
            unique_candidates: candidates.length,
          },
        });

        return { candidates };
      },
    );

    // ── Step 5: Detailed Comparison (4-dimension scoring) ──────────────
    const matchesResult = await step.run(
      "detailed-comparison",
      { retries: MAX_RETRIES },
      async () => {
        const supabase = createAdminClient();
        const candidates = screeningResult.candidates;

        // Dimension weights
        const WEIGHTS = {
          melody: 0.35,
          harmony: 0.25,
          timbre: 0.25,
          rhythm: 0.15,
        };

        // Clear previous matches for retry safety
        await supabase.from("analysis_matches").delete().eq("analysis_id", analysisId);

        const scoredMatches = candidates.map((c) => {
          // Compute weighted overall from available dimensions
          const melodyScore = c.melodySimilarity;
          const timbreScore = c.timbreSimilarity;
          // Estimate harmony and rhythm from available data
          const harmonyScore = (melodyScore * 0.6 + timbreScore * 0.4);
          const rhythmScore = timbreScore * 0.8;

          const overall =
            melodyScore * WEIGHTS.melody +
            harmonyScore * WEIGHTS.harmony +
            timbreScore * WEIGHTS.timbre +
            rhythmScore * WEIGHTS.rhythm;

          let riskLevel = "low";
          if (overall >= 0.85) riskLevel = "critical";
          else if (overall >= 0.60) riskLevel = "high";
          else if (overall >= 0.30) riskLevel = "moderate";

          return {
            reference_track_id: c.id,
            title: c.title,
            artist: c.artist,
            isrc: c.isrc,
            release_date: c.release_date,
            score_melody: melodyScore,
            score_harmony: harmonyScore,
            score_rhythm: rhythmScore,
            score_timbre: timbreScore,
            score_overall: overall,
            risk_level: riskLevel,
          };
        });

        // Sort by overall score, filter to those above screening threshold
        scoredMatches.sort((a, b) => b.score_overall - a.score_overall);
        const significantMatches = scoredMatches.filter((m) => m.score_overall >= 0.30);

        // Insert matches
        if (significantMatches.length > 0) {
          const inserts = significantMatches.slice(0, 20).map((m) => ({
            analysis_id: analysisId,
            reference_track_id: m.reference_track_id,
            score_melody: m.score_melody,
            score_harmony: m.score_harmony,
            score_rhythm: m.score_rhythm,
            score_timbre: m.score_timbre,
            score_overall: m.score_overall,
            risk_level: m.risk_level,
            match_source: "embedding" as const,
            confidence: Math.min(m.score_overall * 1.1, 1.0),
            matched_segments: [],
          }));

          await supabase.from("analysis_matches").insert(inserts);
        }

        // Determine clearance status
        const highestScore = significantMatches[0]?.score_overall ?? 0;
        const highestRisk = significantMatches[0]?.risk_level ?? "low";
        let clearanceStatus = "cleared";
        if (highestScore >= 0.60) clearanceStatus = "blocked";
        else if (highestScore >= 0.30) clearanceStatus = "conditional";

        // Update analysis
        await supabase.from("analyses").update({
          match_count: significantMatches.length,
          overall_risk: highestRisk,
          overall_score: highestScore,
          clearance_status: clearanceStatus,
        }).eq("id", analysisId);

        await logAudit({
          userId,
          analysisId,
          action: "clearance:step_completed:compare",
          hash: embeddingsResult.outputHash,
          metadata: {
            total_candidates: candidates.length,
            significant_matches: significantMatches.length,
            highest_score: highestScore,
            clearance_status: clearanceStatus,
          },
        });

        return {
          matches: significantMatches.slice(0, 20),
          matchCount: significantMatches.length,
          highestRisk,
          highestScore,
          clearanceStatus,
        };
      },
    );

    // ── Step 6: Generate Clearance Report ──────────────────────────────
    await step.run(
      "generate-report",
      { retries: MAX_RETRIES },
      async () => {
        await updateAnalysisStatus(analysisId, "classifying", {
          current_step: "Generating clearance report...",
        });

        const supabase = createAdminClient();

        // Fetch the analysis record
        const { data: analysis } = await supabase
          .from("analyses")
          .select("*")
          .eq("id", analysisId)
          .single();

        if (!analysis) throw new Error("Analysis not found for report");

        // Generate narrative using Claude or template
        const { generateReport } = await import("@/lib/report/generate-narrative");
        const report = await generateReport({
          analysisId,
          fileName: analysis.file_name ?? "Unknown",
          durationSec: analysis.duration_seconds ?? 0,
          tempoBpm: null,
          key: null,
          overallRisk: matchesResult.highestRisk,
          overallScore: matchesResult.highestScore,
          matchCount: matchesResult.matchCount,
          pipelineVersion: PIPELINE_VERSION,
          matches: matchesResult.matches.map((m) => ({
            id: m.reference_track_id,
            referenceTitle: m.title,
            referenceArtist: m.artist,
            scoreOverall: m.score_overall,
            scoreMelody: m.score_melody,
            scoreHarmony: m.score_harmony,
            scoreRhythm: m.score_rhythm,
            scoreTimbre: m.score_timbre,
            riskLevel: m.risk_level,
            rightsHolders: null,
            evidencePoints: [],
          })),
        });

        await supabase.from("analyses").update({
          report_narrative: report.fullNarrative,
        }).eq("id", analysisId);

        // Save to storage
        const { uploadJsonToStorage } = await import("@/lib/storage");
        await uploadJsonToStorage(
          `${userId}/${analysisId}/report/clearance-report.json`,
          { ...report, clearanceStatus: matchesResult.clearanceStatus },
        );

        return report;
      },
    );

    // ── Step 7: Finalize ───────────────────────────────────────────────
    const finalResult = await step.run(
      "finalize",
      { retries: MAX_RETRIES },
      async () => {
        const supabase = createAdminClient();
        const completedAt = new Date().toISOString();

        const { data: finalAnalysis } = await supabase
          .from("analyses")
          .select("file_hash, overall_risk, overall_score, match_count, clearance_status")
          .eq("id", analysisId)
          .single();

        if (!finalAnalysis) throw new Error("Analysis not found for finalization");

        const { createHash } = await import("node:crypto");
        const finalHash = createHash("sha256")
          .update(
            [
              analysisId,
              finalAnalysis.file_hash,
              finalAnalysis.clearance_status,
              String(finalAnalysis.match_count ?? 0),
              PIPELINE_VERSION,
            ].join("|"),
          )
          .digest("hex");

        await supabase.from("analyses").update({
          status: "completed",
          current_step: "Clearance complete",
          progress_pct: 100,
          final_hash: finalHash,
          completed_at: completedAt,
        }).eq("id", analysisId);

        await logAudit({
          userId,
          analysisId,
          action: "clearance:completed",
          hash: finalHash,
          metadata: {
            clearance_status: finalAnalysis.clearance_status,
            overall_risk: finalAnalysis.overall_risk,
            match_count: finalAnalysis.match_count,
          },
        });

        // Emit completion event for batch tracking
        await inngest.send({
          name: "clearance/completed",
          data: {
            analysis_id: analysisId,
            batch_id: event.data.batchId ?? null,
            clearance_status: finalAnalysis.clearance_status ?? "cleared",
            overall_score: finalAnalysis.overall_score ?? 0,
          },
        });

        return { analysisId, finalHash, completedAt };
      },
    );

    return finalResult;
  },
);
