/**
 * PROBATIO — Dynamic Time Warping (DTW)
 *
 * Implementation of the Dynamic Time Warping algorithm for comparing
 * time series of different lengths. Used in forensic audio comparison
 * to align and measure similarity between musical features (pitch
 * contours, chroma sequences, onset patterns, etc.).
 *
 * DTW finds the optimal non-linear alignment between two sequences
 * by minimizing the cumulative distance along a warping path.
 */

// ────────────────────────────────────────────────────────────────────────────
// Types
// ────────────────────────────────────────────────────────────────────────────

/** Result of a DTW computation. */
export interface DTWResult {
  /** The optimal warping path as (i, j) index pairs. */
  path: [number, number][];
  /** Total accumulated distance along the optimal path. */
  totalDistance: number;
  /** Normalized distance (total distance / path length). */
  normalizedDistance: number;
  /** The cost matrix dimensions [rows, cols]. */
  dimensions: [number, number];
}

/**
 * Distance function between two scalar values.
 * Default is absolute difference for 1D time series.
 */
type DistanceFunction = (a: number, b: number) => number;

// ────────────────────────────────────────────────────────────────────────────
// Distance Functions
// ────────────────────────────────────────────────────────────────────────────

/** Absolute difference distance (default for scalar sequences). */
export function absoluteDistance(a: number, b: number): number {
  return Math.abs(a - b);
}

/** Squared Euclidean distance (emphasizes larger differences). */
export function squaredDistance(a: number, b: number): number {
  const diff = a - b;
  return diff * diff;
}

// ────────────────────────────────────────────────────────────────────────────
// DTW Implementation
// ────────────────────────────────────────────────────────────────────────────

/**
 * Compute Dynamic Time Warping between two 1D time series.
 *
 * This is the standard O(n*m) DTW implementation with full cost matrix.
 * For very long sequences (>10,000 frames), consider using the banded
 * variant {@link computeBandedDTW} to reduce memory and computation.
 *
 * @param seriesA       First time series (e.g. pitch contour of Track A).
 * @param seriesB       Second time series (e.g. pitch contour of Track B).
 * @param distanceFn    Distance function between elements (default: absolute difference).
 * @returns A {@link DTWResult} with the optimal path and distance metrics.
 *
 * @throws {Error} If either series is empty.
 */
export function computeDTW(
  seriesA: readonly number[],
  seriesB: readonly number[],
  distanceFn: DistanceFunction = absoluteDistance,
): DTWResult {
  const n = seriesA.length;
  const m = seriesB.length;

  if (n === 0 || m === 0) {
    throw new Error(
      `Both series must be non-empty. Got lengths: seriesA=${n}, seriesB=${m}`,
    );
  }

  // Build the cost matrix.
  // costMatrix[i][j] = minimum cumulative distance to reach (i, j).
  const costMatrix: number[][] = Array.from({ length: n }, () =>
    Array.from({ length: m }, () => Infinity),
  );

  // Initialize the starting cell.
  costMatrix[0][0] = distanceFn(seriesA[0], seriesB[0]);

  // Fill the first column.
  for (let i = 1; i < n; i++) {
    costMatrix[i][0] =
      costMatrix[i - 1][0] + distanceFn(seriesA[i], seriesB[0]);
  }

  // Fill the first row.
  for (let j = 1; j < m; j++) {
    costMatrix[0][j] =
      costMatrix[0][j - 1] + distanceFn(seriesA[0], seriesB[j]);
  }

  // Fill the rest of the matrix.
  for (let i = 1; i < n; i++) {
    for (let j = 1; j < m; j++) {
      const cost = distanceFn(seriesA[i], seriesB[j]);
      costMatrix[i][j] =
        cost +
        Math.min(
          costMatrix[i - 1][j],     // insertion
          costMatrix[i][j - 1],     // deletion
          costMatrix[i - 1][j - 1], // match
        );
    }
  }

  // Backtrack to find the optimal warping path.
  const path = backtrack(costMatrix, n, m);
  const totalDistance = costMatrix[n - 1][m - 1];
  const normalizedDistance = totalDistance / path.length;

  return {
    path,
    totalDistance,
    normalizedDistance,
    dimensions: [n, m],
  };
}

