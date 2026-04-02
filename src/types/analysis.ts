/**
 * PROBATIO — Analysis Pipeline Types
 *
 * Core types for the audio analysis pipeline including similarity scoring,
 * feature extraction, stem separation, and risk classification.
 */

import type { AnalysisMode, AnalysisStatus, RiskLevel } from "./database";

// ────────────────────────────────────────────────────────────────────────────
// Similarity Scoring
// ────────────────────────────────────────────────────────────────────────────

/** Per-dimension similarity scores (0.0 – 1.0). */
export interface SimilarityScore {
  /** Melodic contour / pitch sequence similarity. */
  melody: number;
  /** Chord progression / harmonic similarity. */
  harmony: number;
  /** Rhythmic pattern similarity. */
  rhythm: number;
  /** Song structure / sectional arrangement similarity. */
  structure: number;
  /** Weighted aggregate score. */
  overall: number;
}

/** Configurable weights for each similarity dimension. */
export interface SimilarityWeights {
  melody: number;
  harmony: number;
  rhythm: number;
  structure: number;
}

// ────────────────────────────────────────────────────────────────────────────
// Feature Extraction
// ────────────────────────────────────────────────────────────────────────────

/** Extracted audio features from a single track. */
export interface AnalysisFeatures {
  /** Chromagram / pitch class profile vectors. */
  chroma: number[][];
  /** Mel-frequency cepstral coefficients. */
  mfcc: number[][];
  /** Estimated tempo in BPM. */
  tempo: number;
  /** Beat positions in seconds. */
  beats: number[];
  /** Key estimation (e.g. "C major", "A minor"). */
  key: string;
  /** Time signature (e.g. "4/4"). */
  timeSignature: string;
  /** Probatiol centroid values per frame. */
  spectralCentroid: number[];
  /** Onset strength envelope. */
  onsetStrength: number[];
  /** Song section boundaries in seconds. */
  sectionBoundaries: number[];
  /** Melody pitch contour (Hz per frame). */
  pitchContour: number[];
  /** Duration of the analyzed region in seconds. */
  durationSeconds: number;
}

// ────────────────────────────────────────────────────────────────────────────
// Stem Separation
// ────────────────────────────────────────────────────────────────────────────

/** URLs to separated stems produced by the pipeline. */
export interface StemUrls {
  vocals: string;
  drums: string;
  bass: string;
  other: string;
  /** Original (unseparated) audio URL. */
  original: string;
}

// ────────────────────────────────────────────────────────────────────────────
// Normalization
// ────────────────────────────────────────────────────────────────────────────

/** Parameters describing the target normalization for analysis. */
export interface NormalizationParams {
  sampleRate: number;
  bitDepth: number;
  channels: number;
  /** Target loudness in LUFS (null = no loudness normalization). */
  targetLufs: number | null;
  /** Output codec used after normalization. */
  codec: "pcm_s16le" | "pcm_f32le" | "flac";
}

// ────────────────────────────────────────────────────────────────────────────
// Pipeline
// ────────────────────────────────────────────────────────────────────────────

/** Individual step inside the analysis pipeline. */
export interface PipelineStep {
  name: string;
  status: AnalysisStatus;
  startedAt: string | null;
  completedAt: string | null;
  durationMs: number | null;
  error: string | null;
  /** Arbitrary metadata produced by the step (never `any`). */
  metadata: Record<string, unknown> | null;
}

/** Full pipeline configuration sent to the worker. */
export interface PipelineConfig {
  analysisId: string;
  userId: string;
  mode: AnalysisMode;
  fileUrl: string;
  fileHashSha256: string;
  normalization: NormalizationParams;
  /** Which pipeline steps to execute (ordered). */
  steps: readonly string[];
  /** Semantic version of the pipeline. */
  pipelineVersion: string;
  /** Maximum wall-clock time for the entire pipeline in ms. */
  timeoutMs: number;
}

// ────────────────────────────────────────────────────────────────────────────
// Results
// ────────────────────────────────────────────────────────────────────────────

/** Result of the full analysis pipeline for a single track. */
export interface AnalysisResult {
  analysisId: string;
  status: AnalysisStatus;
  features: AnalysisFeatures | null;
  stemUrls: StemUrls | null;
  matches: MatchResult[];
  overallRisk: RiskLevel | null;
  pipelineVersion: string;
  processingTimeMs: number;
  steps: PipelineStep[];
  error: string | null;
}

/** A single match against a reference track. */
export interface MatchResult {
  referenceTrackId: string;
  referenceTitle: string;
  referenceArtist: string;
  scores: SimilarityScore;
  riskLevel: RiskLevel;
  confidence: number;
  matchedSegments: MatchedSegment[];
}

/** A contiguous region of high similarity between two tracks. */
export interface MatchedSegment {
  /** Start time in the query track (seconds). */
  queryStart: number;
  /** End time in the query track (seconds). */
  queryEnd: number;
  /** Start time in the reference track (seconds). */
  referenceStart: number;
  /** End time in the reference track (seconds). */
  referenceEnd: number;
  /** Similarity within this segment (0.0 – 1.0). */
  similarity: number;
  /** Which dimension drove the match. */
  dominantDimension: keyof Omit<SimilarityScore, "overall">;
}

// ────────────────────────────────────────────────────────────────────────────
// Risk Thresholds
// ────────────────────────────────────────────────────────────────────────────

/** Threshold boundaries for risk classification. */
export interface RiskThreshold {
  level: RiskLevel;
  /** Minimum overall score (inclusive) to enter this risk band. */
  min: number;
  /** Maximum overall score (exclusive). Use 1.01 for the top band. */
  max: number;
  /** Human-readable label. */
  label: string;
  /** Short description shown to the user. */
  description: string;
}
