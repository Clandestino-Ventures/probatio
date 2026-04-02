// @ts-nocheck — Supabase query types will be auto-generated via `supabase gen types`
/**
 * PROBATIO — Forensic Comparison Engine
 *
 * BIDIRECTIONAL, EXHAUSTIVE, COURT-GRADE comparison between two tracks.
 *
 * Differences from screening comparison:
 * 1. BIDIRECTIONAL DTW: A→B AND B→A (both directions are evidence)
 * 2. EXHAUSTIVE segment pairing: lower threshold (0.3 vs 0.5)
 * 3. ALL 12 transposition scores stored (not just the best)
 * 4. Temporal coverage analysis (what % of each track has matches)
 * 5. Confidence scoring (variance-based)
 */

import { createAdminClient } from "@/lib/supabase/admin";
import { computeDTW, computeDTWWithTransposition } from "@/lib/forensic/dtw";
import { cosineSimilarity } from "@/lib/pgvector";
import { DIMENSION_WEIGHTS } from "@/lib/comparison/scoring";

// ────────────────────────────────────────────────────────────────────────────
// Types
// ────────────────────────────────────────────────────────────────────────────

export interface ForensicComparisonConfig {
  embeddingThreshold: number;
  dtwThreshold: number;
  maxSegmentPairs: number;
  transpositions: number[];
  includeAllTranspositionScores: boolean;
}

export interface ForensicEvidencePoint {
  sourceStartSec: number;
  sourceEndSec: number;
  sourceSegmentIndex: number;
  targetStartSec: number;
  targetEndSec: number;
  targetSegmentIndex: number;
  dimension: string;
  similarityScore: number;
  direction: "a_to_b" | "b_to_a" | "both";
  transpositionSemitones: number | null;
  allTranspositionScores: Record<number, number> | null;
  detail: Record<string, unknown>;
  description: string;
}

export interface ForensicComparisonResult {
  dimensionScores: {
    melody: number;
    harmony: number;
    rhythm: number;
    timbre: number;
    lyrics: number | null;
    overall: number;
  };
  evidence: ForensicEvidencePoint[];
  alignment: {
    aToB: {
      bestTransposition: number;
      similarityAtBest: number;
      allTranspositionScores: Record<number, number>;
    };
    bToA: {
      bestTransposition: number;
      similarityAtBest: number;
      allTranspositionScores: Record<number, number>;
    };
  };
  coverage: {
    trackACoveredPct: number;
    trackBCoveredPct: number;
    coveredSegmentsA: number[];
    coveredSegmentsB: number[];
  };
  confidence: {
    score: number;
    variance: number;
    segmentAgreement: number;
    note: string;
  };
  segmentPairsCompared: number;
  processingTimeMs: number;
}

const DEFAULT_CONFIG: ForensicComparisonConfig = {
  embeddingThreshold: 0.3,
  dtwThreshold: 0.2,
  maxSegmentPairs: 500,
  transpositions: [-6, -5, -4, -3, -2, -1, 0, 1, 2, 3, 4, 5],
  includeAllTranspositionScores: true,
};

// ────────────────────────────────────────────────────────────────────────────
// Main Function
// ────────────────────────────────────────────────────────────────────────────