/**
 * Compute banded DTW with a Sakoe-Chiba band constraint.
 *
 * Restricts the warping path to stay within `bandWidth` cells of the
 * diagonal, reducing computation from O(n*m) to O(n*bandWidth).
 * Useful for long sequences where full DTW is too expensive.
 *
 * @param seriesA     First time series.
 * @param seriesB     Second time series.
 * @param bandWidth   Maximum deviation from the diagonal (in cells).
 * @param distanceFn  Distance function between elements.
 * @returns A {@link DTWResult} with the optimal path and distance metrics.
 */
export function computeBandedDTW(
  seriesA: readonly number[],
  seriesB: readonly number[],
  bandWidth: number,
  distanceFn: DistanceFunction = absoluteDistance,
): DTWResult {
  const n = seriesA.length;
  const m = seriesB.length;

  if (n === 0 || m === 0) {
    throw new Error(
      `Both series must be non-empty. Got lengths: seriesA=${n}, seriesB=${m}`,
    );
  }

  const band = Math.max(bandWidth, Math.abs(n - m));

  // Build cost matrix with band constraint.
  const costMatrix: number[][] = Array.from({ length: n }, () =>
    Array.from({ length: m }, () => Infinity),
  );

  costMatrix[0][0] = distanceFn(seriesA[0], seriesB[0]);

  for (let i = 0; i < n; i++) {
    const jMin = Math.max(0, i - band);
    const jMax = Math.min(m - 1, i + band);

    for (let j = jMin; j <= jMax; j++) {
      if (i === 0 && j === 0) continue;

      const cost = distanceFn(seriesA[i], seriesB[j]);
      const candidates: number[] = [];

      if (i > 0) candidates.push(costMatrix[i - 1][j]);
      if (j > 0) candidates.push(costMatrix[i][j - 1]);
      if (i > 0 && j > 0) candidates.push(costMatrix[i - 1][j - 1]);

      costMatrix[i][j] =
        cost + (candidates.length > 0 ? Math.min(...candidates) : 0);
    }
  }

  const path = backtrack(costMatrix, n, m);
  const totalDistance = costMatrix[n - 1][m - 1];
  const normalizedDistance = totalDistance / path.length;

  return {
    path,
    totalDistance,
    normalizedDistance,
    dimensions: [n, m],
  };
}

// ────────────────────────────────────────────────────────────────────────────
// Backtracking
// ────────────────────────────────────────────────────────────────────────────

/**
 * Backtrack through the cost matrix to find the optimal warping path.
 *
 * Starting from (n-1, m-1), greedily steps to the cell with minimum cost
 * among the three predecessors (diagonal, left, below) until reaching (0, 0).
 */
function backtrack(
  costMatrix: readonly (readonly number[])[],
  n: number,
  m: number,
): [number, number][] {
  const path: [number, number][] = [];
  let i = n - 1;
  let j = m - 1;

  path.push([i, j]);

  while (i > 0 || j > 0) {
    if (i === 0) {
      j--;
    } else if (j === 0) {
      i--;
    } else {
      const diagonal = costMatrix[i - 1][j - 1];
      const left = costMatrix[i][j - 1];
      const below = costMatrix[i - 1][j];

      if (diagonal <= left && diagonal <= below) {
        i--;
        j--;
      } else if (left <= below) {
        j--;
      } else {
        i--;
      }
    }

    path.push([i, j]);
  }

  // Reverse to get path from start to end.
  path.reverse();
  return path;
}

// ────────────────────────────────────────────────────────────────────────────
// Multi-dimensional DTW Helper
// ────────────────────────────────────────────────────────────────────────────

/**
 * Compute DTW on multi-dimensional time series (e.g. chroma vectors).
 *
 * Each element of the series is a vector (number array). The distance
 * between two vectors is computed as the Euclidean distance.
 *
 * @param seriesA  First multi-dimensional time series.
 * @param seriesB  Second multi-dimensional time series.
 * @returns A {@link DTWResult} with the optimal path and distance metrics.
 */
export function computeMultiDimensionalDTW(
  seriesA: readonly (readonly number[])[],
  seriesB: readonly (readonly number[])[],
): DTWResult {
  if (seriesA.length === 0 || seriesB.length === 0) {
    throw new Error("Both series must be non-empty.");
  }

  // Flatten to 1D using Euclidean norm of each frame for the cost function.
  const normA = seriesA.map((frame) =>
    Math.sqrt(frame.reduce((sum, val) => sum + val * val, 0)),
  );
  const normB = seriesB.map((frame) =>
    Math.sqrt(frame.reduce((sum, val) => sum + val * val, 0)),
  );

  return computeDTW(normA, normB);
}

