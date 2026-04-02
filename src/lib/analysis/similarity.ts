/**
 * PROBATIO — Similarity Scoring
 *
 * Functions for computing and aggregating similarity scores
 * across multiple musical dimensions.
 */

import type { SimilarityScore, SimilarityWeights } from "@/types/analysis";

// ────────────────────────────────────────────────────────────────────────────
// Default Weights
// ────────────────────────────────────────────────────────────────────────────

/**
 * Default dimension weights used when computing overall similarity.
 * Melody is weighted highest because melodic similarity is the
 * strongest signal in music copyright case law.
 */
export const DEFAULT_WEIGHTS: Readonly<SimilarityWeights> = {
  melody: 0.35,
  harmony: 0.25,
  rhythm: 0.20,
  structure: 0.20,
} as const;

// ────────────────────────────────────────────────────────────────────────────
// Weighted Score
// ────────────────────────────────────────────────────────────────────────────

/**
 * Compute a weighted aggregate score from individual dimension scores.
 *
 * @param scores   Per-dimension scores (each in [0, 1]).
 * @param weights  Dimension weights (will be normalized to sum to 1).
 * @returns Weighted overall score in [0, 1].
 * @throws {RangeError} If any score is outside [0, 1].
 * @throws {Error} If weights sum to zero.
 */
export function weightedScore(
  scores: Omit<SimilarityScore, "overall">,
  weights: SimilarityWeights = DEFAULT_WEIGHTS,
): number {
  const dimensions = ["melody", "harmony", "rhythm", "structure"] as const;

  // Validate scores
  for (const dim of dimensions) {
    if (scores[dim] < 0 || scores[dim] > 1) {
      throw new RangeError(
        `Score for "${dim}" must be between 0 and 1, received ${scores[dim]}`,
      );
    }
  }

  // Normalize weights so they sum to 1
  const weightSum = dimensions.reduce((sum, dim) => sum + weights[dim], 0);
  if (weightSum === 0) {
    throw new Error("Weights must not all be zero");
  }

  const result = dimensions.reduce(
    (sum, dim) => sum + scores[dim] * (weights[dim] / weightSum),
    0,
  );

  // Clamp to [0, 1] to guard against floating-point drift
  return Math.min(1, Math.max(0, result));
}

// ────────────────────────────────────────────────────────────────────────────
// Overall Similarity
// ────────────────────────────────────────────────────────────────────────────

/**
 * Compute a full {@link SimilarityScore} from raw dimension scores.
 *
 * This is the primary entry point: pass per-dimension scores and
 * optionally override the default weights.
 *
 * @param scores   Per-dimension scores (each in [0, 1]).
 * @param weights  Optional custom weights.
 * @returns Complete {@link SimilarityScore} with computed `overall`.
 */
export function computeOverallSimilarity(
  scores: Omit<SimilarityScore, "overall">,
  weights: SimilarityWeights = DEFAULT_WEIGHTS,
): SimilarityScore {
  return {
    ...scores,
    overall: weightedScore(scores, weights),
  };
}

// ────────────────────────────────────────────────────────────────────────────
// Cosine Similarity
// ────────────────────────────────────────────────────────────────────────────

/**
 * Compute cosine similarity between two equal-length numeric vectors.
 *
 * Returns a value in [-1, 1] where 1 = identical direction,
 * 0 = orthogonal, -1 = opposite direction.
 *
 * @param a  First vector.
 * @param b  Second vector (must be same length as `a`).
 * @returns Cosine similarity.
 * @throws {Error} If vectors have different lengths.
 * @throws {Error} If either vector has zero magnitude.
 */
export function cosineSimilarity(
  a: readonly number[],
  b: readonly number[],
): number {
  if (a.length !== b.length) {
    throw new Error(
      `Vectors must have equal length: a.length=${a.length}, b.length=${b.length}`,
    );
  }
  if (a.length === 0) {
    throw new Error("Vectors must not be empty");
  }

  let dotProduct = 0;
  let magnitudeA = 0;
  let magnitudeB = 0;

  for (let i = 0; i < a.length; i++) {
    dotProduct += a[i] * b[i];
    magnitudeA += a[i] * a[i];
    magnitudeB += b[i] * b[i];
  }

  magnitudeA = Math.sqrt(magnitudeA);
  magnitudeB = Math.sqrt(magnitudeB);

  if (magnitudeA === 0 || magnitudeB === 0) {
    throw new Error("Cannot compute cosine similarity for zero-magnitude vector");
  }

  return dotProduct / (magnitudeA * magnitudeB);
}

// ────────────────────────────────────────────────────────────────────────────
// Euclidean Distance (normalized)
// ────────────────────────────────────────────────────────────────────────────

/**
 * Compute normalized Euclidean distance between two vectors,
 * mapped to a similarity score in [0, 1] where 1 = identical.
 *
 * @param a  First vector.
 * @param b  Second vector (must be same length as `a`).
 * @returns Similarity score in [0, 1].
 */
export function euclideanSimilarity(
  a: readonly number[],
  b: readonly number[],
): number {
  if (a.length !== b.length) {
    throw new Error(
      `Vectors must have equal length: a.length=${a.length}, b.length=${b.length}`,
    );
  }
  if (a.length === 0) {
    throw new Error("Vectors must not be empty");
  }

  let sumSquared = 0;
  for (let i = 0; i < a.length; i++) {
    const diff = a[i] - b[i];
    sumSquared += diff * diff;
  }

  const distance = Math.sqrt(sumSquared);
  // Normalize: 1 / (1 + distance) maps distance to (0, 1]
  return 1 / (1 + distance);
}