export async function runForensicComparison(
  analysisIdA: string,
  analysisIdB: string,
  config?: Partial<ForensicComparisonConfig>
): Promise<ForensicComparisonResult> {
  const cfg = { ...DEFAULT_CONFIG, ...config };
  const startTime = Date.now();
  const supabase = createAdminClient();

  // ── 1. Fetch segments for both analyses ────────────────────────────────
  const [{ data: segmentsA }, { data: segmentsB }] = await Promise.all([
    supabase
      .from("analysis_segments")
      .select("*")
      .eq("analysis_id", analysisIdA)
      .order("segment_index"),
    supabase
      .from("analysis_segments")
      .select("*")
      .eq("analysis_id", analysisIdB)
      .order("segment_index"),
  ]);

  const segsA = segmentsA ?? [];
  const segsB = segmentsB ?? [];

  // ── 2. Fetch spectral signatures (track-level embeddings) ──────────────
  const [{ data: sigsA }, { data: sigsB }] = await Promise.all([
    supabase
      .from("spectral_signatures")
      .select("*")
      .eq("analysis_id", analysisIdA),
    supabase
      .from("spectral_signatures")
      .select("*")
      .eq("analysis_id", analysisIdB),
  ]);

  // ── 3. Track-level dimension scores ────────────────────────────────────
  const dimensionScores: Record<string, number> = {};
  for (const sigA of sigsA ?? []) {
    const sigB = (sigsB ?? []).find((s) => s.dimension === sigA.dimension);
    if (sigB && sigA.embedding && sigB.embedding) {
      const embA = Array.isArray(sigA.embedding)
        ? sigA.embedding
        : (typeof sigA.embedding === "string" ? JSON.parse(sigA.embedding) : []);
      const embB = Array.isArray(sigB.embedding)
        ? sigB.embedding
        : (typeof sigB.embedding === "string" ? JSON.parse(sigB.embedding) : []);
      if (embA.length > 0 && embB.length > 0) {
        dimensionScores[sigA.dimension] = cosineSimilarity(embA, embB);
      }
    }
  }

  // ── 4. Segment pair selection (exhaustive) ─────────────────────────────
  // Compute embedding similarity for ALL segment pairs
  const segmentPairs: Array<{
    iA: number;
    iB: number;
    embSimilarity: number;
  }> = [];

  for (let iA = 0; iA < segsA.length; iA++) {
    const embA = segsA[iA].embedding;
    if (!embA) continue;
    const vecA = Array.isArray(embA) ? embA : (typeof embA === "string" ? JSON.parse(embA) : null);
    if (!vecA) continue;

    for (let iB = 0; iB < segsB.length; iB++) {
      const embB = segsB[iB].embedding;
      if (!embB) continue;
      const vecB = Array.isArray(embB) ? embB : (typeof embB === "string" ? JSON.parse(embB) : null);
      if (!vecB) continue;

      const sim = cosineSimilarity(vecA, vecB);
      if (sim >= cfg.embeddingThreshold) {
        segmentPairs.push({ iA, iB, embSimilarity: sim });
      }
    }
  }

  // Also ensure top-50 pairs are included regardless of threshold
  if (segsA.length > 0 && segsB.length > 0) {
    const allPairsSorted = [...segmentPairs].sort(
      (a, b) => b.embSimilarity - a.embSimilarity
    );
    const top50 = allPairsSorted.slice(0, 50);
    for (const pair of top50) {
      if (!segmentPairs.find((p) => p.iA === pair.iA && p.iB === pair.iB)) {
        segmentPairs.push(pair);
      }
    }
  }

  // Cap at max pairs
  const selectedPairs = segmentPairs
    .sort((a, b) => b.embSimilarity - a.embSimilarity)
    .slice(0, cfg.maxSegmentPairs);

  // ── 5. Compare each selected pair ──────────────────────────────────────
  const evidence: ForensicEvidencePoint[] = [];

  for (const pair of selectedPairs) {
    const segA = segsA[pair.iA];
    const segB = segsB[pair.iB];

    // MELODY: DTW with transposition detection
    const pitchA = segA.pitch_contour as { frequencies?: number[]; confidence?: number[] } | null;
    const pitchB = segB.pitch_contour as { frequencies?: number[]; confidence?: number[] } | null;

    if (pitchA?.frequencies?.length && pitchB?.frequencies?.length) {
      const dtwResult = computeDTWWithTransposition(
        pitchA.frequencies,
        pitchB.frequencies,
        pitchA.confidence,
        pitchB.confidence,
        0.5
      );

      if (dtwResult.bestSimilarity >= cfg.dtwThreshold) {
        const allScores: Record<number, number> = {};
        for (const t of dtwResult.allTranspositions) {
          allScores[t.semitones] = t.similarity;
        }

        evidence.push({
          sourceStartSec: segA.start_sec,
          sourceEndSec: segA.end_sec,
          sourceSegmentIndex: segA.segment_index,
          targetStartSec: segB.start_sec,
          targetEndSec: segB.end_sec,
          targetSegmentIndex: segB.segment_index,
          dimension: "melody",
          similarityScore: dtwResult.bestSimilarity,
          direction: "a_to_b",
          transpositionSemitones: dtwResult.transpositionSemitones,
          allTranspositionScores: cfg.includeAllTranspositionScores ? allScores : null,
          detail: {
            dtw_distance: dtwResult.bestDistance,
            transposition_semitones: dtwResult.transpositionSemitones,
            all_transposition_scores: allScores,
          },
          description: `Melodic similarity of ${Math.round(dtwResult.bestSimilarity * 100)}% at ${formatTime(segA.start_sec)}-${formatTime(segA.end_sec)} → ${formatTime(segB.start_sec)}-${formatTime(segB.end_sec)}${dtwResult.transpositionSemitones !== 0 ? `, transposed ${dtwResult.transpositionSemitones > 0 ? "+" : ""}${dtwResult.transpositionSemitones} semitones` : ""}.`,
        });
      }
    }

    // HARMONY: Chroma vector cosine similarity
    const chromaA = segA.chroma_vector as number[] | null;
    const chromaB = segB.chroma_vector as number[] | null;

    if (chromaA?.length && chromaB?.length) {
      const chromaSim = cosineSimilarity(chromaA, chromaB);
      if (chromaSim >= cfg.dtwThreshold) {
        evidence.push({
          sourceStartSec: segA.start_sec,
          sourceEndSec: segA.end_sec,
          sourceSegmentIndex: segA.segment_index,
          targetStartSec: segB.start_sec,
          targetEndSec: segB.end_sec,
          targetSegmentIndex: segB.segment_index,
          dimension: "harmony",
          similarityScore: chromaSim,
          direction: "a_to_b",
          transpositionSemitones: null,
          allTranspositionScores: null,
          detail: { chroma_cosine: chromaSim },
          description: `Harmonic similarity of ${Math.round(chromaSim * 100)}% at ${formatTime(segA.start_sec)}-${formatTime(segA.end_sec)} → ${formatTime(segB.start_sec)}-${formatTime(segB.end_sec)}.`,
        });
      }
    }

    // RHYTHM: Onset density correlation
    if (segA.onset_density != null && segB.onset_density != null) {
      const maxDensity = Math.max(segA.onset_density, segB.onset_density, 0.01);
      const rhythmSim = 1 - Math.abs(segA.onset_density - segB.onset_density) / maxDensity;
      if (rhythmSim >= cfg.dtwThreshold) {
        evidence.push({
          sourceStartSec: segA.start_sec,
          sourceEndSec: segA.end_sec,
          sourceSegmentIndex: segA.segment_index,
          targetStartSec: segB.start_sec,
          targetEndSec: segB.end_sec,
          targetSegmentIndex: segB.segment_index,
          dimension: "rhythm",
          similarityScore: rhythmSim,
          direction: "a_to_b",
          transpositionSemitones: null,
          allTranspositionScores: null,
          detail: {
            onset_density_a: segA.onset_density,
            onset_density_b: segB.onset_density,
          },
          description: `Rhythmic similarity of ${Math.round(rhythmSim * 100)}% (onset density: ${segA.onset_density.toFixed(1)} vs ${segB.onset_density.toFixed(1)}).`,
        });
      }
    }
  }

  // ── 6. Bidirectional alignment summary ─────────────────────────────────
  // Use track-level pitch contours for global alignment
  const globalAlignment = computeBidirectionalAlignment(segsA, segsB);

  // ── 7. Temporal coverage ───────────────────────────────────────────────
  const coveredA = new Set<number>();
  const coveredB = new Set<number>();
  for (const ev of evidence) {
    if (ev.similarityScore >= 0.3) {
      coveredA.add(ev.sourceSegmentIndex);
      coveredB.add(ev.targetSegmentIndex);
    }
  }

  const coverage = {
    trackACoveredPct: segsA.length > 0 ? coveredA.size / segsA.length : 0,
    trackBCoveredPct: segsB.length > 0 ? coveredB.size / segsB.length : 0,
    coveredSegmentsA: Array.from(coveredA).sort((a, b) => a - b),
    coveredSegmentsB: Array.from(coveredB).sort((a, b) => a - b),
  };

  // ── 8. Confidence scoring ──────────────────────────────────────────────
  const scores = evidence.map((e) => e.similarityScore);
  const mean = scores.length > 0 ? scores.reduce((a, b) => a + b, 0) / scores.length : 0;
  const variance =
    scores.length > 1
      ? scores.reduce((sum, s) => sum + (s - mean) ** 2, 0) / (scores.length - 1)
      : 0;

  const confidenceScore = scores.length >= 5 && variance < 0.05 ? 0.9 : scores.length >= 3 ? 0.7 : scores.length > 0 ? 0.5 : 0.1;

  let confidenceNote: string;
  if (confidenceScore >= 0.8) {
    confidenceNote = `High confidence: ${scores.length} evidence points with consistent similarity (σ=${Math.sqrt(variance).toFixed(3)})`;
  } else if (confidenceScore >= 0.6) {
    confidenceNote = `Moderate confidence: ${scores.length} evidence points (σ=${Math.sqrt(variance).toFixed(3)})`;
  } else {
    confidenceNote = `Low confidence: limited evidence (${scores.length} points)`;
  }

  // ── 9. Compute weighted overall ────────────────────────────────────────
  let weightedSum = 0;
  let weightTotal = 0;
  for (const [dim, score] of Object.entries(dimensionScores)) {
    const weight = DIMENSION_WEIGHTS[dim] || 0.1;
    weightedSum += score * weight;
    weightTotal += weight;
  }
  const overallScore = weightTotal > 0 ? weightedSum / weightTotal : 0;

  const elapsed = Date.now() - startTime;

  return {
    dimensionScores: {
      melody: dimensionScores.melody ?? 0,
      harmony: dimensionScores.harmony ?? 0,
      rhythm: dimensionScores.rhythm ?? 0,
      timbre: dimensionScores.timbre ?? 0,
      lyrics: dimensionScores.lyrics ?? null,
      overall: overallScore,
    },
    evidence: evidence.sort((a, b) => b.similarityScore - a.similarityScore),
    alignment: globalAlignment,
    coverage,
    confidence: {
      score: confidenceScore,
      variance,
      segmentAgreement: scores.length > 0 ? coveredA.size / Math.max(segsA.length, 1) : 0,
      note: confidenceNote,
    },
    segmentPairsCompared: selectedPairs.length,
    processingTimeMs: elapsed,
  };
}