// ────────────────────────────────────────────────────────────────────────────
// Transposition-Aware DTW
// ────────────────────────────────────────────────────────────────────────────

/**
 * DTW with transposition detection for melodic comparison.
 *
 * Tries all 12 semitone transpositions (-6 to +5) and finds the one
 * that minimizes DTW distance. This catches copies where the melody
 * was shifted up or down in pitch.
 *
 * "Track A's chorus melody is identical to Track B's verse melody,
 * transposed up 3 semitones" — this is strong evidence of copying.
 */
export function computeDTWWithTransposition(
  frequenciesA: number[],
  frequenciesB: number[],
  confidenceA?: number[],
  confidenceB?: number[],
  confidenceThreshold: number = 0.5,
): {
  bestDistance: number;
  bestSimilarity: number;
  transpositionSemitones: number;
  path: [number, number][];
  allTranspositions: Array<{ semitones: number; distance: number; similarity: number }>;
} {
  // 1. Convert frequencies to semitone-relative values (MIDI-like)
  //    semitone = 12 * log2(freq / 440) + 69
  //    Filter out frequencies where confidence < threshold

  // 2. For each transposition from -6 to +5 semitones:
  //    a. Shift seriesB by N semitones (add N to all values)
  //    b. Run computeDTW on the two semitone series
  //    c. Record the distance

  // 3. Find the transposition with minimum distance
  //    If transposition != 0 and similarity > 0.7, this is strong evidence

  // 4. Return the best result with the transposition amount

  // Implementation:
  const freqToSemitone = (f: number) => f > 0 ? 12 * Math.log2(f / 440) + 69 : 0;

  // Filter by confidence
  const semitonesA: number[] = [];
  const semitonesB: number[] = [];

  for (let i = 0; i < frequenciesA.length; i++) {
    if (!confidenceA || confidenceA[i] >= confidenceThreshold) {
      semitonesA.push(freqToSemitone(frequenciesA[i]));
    }
  }
  for (let i = 0; i < frequenciesB.length; i++) {
    if (!confidenceB || confidenceB[i] >= confidenceThreshold) {
      semitonesB.push(freqToSemitone(frequenciesB[i]));
    }
  }

  if (semitonesA.length === 0 || semitonesB.length === 0) {
    return {
      bestDistance: Infinity,
      bestSimilarity: 0,
      transpositionSemitones: 0,
      path: [],
      allTranspositions: [],
    };
  }

  const allTranspositions: Array<{ semitones: number; distance: number; similarity: number }> = [];
  let bestResult = { distance: Infinity, similarity: 0, semitones: 0, path: [] as [number, number][] };

  // Try all 12 semitone transpositions
  for (let shift = -6; shift <= 5; shift++) {
    const shiftedB = semitonesB.map(s => s + shift);
    const dtwResult = computeDTW(semitonesA, shiftedB);

    // Normalize distance by path length
    const normalizedDist = dtwResult.normalizedDistance;
    // Convert to similarity (0-1), using exponential decay
    const similarity = Math.exp(-normalizedDist / 5);

    allTranspositions.push({ semitones: shift, distance: normalizedDist, similarity });

    if (normalizedDist < bestResult.distance) {
      bestResult = {
        distance: normalizedDist,
        similarity,
        semitones: shift,
        path: dtwResult.path,
      };
    }
  }

  return {
    bestDistance: bestResult.distance,
    bestSimilarity: bestResult.similarity,
    transpositionSemitones: bestResult.semitones,
    path: bestResult.path,
    allTranspositions,
  };
}

// ────────────────────────────────────────────────────────────────────────────
// Hz ↔ MIDI Conversion
// ────────────────────────────────────────────────────────────────────────────

/**
 * Convert a frequency in Hz to MIDI note number.
 * A4 (440 Hz) = MIDI 69. Returns 0 for silence/unvoiced (freq ≤ 0).
 */
export function hzToMidi(freq: number): number {
  if (freq <= 0) return 0;
  return 69 + 12 * Math.log2(freq / 440);
}

/**
 * Convert an array of Hz frequencies to MIDI note numbers.
 * Filters out silence (0 Hz) entries.
 */
