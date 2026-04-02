/**
 * PROBATIO — Rule-Based Genre Detector
 *
 * Detects genre from extracted audio features using heuristic matching
 * against genre profile feature signatures. Fast, deterministic,
 * reproducible — no ML model, no external API.
 *
 * Detection algorithm:
 * 1. For each genre profile, score how well the track's features match
 *    the profile's feature signature (tempo range, onset density, etc.)
 * 2. Each matching criterion contributes a weighted score
 * 3. Return top 3 genres by confidence
 * 4. If no genre exceeds 0.4 confidence, default to 'pop' (conservative)
 */

import { GENRE_PROFILES, type GenreProfile } from "./genre-profiles";

// ────────────────────────────────────────────────────────────────────────────
// Types
// ────────────────────────────────────────────────────────────────────────────

export interface GenreDetection {
  primary: string;
  confidence: number;
  alternatives: Array<{
    genre: string;
    confidence: number;
  }>;
}

/**
 * Minimal feature set needed for genre detection.
 * Extracted from TrackLevelFeatures stored in analyses.features.
 */
export interface GenreFeatures {
  tempoBpm: number | null;
  onsetStrengthMean: number | null;
  pitchStdHz: number | null;
  meanChroma: number[] | null;
  numSegments: number | null;
  durationSec: number | null;
}

// ────────────────────────────────────────────────────────────────────────────
// Feature extraction from raw analysis data
// ────────────────────────────────────────────────────────────────────────────

/**
 * Extract genre-relevant features from the raw features JSON
 * stored in analyses.features (TrackLevelFeatures shape).
 */
export function extractGenreFeatures(
  features: Record<string, unknown> | null,
): GenreFeatures {
  if (!features) {
    return {
      tempoBpm: null,
      onsetStrengthMean: null,
      pitchStdHz: null,
      meanChroma: null,
      numSegments: null,
      durationSec: null,
    };
  }

  const rhythm = features.rhythm as Record<string, unknown> | undefined;
  const pitch = features.pitchContour as Record<string, unknown> | undefined;
  const chroma = features.chroma as Record<string, unknown> | undefined;
  const structure = features.structure as Record<string, unknown> | undefined;

  return {
    tempoBpm: (rhythm?.estimatedTempoBpm as number) ?? null,
    onsetStrengthMean: (rhythm?.onsetStrengthMean as number) ?? null,
    pitchStdHz: (pitch?.pitchStdHz as number) ?? null,
    meanChroma: (chroma?.meanChroma as number[]) ?? null,
    numSegments: (structure?.numSegments as number) ?? null,
    durationSec: (features.durationSec as number) ?? null,
  };
}

// ────────────────────────────────────────────────────────────────────────────
// Scoring helpers
// ────────────────────────────────────────────────────────────────────────────

/**
 * Score how well a value falls within a range [min, max].
 * Returns 1.0 if inside, decaying to 0.0 based on distance outside.
 */
function rangeScore(
  value: number | null,
  range: [number, number],
  falloff: number = 0.1,
): number {
  if (value == null) return 0.5; // unknown = neutral
  const [min, max] = range;
  if (value >= min && value <= max) return 1.0;
  const distance = value < min ? min - value : value - max;
  const rangeWidth = max - min || 1;
  return Math.max(0, 1.0 - (distance / rangeWidth) * (1 / falloff));
}

/**
 * Compute chroma variance from a 12-element mean chroma vector.
 * Low variance = homogeneous pitch content (pop/edm).
 * High variance = diverse pitch content (jazz/classical).
 */
function computeChromaVariance(meanChroma: number[] | null): "low" | "medium" | "high" {
  if (!meanChroma || meanChroma.length < 12) return "medium";

  const mean = meanChroma.reduce((a, b) => a + b, 0) / meanChroma.length;
  const variance =
    meanChroma.reduce((sum, v) => sum + (v - mean) ** 2, 0) / meanChroma.length;

  // Thresholds calibrated from typical analysis outputs
  if (variance < 0.005) return "low";
  if (variance < 0.015) return "medium";
  return "high";
}

/**
 * Estimate whether percussion dominates the mix.
 * Uses onset strength as a proxy — high onset strength with
 * moderate pitch std suggests percussive dominance.
 */
function estimatePercussiveDominance(
  onsetStrengthMean: number | null,
  pitchStdHz: number | null,
): boolean {
  if (onsetStrengthMean == null) return false;
  // High onsets + low pitch variance = percussive
  const pitchCompact = (pitchStdHz ?? 100) < 80;
  return onsetStrengthMean > 0.4 && pitchCompact;
}

// ────────────────────────────────────────────────────────────────────────────
// Main detector
// ────────────────────────────────────────────────────────────────────────────

/**
 * Detect genre from audio features. Rule-based, deterministic.
 *
 * Scoring weights:
 *   tempo match:    0.30  — strongest single signal
 *   onset density:  0.20  — rhythmic density
 *   pitch std:      0.15  — melodic range
 *   chroma var:     0.20  — harmonic complexity
 *   percussive dom: 0.15  — production style
 */
export function detectGenre(features: GenreFeatures): GenreDetection {
  const chromaVar = computeChromaVariance(features.meanChroma);
  const percDom = estimatePercussiveDominance(
    features.onsetStrengthMean,
    features.pitchStdHz,
  );

  const scored: Array<{ genre: string; confidence: number }> = [];

  for (const profile of GENRE_PROFILES) {
    const sig = profile.featureSignature;

    // Tempo match (weight: 0.30)
    const tempoScore = rangeScore(features.tempoBpm, sig.tempoRange, 0.15);

    // Onset density match (weight: 0.20)
    // Use onsetStrengthMean as proxy (scale: 0-1 → 0-8 onsets/sec approx)
    const onsetProxy = features.onsetStrengthMean != null
      ? features.onsetStrengthMean * 10
      : null;
    const onsetScore = rangeScore(onsetProxy, sig.onsetDensityRange, 0.2);

    // Pitch std match (weight: 0.15)
    const pitchScore = rangeScore(features.pitchStdHz, sig.pitchStdRange, 0.2);

    // Chroma variance match (weight: 0.20)
    const chromaMatch = chromaVar === sig.chromaVariance ? 1.0
      : Math.abs(
          ["low", "medium", "high"].indexOf(chromaVar) -
          ["low", "medium", "high"].indexOf(sig.chromaVariance),
        ) === 1 ? 0.4
      : 0.0;

    // Percussive dominance match (weight: 0.15)
    const percMatch = percDom === sig.hasPercussiveDominance ? 1.0 : 0.3;

    const confidence =
      tempoScore * 0.30 +
      onsetScore * 0.20 +
      pitchScore * 0.15 +
      chromaMatch * 0.20 +
      percMatch * 0.15;

    scored.push({ genre: profile.id, confidence });
  }

  // Sort by confidence descending
  scored.sort((a, b) => b.confidence - a.confidence);

  // If best confidence is below 0.4, default to pop
  const best = scored[0];
  if (!best || best.confidence < 0.4) {
    return {
      primary: "pop",
      confidence: 0.4,
      alternatives: scored.slice(0, 3),
    };
  }

  return {
    primary: best.genre,
    confidence: Math.min(1.0, best.confidence),
    alternatives: scored.slice(1, 3).map((s) => ({
      genre: s.genre,
      confidence: Math.min(1.0, s.confidence),
    })),
  };
}