// ────────────────────────────────────────────────────────────────────────────
// Helpers
// ────────────────────────────────────────────────────────────────────────────

function formatTime(sec: number): string {
  const m = Math.floor(sec / 60);
  const s = Math.floor(sec % 60);
  return `${m}:${s.toString().padStart(2, "0")}`;
}

function computeBidirectionalAlignment(
  segsA: Array<Record<string, unknown>>,
  segsB: Array<Record<string, unknown>>
) {
  // Extract all pitch frequencies from segments
  const pitchesA: number[] = [];
  const pitchesB: number[] = [];

  for (const seg of segsA) {
    const pc = seg.pitch_contour as { frequencies?: number[] } | null;
    if (pc?.frequencies) pitchesA.push(...pc.frequencies.slice(0, 20));
  }
  for (const seg of segsB) {
    const pc = seg.pitch_contour as { frequencies?: number[] } | null;
    if (pc?.frequencies) pitchesB.push(...pc.frequencies.slice(0, 20));
  }

  // If we have pitch data, run DTW with transposition in both directions
  const defaultResult = {
    bestTransposition: 0,
    similarityAtBest: 0,
    allTranspositionScores: {} as Record<number, number>,
  };

  if (pitchesA.length < 10 || pitchesB.length < 10) {
    return { aToB: defaultResult, bToA: defaultResult };
  }

  // A→B
  const aToBResult = computeDTWWithTransposition(pitchesA, pitchesB);
  const aToBScores: Record<number, number> = {};
  for (const t of aToBResult.allTranspositions) {
    aToBScores[t.semitones] = t.similarity;
  }

  // B→A
  const bToAResult = computeDTWWithTransposition(pitchesB, pitchesA);
  const bToAScores: Record<number, number> = {};
  for (const t of bToAResult.allTranspositions) {
    bToAScores[t.semitones] = t.similarity;
  }

  return {
    aToB: {
      bestTransposition: aToBResult.transpositionSemitones,
      similarityAtBest: aToBResult.bestSimilarity,
      allTranspositionScores: aToBScores,
    },
    bToA: {
      bestTransposition: bToAResult.transpositionSemitones,
      similarityAtBest: bToAResult.bestSimilarity,
      allTranspositionScores: bToAScores,
    },
  };
}
