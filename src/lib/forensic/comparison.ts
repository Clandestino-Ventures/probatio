/**
 * PROBATIO — Forensic 1v1 Comparison
 *
 * Runs a direct forensic comparison between two audio tracks using
 * multiple analysis dimensions: DTW alignment, chroma similarity,
 * onset detection, and structural analysis.
 *
 * Produces a detailed forensic comparison report suitable for
 * expert review and court proceedings.
 */

import { computeOverallSimilarity } from "@/lib/analysis/similarity";
import { classifyRiskFromScores } from "@/lib/analysis/risk-classifier";
import { computeDTW } from "@/lib/forensic/dtw";
import type { AnalysisFeatures, StemUrls, SimilarityScore, MatchedSegment } from "@/types/analysis";
import type { ForensicComparison, DimensionAnalysis } from "@/types/forensic";

// ────────────────────────────────────────────────────────────────────────────
// Types
// ────────────────────────────────────────────────────────────────────────────

export interface ForensicComparisonInput {
  forensicCaseId: string;
  trackA: {
    features: AnalysisFeatures;
    stemUrls: StemUrls;
    hash: string;
  };
  trackB: {
    features: AnalysisFeatures;
    stemUrls: StemUrls;
    hash: string;
  };
}

// ────────────────────────────────────────────────────────────────────────────
// Dimension Comparisons
// ────────────────────────────────────────────────────────────────────────────

/**
 * Compare melodic content using DTW on pitch contour data.
 * Pitch contour captures the fundamental frequency over time,
 * which is the primary signal in melody copyright cases.
 */
function compareMelody(
  featuresA: AnalysisFeatures,
  featuresB: AnalysisFeatures,
): { score: number; explanation: string; evidenceRefs: string[] } {
  const dtwResult = computeDTW(featuresA.pitchContour, featuresB.pitchContour);
  const normalizedDistance = dtwResult.normalizedDistance;
  // Convert distance to similarity: 1.0 = identical, 0.0 = completely different
  const score = Math.max(0, 1 - normalizedDistance);

  const evidenceRefs: string[] = [];
  if (score > 0.7) {
    evidenceRefs.push(
      `High melodic similarity (${(score * 100).toFixed(1)}%) detected across the analyzed region.`,
    );
    evidenceRefs.push(
      `DTW alignment path length: ${dtwResult.path.length} frames.`,
    );
  }

  const explanation =
    score >= 0.85
      ? "The melodic contours of both tracks show near-identical pitch sequences, " +
        "suggesting substantial copying of the melody."
      : score >= 0.7
        ? "Significant melodic similarity detected. The pitch contours share " +
          "extended passages of closely matching intervals."
        : score >= 0.4
          ? "Moderate melodic similarity. Some shared intervallic patterns were found, " +
            "but they may represent common melodic idioms."
          : "Low melodic similarity. The pitch contours diverge substantially.";

  return { score, explanation, evidenceRefs };
}

/**
 * Compare harmonic content using chroma feature similarity.
 * Chromagrams represent pitch class distributions over time,
 * capturing chord progressions and harmonic structure.
 */
function compareHarmony(
  featuresA: AnalysisFeatures,
  featuresB: AnalysisFeatures,
): { score: number; explanation: string; evidenceRefs: string[] } {
  // Flatten chroma matrices and compute DTW across chroma frames.
  const chromaA = featuresA.chroma.map((frame) =>
    frame.reduce((sum, val) => sum + val, 0) / frame.length,
  );
  const chromaB = featuresB.chroma.map((frame) =>
    frame.reduce((sum, val) => sum + val, 0) / frame.length,
  );

  const dtwResult = computeDTW(chromaA, chromaB);
  const score = Math.max(0, 1 - dtwResult.normalizedDistance);

  const evidenceRefs: string[] = [];
  if (score > 0.7) {
    evidenceRefs.push(
      `Harmonic similarity of ${(score * 100).toFixed(1)}% detected via chroma analysis.`,
    );
  }

  // Check for matching keys.
  if (featuresA.key === featuresB.key) {
    evidenceRefs.push(`Both tracks share the same key: ${featuresA.key}.`);
  }

  const explanation =
    score >= 0.85
      ? "The harmonic progressions are nearly identical, indicating a shared " +
        "chord structure that goes beyond common progressions."
      : score >= 0.7
        ? "Substantial harmonic similarity. The chord progressions share extended " +
          "similar passages."
        : score >= 0.4
          ? "Moderate harmonic similarity. Some common chord progressions were found, " +
            "which may be attributable to genre conventions."
          : "Low harmonic similarity. The chord progressions are largely independent.";

  return { score, explanation, evidenceRefs };
}

