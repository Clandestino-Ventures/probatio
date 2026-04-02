/**
 * PROBATIO — Comparison Scoring Helpers
 *
 * Computes refined scores from segment-level evidence and classifies risk.
 */

import type { MatchDimension } from "@/types/database";

// Dimension weights — melody highest because it's the strongest
// legal indicator of copying in music copyright law
export const DIMENSION_WEIGHTS: Record<string, number> = {
  melody: 0.30,
  harmony: 0.20,
  timbre: 0.15,
  lyrics: 0.20,
  rhythm: 0.15,
};

export interface SegmentEvidence {
  dimension: string;
  similarity_score: number;
  source_start_sec: number;
  source_end_sec: number;
  target_start_sec: number;
  target_end_sec: number;
  detail: Record<string, unknown>;
  description: string;
}

export interface RefinedScores {
  melody: number | null;
  harmony: number | null;
  rhythm: number | null;
  timbre: number | null;
  lyrics: number | null;
  overall: number;
  dtw_summary: Record<string, unknown> | null;
  temporal_offset: number | null;
}

/**
 * Compute refined scores from segment-level evidence.
 * Groups evidence by dimension, averages similarity per dimension,
 * computes weighted overall score.
 */
export function computeRefinedScores(evidence: SegmentEvidence[]): RefinedScores {
  if (evidence.length === 0) {
    return { melody: null, harmony: null, rhythm: null, timbre: null, lyrics: null, overall: 0, dtw_summary: null, temporal_offset: null };
  }

  const byDimension = new Map<string, number[]>();
  for (const e of evidence) {
    if (!byDimension.has(e.dimension)) byDimension.set(e.dimension, []);
    byDimension.get(e.dimension)!.push(e.similarity_score);
  }

  const dimScores: Record<string, number> = {};
  for (const [dim, scores] of byDimension) {
    dimScores[dim] = scores.reduce((a, b) => a + b, 0) / scores.length;
  }

  // Weighted overall
  let weightedSum = 0;
  let weightTotal = 0;
  for (const [dim, score] of Object.entries(dimScores)) {
    const weight = DIMENSION_WEIGHTS[dim] || 0.1;
    weightedSum += score * weight;
    weightTotal += weight;
  }
  const overall = weightTotal > 0 ? weightedSum / weightTotal : 0;

  // Find temporal offset from melody evidence
  const melodyEvidence = evidence.filter(e => e.dimension === "melody");
  let temporalOffset: number | null = null;
  if (melodyEvidence.length > 0) {
    const offsets = melodyEvidence.map(e => e.target_start_sec - e.source_start_sec);
    temporalOffset = offsets.reduce((a, b) => a + b, 0) / offsets.length;
  }

  // DTW summary from melody detail
  const dtwDetail = melodyEvidence.find(e => e.detail?.transposition_semitones !== undefined);

  return {
    melody: dimScores.melody ?? null,
    harmony: dimScores.harmony ?? null,
    rhythm: dimScores.rhythm ?? null,
    timbre: dimScores.timbre ?? null,
    lyrics: dimScores.lyrics ?? null,
    overall,
    dtw_summary: dtwDetail?.detail ?? null,
    temporal_offset: temporalOffset,
  };
}

/**
 * Classify risk level from overall score.
 */
export function classifyRiskFromScore(score: number): string {
  if (score >= 0.85) return "critical";
  if (score >= 0.60) return "high";
  if (score >= 0.30) return "moderate";
  if (score > 0.10) return "low";
  return "clear";
}