export function hzArrayToMidi(frequencies: number[]): number[] {
  return frequencies.map(hzToMidi);
}

// ────────────────────────────────────────────────────────────────────────────
// Interval Sequence
// ────────────────────────────────────────────────────────────────────────────

/**
 * Convert a pitch contour (MIDI note numbers) to an interval sequence.
 * intervals[i] = pitch[i+1] - pitch[i] (in semitones).
 *
 * Interval sequences are inherently transposition-invariant:
 * C-D-E-G has intervals [+2, +2, +3], and so does Eb-F-G-Bb.
 *
 * Silence (MIDI 0) is filtered out before computing intervals.
 */
export function pitchToIntervals(contour: number[]): number[] {
  // Filter out silence/unvoiced (MIDI 0 or very low)
  const voiced = contour.filter((m) => m > 20);
  if (voiced.length < 2) return [];

  const intervals: number[] = [];
  for (let i = 1; i < voiced.length; i++) {
    intervals.push(voiced[i] - voiced[i - 1]);
  }
  return intervals;
}

// ────────────────────────────────────────────────────────────────────────────
// Interval Name Helper
// ────────────────────────────────────────────────────────────────────────────

const INTERVAL_NAMES: Record<number, string> = {
  0: "Same key",
  1: "Up minor 2nd (half step)",
  2: "Up major 2nd (whole step)",
  3: "Up minor 3rd",
  4: "Up major 3rd",
  5: "Up perfect 4th",
  6: "Up tritone",
  [-1]: "Down minor 2nd (half step)",
  [-2]: "Down major 2nd (whole step)",
  [-3]: "Down minor 3rd",
  [-4]: "Down major 3rd",
  [-5]: "Down perfect 4th",
  [-6]: "Down tritone",
};

/**
 * Convert a semitone offset to a human-readable interval name.
 * Used in evidence descriptions and expert reports.
 */
export function semitonesToIntervalName(semitones: number): string {
  return (
    INTERVAL_NAMES[semitones] ??
    `${semitones > 0 ? "+" : ""}${semitones} semitones`
  );
}

// ────────────────────────────────────────────────────────────────────────────
// Transposition-Aware DTW (Combined)
// ────────────────────────────────────────────────────────────────────────────

/** Extended result from transposition-aware DTW. */
export interface TranspositionDTWResult {
  distance: number;
  similarity: number;
  path: [number, number][];
  method: "interval" | "transposition_search";
  transposition_semitones: number;
  transposition_name: string;
  interval_similarity: number;
  transposition_similarity: number;
  allTranspositions: Array<{
    semitones: number;
    distance: number;
    similarity: number;
  }>;
}

// ────────────────────────────────────────────────────────────────────────────
// Chroma Cross-Validation
// ────────────────────────────────────────────────────────────────────────────

export type TranspositionConfidence = "high" | "medium" | "low";

/**
 * Cross-validate a DTW transposition finding against chroma similarity.
 *
 * Chroma vectors represent pitch CLASS (C, C#, D, ...) and are inherently
 * transposition-invariant. If the DTW finds a transposition AND chroma
 * similarity is high, that's strong evidence of transposed copying.
 *
 * @param transpositionSemitones  Detected transposition from DTW
 * @param transpositionSimilarity Similarity at the best transposition
 * @param chromaSimilarity        Cosine similarity of chroma vectors (0-1)
 * @returns Confidence level and explanation
 */
export function crossValidateTransposition(
  transpositionSemitones: number,
  transpositionSimilarity: number,
  chromaSimilarity: number,
): { confidence: TranspositionConfidence; explanation: string } {
  const hasTransposition = transpositionSemitones !== 0;

  if (hasTransposition && transpositionSimilarity > 0.7 && chromaSimilarity > 0.6) {
    return {
      confidence: "high",
      explanation:
        `DTW detected transposition of ${semitonesToIntervalName(transpositionSemitones)} ` +
        `with ${Math.round(transpositionSimilarity * 100)}% melodic similarity. ` +
        `Chroma similarity of ${Math.round(chromaSimilarity * 100)}% confirms consistent ` +
        `pitch-class distribution, supporting the transposition hypothesis.`,
    };
  }

  if (hasTransposition && transpositionSimilarity > 0.5 && chromaSimilarity < 0.4) {
    return {
      confidence: "medium",
      explanation:
        `DTW detected possible transposition of ${semitonesToIntervalName(transpositionSemitones)} ` +
        `with ${Math.round(transpositionSimilarity * 100)}% melodic similarity, but ` +
        `chroma similarity is only ${Math.round(chromaSimilarity * 100)}%. ` +
        `The harmonic context differs — flagged for human review.`,
    };
  }

  if (!hasTransposition && chromaSimilarity > 0.6) {
    return {
      confidence: "high",
      explanation:
        `No transposition detected (same key). Chroma similarity of ` +
        `${Math.round(chromaSimilarity * 100)}% confirms consistent harmonic content.`,
    };
  }

  return {
    confidence: "low",
    explanation:
      `Transposition analysis inconclusive. Melodic similarity ` +
      `${Math.round(transpositionSimilarity * 100)}%, chroma similarity ` +
      `${Math.round(chromaSimilarity * 100)}%.`,
  };
}