/**
 * Compare rhythmic content using onset strength envelopes.
 * Onset strength captures the rhythmic impulse pattern,
 * including beat placement and rhythmic feel.
 */
function compareRhythm(
  featuresA: AnalysisFeatures,
  featuresB: AnalysisFeatures,
): { score: number; explanation: string; evidenceRefs: string[] } {
  const dtwResult = computeDTW(
    featuresA.onsetStrength,
    featuresB.onsetStrength,
  );
  const score = Math.max(0, 1 - dtwResult.normalizedDistance);

  const evidenceRefs: string[] = [];
  const tempoDiff = Math.abs(featuresA.tempo - featuresB.tempo);
  evidenceRefs.push(
    `Track A tempo: ${featuresA.tempo.toFixed(1)} BPM, Track B tempo: ${featuresB.tempo.toFixed(1)} BPM ` +
      `(difference: ${tempoDiff.toFixed(1)} BPM).`,
  );

  if (featuresA.timeSignature === featuresB.timeSignature) {
    evidenceRefs.push(
      `Both tracks use ${featuresA.timeSignature} time signature.`,
    );
  }

  const explanation =
    score >= 0.85
      ? "The rhythmic patterns are nearly identical, with matching onset patterns " +
        "and beat placement throughout."
      : score >= 0.7
        ? "Strong rhythmic similarity. The onset patterns and beat placement " +
          "share significant overlap."
        : score >= 0.4
          ? "Moderate rhythmic similarity. Some shared rhythmic patterns were found, " +
            "possibly attributable to genre conventions."
          : "Low rhythmic similarity. The rhythmic patterns are distinct.";

  return { score, explanation, evidenceRefs };
}

/**
 * Compare structural arrangement using section boundaries.
 * Section boundaries capture the macro-structure of a song
 * (verse, chorus, bridge, etc.).
 */
function compareStructure(
  featuresA: AnalysisFeatures,
  featuresB: AnalysisFeatures,
): { score: number; explanation: string; evidenceRefs: string[] } {
  // Normalize section boundaries to relative positions (0-1).
  const durationA = featuresA.durationSeconds || 1;
  const durationB = featuresB.durationSeconds || 1;

  const normalizedBoundariesA = featuresA.sectionBoundaries.map(
    (b) => b / durationA,
  );
  const normalizedBoundariesB = featuresB.sectionBoundaries.map(
    (b) => b / durationB,
  );

  // Pad to same length for comparison.
  const maxLen = Math.max(
    normalizedBoundariesA.length,
    normalizedBoundariesB.length,
  );
  const paddedA = [
    ...normalizedBoundariesA,
    ...Array<number>(Math.max(0, maxLen - normalizedBoundariesA.length)).fill(1),
  ];
  const paddedB = [
    ...normalizedBoundariesB,
    ...Array<number>(Math.max(0, maxLen - normalizedBoundariesB.length)).fill(1),
  ];

  // Compute mean absolute difference of normalized boundaries.
  let totalDiff = 0;
  for (let i = 0; i < maxLen; i++) {
    totalDiff += Math.abs(paddedA[i] - paddedB[i]);
  }
  const meanDiff = maxLen > 0 ? totalDiff / maxLen : 0;
  const score = Math.max(0, 1 - meanDiff);

  const evidenceRefs: string[] = [];
  evidenceRefs.push(
    `Track A has ${featuresA.sectionBoundaries.length} sections, ` +
      `Track B has ${featuresB.sectionBoundaries.length} sections.`,
  );

  const explanation =
    score >= 0.85
      ? "The structural arrangements are nearly identical, with matching " +
        "section boundaries and proportional section lengths."
      : score >= 0.7
        ? "Significant structural similarity. The song sections align closely " +
          "in both timing and proportion."
        : score >= 0.4
          ? "Moderate structural similarity. Some section alignment was found, " +
            "but this may reflect standard song form conventions."
          : "Low structural similarity. The arrangements differ substantially.";

  return { score, explanation, evidenceRefs };
}

// ────────────────────────────────────────────────────────────────────────────
// Matched Segment Detection
// ────────────────────────────────────────────────────────────────────────────

