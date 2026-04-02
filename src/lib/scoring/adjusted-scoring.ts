/**
 * PROBATIO — Genre-Adjusted Scoring Engine
 *
 * Normalizes raw similarity scores against genre-specific baselines.
 * Formula: adjusted = (raw - baseline) / (1 - baseline)
 *
 * This transforms scores so that:
 *   0.0 = genre-typical similarity (expected between any two tracks in the genre)
 *   1.0 = identical (perfect match)
 *   negative → clamped to 0.0 (below genre baseline)
 *
 * The adjusted score is what determines risk classification. The raw score
 * is preserved for transparency — expert witnesses need to see both.
 */

import { DIMENSION_WEIGHTS } from "@/lib/comparison/scoring";
import { getGenreProfile, type GenreProfile } from "./genre-profiles";
import type { GenreDetection } from "./genre-detector";

// ────────────────────────────────────────────────────────────────────────────
// Types
// ────────────────────────────────────────────────────────────────────────────

export interface DimensionScores {
  melody: number | null;
  harmony: number | null;
  rhythm: number | null;
  timbre: number | null;
  lyrics: number | null;
}

export interface AdjustedScoreResult {
  rawScores: DimensionScores;
  adjustedScores: DimensionScores;
  genreUsed: string;
  genreConfidence: number;
  overallRaw: number;
  overallAdjusted: number;
  riskLevel: string;
  baselineUsed: DimensionScores;
}

// ────────────────────────────────────────────────────────────────────────────
// Core adjustment
// ────────────────────────────────────────────────────────────────────────────

/**
 * Adjust a single raw score against a genre baseline.
 * adjusted = (raw - baseline) / (1 - baseline), clamped to [0, 1].
 */
function adjustScore(raw: number | null, baseline: number): number | null {
  if (raw == null) return null;
  if (baseline >= 1.0) return raw; // degenerate case — no adjustment
  const adjusted = (raw - baseline) / (1 - baseline);
  return Math.max(0, Math.min(1, adjusted));
}

/**
 * Compute weighted average of dimension scores, handling nulls
 * by proportional weight redistribution.
 */
function weightedAverage(scores: DimensionScores): number {
  const dims: Array<keyof DimensionScores> = [
    "melody",
    "harmony",
    "rhythm",
    "timbre",
    "lyrics",
  ];
  let weightedSum = 0;
  let weightTotal = 0;

  for (const dim of dims) {
    const score = scores[dim];
    if (score == null) continue;
    const weight = DIMENSION_WEIGHTS[dim] ?? 0;
    if (weight === 0) continue;
    weightedSum += score * weight;
    weightTotal += weight;
  }

  return weightTotal > 0 ? weightedSum / weightTotal : 0;
}

/**
 * Classify risk from an adjusted overall score.
 * Uses the same thresholds as risk-classifier.ts:
 *   low: 0.00-0.40, moderate: 0.40-0.70, high: 0.70-0.85, critical: 0.85+
 */
function classifyRiskFromAdjusted(score: number): string {
  if (score >= 0.85) return "critical";
  if (score >= 0.70) return "high";
  if (score >= 0.40) return "moderate";
  return "low";
}

// ────────────────────────────────────────────────────────────────────────────
// Main engine
// ────────────────────────────────────────────────────────────────────────────

/**
 * Select the appropriate genre profile when two tracks may be different genres.
 * Strategy:
 *   - If same genre: use that genre's profile
 *   - If different genres: average the baselines (conservative — doesn't
 *     penalize cross-genre comparison)
 *   - Use the higher-confidence detection
 */
function resolveGenreProfile(
  genreA: GenreDetection,
  genreB: GenreDetection | null,
): { genreId: string; confidence: number; profile: GenreProfile } {
  const profileA = getGenreProfile(genreA.primary);

  if (!genreB) {
    return {
      genreId: genreA.primary,
      confidence: genreA.confidence,
      profile: profileA,
    };
  }

  if (genreA.primary === genreB.primary) {
    // Same genre — use that profile with higher confidence
    return {
      genreId: genreA.primary,
      confidence: Math.max(genreA.confidence, genreB.confidence),
      profile: profileA,
    };
  }

  // Different genres — average baselines for conservative adjustment
  const profileB = getGenreProfile(genreB.primary);
  const avgBaseline: GenreProfile["baselineSimilarity"] = {
    melody:
      (profileA.baselineSimilarity.melody + profileB.baselineSimilarity.melody) /
      2,
    harmony:
      (profileA.baselineSimilarity.harmony +
        profileB.baselineSimilarity.harmony) /
      2,
    rhythm:
      (profileA.baselineSimilarity.rhythm + profileB.baselineSimilarity.rhythm) /
      2,
    timbre:
      (profileA.baselineSimilarity.timbre + profileB.baselineSimilarity.timbre) /
      2,
    lyrics:
      (profileA.baselineSimilarity.lyrics + profileB.baselineSimilarity.lyrics) /
      2,
  };

  // Pick the genre with higher confidence for labeling
  const bestGenre =
    genreA.confidence >= genreB.confidence ? genreA : genreB;

  return {
    genreId: bestGenre.primary,
    confidence: bestGenre.confidence,
    profile: {
      ...getGenreProfile(bestGenre.primary),
      baselineSimilarity: avgBaseline,
    },
  };
}

/**
 * Compute genre-adjusted scores from raw dimension scores.
 *
 * @param rawScores   Raw similarity scores per dimension (0-1)
 * @param genreA      Genre detection result for Track A
 * @param genreB      Genre detection result for Track B (null if unknown)
 * @returns           Adjusted scores, risk classification, and context
 */
export function computeAdjustedScore(
  rawScores: DimensionScores,
  genreA: GenreDetection,
  genreB: GenreDetection | null = null,
): AdjustedScoreResult {
  const { genreId, confidence, profile } = resolveGenreProfile(
    genreA,
    genreB,
  );
  const baseline = profile.baselineSimilarity;

  const adjustedScores: DimensionScores = {
    melody: adjustScore(rawScores.melody, baseline.melody),
    harmony: adjustScore(rawScores.harmony, baseline.harmony),
    rhythm: adjustScore(rawScores.rhythm, baseline.rhythm),
    timbre: adjustScore(rawScores.timbre, baseline.timbre),
    lyrics: adjustScore(rawScores.lyrics, baseline.lyrics),
  };

  const overallRaw = weightedAverage(rawScores);
  const overallAdjusted = weightedAverage(adjustedScores);

  return {
    rawScores,
    adjustedScores,
    genreUsed: genreId,
    genreConfidence: confidence,
    overallRaw,
    overallAdjusted,
    riskLevel: classifyRiskFromAdjusted(overallAdjusted),
    baselineUsed: {
      melody: baseline.melody,
      harmony: baseline.harmony,
      rhythm: baseline.rhythm,
      timbre: baseline.timbre,
      lyrics: baseline.lyrics,
    },
  };
}