// ────────────────────────────────────────────────────────────────────────────
// Transposition-Aware DTW (Combined)
// ────────────────────────────────────────────────────────────────────────────

/**
 * Combined transposition-aware DTW using two methods:
 *
 * 1. **Interval Sequence** (fast, O(n*m)) — converts pitch contours
 *    to interval sequences and runs DTW. Inherently transposition-invariant.
 *
 * 2. **12-Semitone Exhaustive Search** (12x DTW) — tries all transpositions
 *    from -6 to +5 semitones. Finds the exact transposition offset.
 *
 * Uses the method that produces higher similarity. The transposition offset
 * always comes from Method 2 (which explicitly tests each shift).
 *
 * @param contourA  MIDI note numbers for Track A
 * @param contourB  MIDI note numbers for Track B
 */
export function computeTranspositionAwareDTW(
  contourA: number[],
  contourB: number[],
): TranspositionDTWResult {
  // ── Method 1: Interval-based DTW ────────────────────────────────────
  const intervalsA = pitchToIntervals(contourA);
  const intervalsB = pitchToIntervals(contourB);

  let intervalSimilarity = 0;
  let intervalDistance = Infinity;
  let intervalPath: [number, number][] = [];

  if (intervalsA.length >= 2 && intervalsB.length >= 2) {
    const intervalDtw = computeDTW(intervalsA, intervalsB);
    intervalDistance = intervalDtw.normalizedDistance;
    intervalSimilarity = Math.exp(-intervalDistance / 3);
    intervalPath = intervalDtw.path;
  }

  // ── Method 2: 12-semitone exhaustive search ─────────────────────────
  // Filter silence from both contours
  const voicedA = contourA.filter((m) => m > 20);
  const voicedB = contourB.filter((m) => m > 20);

  let bestShift = 0;
  let bestShiftDist = Infinity;
  let bestShiftSim = 0;
  let bestShiftPath: [number, number][] = [];
  const allTranspositions: TranspositionDTWResult["allTranspositions"] = [];

  if (voicedA.length >= 2 && voicedB.length >= 2) {
    for (let shift = -6; shift <= 5; shift++) {
      const shifted = voicedB.map((m) => m + shift);
      const result = computeDTW(voicedA, shifted);
      const sim = Math.exp(-result.normalizedDistance / 5);
      allTranspositions.push({
        semitones: shift,
        distance: result.normalizedDistance,
        similarity: sim,
      });
      if (result.normalizedDistance < bestShiftDist) {
        bestShiftDist = result.normalizedDistance;
        bestShiftSim = sim;
        bestShift = shift;
        bestShiftPath = result.path;
      }
    }
  }

  // ── Pick the best method ────────────────────────────────────────────
  const useInterval = intervalSimilarity >= bestShiftSim;

  // Negate the shift sign: the algorithm shifts B to match A, so
  // bestShift = -3 means "B shifted down 3 matches A" → B = A + 3.
  // The forensic interpretation is: "B is A transposed up 3 semitones."
  const transposition = -bestShift || 0; // avoid -0

  return {
    distance: useInterval ? intervalDistance : bestShiftDist,
    similarity: useInterval ? intervalSimilarity : bestShiftSim,
    path: useInterval ? intervalPath : bestShiftPath,
    method: useInterval ? "interval" : "transposition_search",
    transposition_semitones: transposition,
    transposition_name: semitonesToIntervalName(transposition),
    interval_similarity: intervalSimilarity,
    transposition_similarity: bestShiftSim,
    allTranspositions,
  };
}