function detectMatchedSegments(
  featuresA: AnalysisFeatures,
  featuresB: AnalysisFeatures,
): MatchedSegment[] {
  const segments: MatchedSegment[] = [];

  // Use DTW alignment on pitch contour to find aligned time regions.
  const dtwResult = computeDTW(featuresA.pitchContour, featuresB.pitchContour);
  const durationA = featuresA.durationSeconds || 1;
  const durationB = featuresB.durationSeconds || 1;
  const framesA = featuresA.pitchContour.length || 1;
  const framesB = featuresB.pitchContour.length || 1;

  // Group consecutive path points into segments.
  let segmentStart: [number, number] | null = null;
  let segmentEnd: [number, number] = [0, 0];

  for (let i = 0; i < dtwResult.path.length; i++) {
    const [idxA, idxB] = dtwResult.path[i];

    if (segmentStart === null) {
      segmentStart = [idxA, idxB];
    }

    segmentEnd = [idxA, idxB];

    // Check if the next point is non-adjacent (gap) or end of path.
    const isLast = i === dtwResult.path.length - 1;
    const nextPoint = isLast ? null : dtwResult.path[i + 1];
    const isGap =
      nextPoint !== null &&
      (Math.abs(nextPoint[0] - idxA) > 2 ||
        Math.abs(nextPoint[1] - idxB) > 2);

    if (isLast || isGap) {
      if (segmentStart !== null) {
        const queryStart = (segmentStart[0] / framesA) * durationA;
        const queryEnd = (segmentEnd[0] / framesA) * durationA;
        const refStart = (segmentStart[1] / framesB) * durationB;
        const refEnd = (segmentEnd[1] / framesB) * durationB;

        // Only include segments longer than 2 seconds.
        if (queryEnd - queryStart >= 2 && refEnd - refStart >= 2) {
          segments.push({
            queryStart,
            queryEnd,
            referenceStart: refStart,
            referenceEnd: refEnd,
            similarity: Math.max(0, 1 - dtwResult.normalizedDistance),
            dominantDimension: "melody",
          });
        }
      }
      segmentStart = null;
    }
  }

  return segments;
}

// ────────────────────────────────────────────────────────────────────────────
// Main Comparison Function
// ────────────────────────────────────────────────────────────────────────────

/**
 * Run a full forensic 1v1 comparison between two tracks.
 *
 * Performs DTW-based analysis across melody, harmony, rhythm, and structure
 * dimensions, detects matched segments, and produces a forensic comparison
 * report with risk classification.
 *
 * @param input  The two tracks to compare with their features and metadata.
 * @returns A complete {@link ForensicComparison} suitable for court use.
 */
export async function runForensicComparison(
  input: ForensicComparisonInput,
): Promise<ForensicComparison> {
  const { forensicCaseId, trackA, trackB } = input;

  // Run all dimension comparisons.
  const melodyResult = compareMelody(trackA.features, trackB.features);
  const harmonyResult = compareHarmony(trackA.features, trackB.features);
  const rhythmResult = compareRhythm(trackA.features, trackB.features);
  const structureResult = compareStructure(trackA.features, trackB.features);

  // Compute overall similarity score.
  const scores: SimilarityScore = computeOverallSimilarity({
    melody: melodyResult.score,
    harmony: harmonyResult.score,
    rhythm: rhythmResult.score,
    structure: structureResult.score,
  });

  // Classify risk level.
  const riskLevel = classifyRiskFromScores(scores);

  // Build dimension analysis details.
  const dimensionAnalysis: DimensionAnalysis[] = [
    {
      dimension: "melody",
      score: melodyResult.score,
      explanation: melodyResult.explanation,
      evidenceRefs: melodyResult.evidenceRefs,
    },
    {
      dimension: "harmony",
      score: harmonyResult.score,
      explanation: harmonyResult.explanation,
      evidenceRefs: harmonyResult.evidenceRefs,
    },
    {
      dimension: "rhythm",
      score: rhythmResult.score,
      explanation: rhythmResult.explanation,
      evidenceRefs: rhythmResult.evidenceRefs,
    },
    {
      dimension: "structure",
      score: structureResult.score,
      explanation: structureResult.explanation,
      evidenceRefs: structureResult.evidenceRefs,
    },
  ];

  // Detect matched segments.
  const matchedSegments = detectMatchedSegments(
    trackA.features,
    trackB.features,
  );

  const comparison: ForensicComparison = {
    id: crypto.randomUUID(),
    forensicCaseId,
    queryTrackId: trackA.hash,
    referenceTrackId: trackB.hash,
    scores,
    riskLevel,
    dimensionAnalysis,
    matchedSegments,
    analyzedAt: new Date().toISOString(),
    pipelineVersion: "1.0.0",
  };

  return comparison;
}
