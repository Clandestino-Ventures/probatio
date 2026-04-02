/**
 * PROBATIO — Modal.com Endpoint Definitions
 *
 * Typed endpoint URLs and request/response shapes for each Modal
 * serverless GPU function. All audio processing is dispatched to
 * Modal for GPU-accelerated compute.
 *
 * These types must match the Python function signatures in /modal/functions/.
 */

import type { AnalysisFeatures, StemUrls, MatchResult } from "@/types/analysis";

// ────────────────────────────────────────────────────────────────────────────
// Endpoint Paths
// ────────────────────────────────────────────────────────────────────────────

export const MODAL_ENDPOINTS = {
  normalize: "/api/normalize",
  fingerprint: "/api/fingerprint",
  separate: "/api/separate",
  extractFeatures: "/api/extract-features",
  generateEmbeddings: "/api/generate-embeddings",
  extractLyrics: "/api/extract-lyrics",
  searchMatches: "/api/search-matches",
  enrichRights: "/api/enrich-rights",
  dtwCompare: "/api/dtw-compare",
} as const;

export type ModalEndpointPath =
  (typeof MODAL_ENDPOINTS)[keyof typeof MODAL_ENDPOINTS];

// ────────────────────────────────────────────────────────────────────────────
// Normalize
// ────────────────────────────────────────────────────────────────────────────

export interface NormalizeRequest {
  fileUrl: string;
  fileHash: string;
}

export interface NormalizeResponse {
  normalizedUrl: string;
  normalizedHash: string;
  sampleRate: number;
  bitDepth: number;
  channels: number;
  durationSeconds: number;
}

// ────────────────────────────────────────────────────────────────────────────
// Fingerprint (Chromaprint + AcoustID)
// ────────────────────────────────────────────────────────────────────────────

export interface FingerprintRequest {
  fileUrl: string;
  fileHash: string;
}

export interface AcoustIDRecording {
  id: string;
  title: string;
  artists: Array<{ id: string; name: string }>;
  durationSec: number;
  releases: Array<{ id: string; title: string; date: string }>;
}

export interface AcoustIDMatch {
  acoustidId: string;
  score: number;
  recordings: AcoustIDRecording[];
}

export interface FingerprintResponse {
  fingerprint: string;
  fingerprintHash: string;
  durationSec: number;
  acoustidMatches: AcoustIDMatch[];
  lookupTimeMs: number;
}

// ────────────────────────────────────────────────────────────────────────────
// Separate Stems (Demucs)
// ────────────────────────────────────────────────────────────────────────────

export interface SeparateRequest {
  audioUrl: string;
  analysisId: string;
  userId: string;
  pipelineVersion: string;
}

export interface StemResult {
  url: string;
  hash: string;
  durationSec: number;
}

export interface SeparateResponse {
  stems: {
    vocals: StemResult;
    bass: StemResult;
    drums: StemResult;
    other: StemResult;
  };
  model: string;
  modelVersion: string;
  processingTimeMs: number;
  inputHash: string;
}

// ────────────────────────────────────────────────────────────────────────────
// Extract Features (CREPE + librosa) — Track-level + Segment-level
// ────────────────────────────────────────────────────────────────────────────

export interface ExtractFeaturesRequest {
  stemsUrls: Record<string, string>;
  fullAudioUrl: string;
  analysisId: string;
  segmentDuration?: number;
  segmentHop?: number;
  sr?: number;
}

export interface PitchContour {
  timeS: number[];
  frequencyHz: number[];
  confidence: number[];
  meanPitchHz: number | null;
  pitchStdHz: number | null;
  stepSizeMs: number;
  modelCapacity: string;
  sourceStem?: string;
}

export interface SegmentFeatures {
  pitchContour: {
    times: number[];
    frequencies: number[];
    confidence: number[];
  } | null;
  chromaVector: number[];
  onsetDensity: number;
  rmsEnergy: number;
  tempoLocal: number | null;
}

export interface PerStemMetrics {
  onsetDensity: number;
  rmsEnergy: number;
  hasPitch: boolean;
}

export interface FeatureSegment {
  index: number;
  startSec: number;
  endSec: number;
  label: string | null;
  features: SegmentFeatures;
  perStem: Record<string, PerStemMetrics>;
}

export interface TrackLevelFeatures {
  durationSec: number;
  pitchContour: PitchContour;
  chroma: {
    chromaCqt: number[][];
    nChroma: number;
    shape: number[];
    meanChroma: number[];
  };
  rhythm: {
    estimatedTempoBpm: number;
    beatTimesS: number[];
    numBeats: number;
    onsetStrengthMean: number;
    onsetStrengthStd: number;
    onsetEnvelope: number[];
  };
  structure: {
    segmentBoundaryTimesS: number[];
    numSegments: number;
    noveltyCurve: number[];
  };
  key: {
    key: string;
    confidence: number;
    chromaProfile: number[];
  };
}

export interface ExtractFeaturesResponse {
  trackLevel: TrackLevelFeatures;
  segments: FeatureSegment[];
  multiResolutionSegments?: Record<string, FeatureSegment[]>;
  modelVersions: {
    crepe: string;
    crepeModelCapacity: string;
    crepeStepSize: number;
    librosa: string;
    sampleRate: number;
  };
  outputHash: string;
  processingTimeMs: number;
}

// ────────────────────────────────────────────────────────────────────────────
// Generate Embeddings (CLAP) — Multi-dimensional + Segment-level
// ────────────────────────────────────────────────────────────────────────────

export interface GenerateEmbeddingsRequest {
  fullAudioUrl: string;
  stemsUrls: Record<string, string>;
  analysisId: string;
  segmentDuration?: number;
  segmentHop?: number;
}

/** One of the 4 forensic dimensions (timbre, melody, harmony, rhythm). */
export interface DimensionEmbedding {
  embedding: number[];
  stem: string;
}

export interface SegmentEmbedding {
  index: number;
  startSec: number;
  endSec: number;
  embedding: number[];
}

export interface MultiResSegmentEmbedding extends SegmentEmbedding {
  resolution: string;
}

export interface GenerateEmbeddingsResponse {
  /** 4 track-level embeddings: timbre (full), melody (vocals), harmony (bass+other), rhythm (drums). */
  trackLevel: Record<string, DimensionEmbedding>;
  /** Per-segment embeddings of the full mix (legacy single-resolution). */
  segmentEmbeddings: SegmentEmbedding[];
  /** Multi-resolution segment embeddings grouped by resolution level. */
  multiResolutionEmbeddings?: Record<string, MultiResSegmentEmbedding[]>;
  model: string;
  modelVersion: string;
  embeddingDim: number;
  outputHash: string;
  processingTimeMs: number;
}

// ────────────────────────────────────────────────────────────────────────────
// Extract Lyrics (Whisper large-v3 + sentence-transformers)
// ────────────────────────────────────────────────────────────────────────────

export interface ExtractLyricsRequest {
  vocals_url: string;
  analysis_id: string;
  language_hint: string | null;
}

export interface WordTimestamp {
  word: string;
  start: number;
  end: number;
}

export interface WhisperSegment {
  text: string;
  start: number;
  end: number;
}

export interface ExtractLyricsResponse {
  lyrics_text: string;
  lyrics_language: string;
  lyrics_embedding: number[];
  word_timestamps: WordTimestamp[];
  segments: WhisperSegment[];
  whisper_model: string;
  embedding_model: string;
  output_hash: string;
  processing_time_ms: number;
}

// ────────────────────────────────────────────────────────────────────────────
// Search Matches
// ────────────────────────────────────────────────────────────────────────────

export interface SearchMatchesRequest {
  /** Track-level embeddings (keyed by dimension: timbre, melody, harmony, rhythm). */
  trackEmbeddings: Record<string, number[]>;
  /** Segment embeddings for segment-level matching. */
  segmentEmbeddings?: SegmentEmbedding[];
  analysisId: string;
  mode: string;
  features: AnalysisFeatures;
}

export interface SearchMatchesResponse {
  matches: MatchResult[];
  corpusSize: number;
  searchHash: string;
}

// ────────────────────────────────────────────────────────────────────────────
// Enrich Rights
// ────────────────────────────────────────────────────────────────────────────

export interface EnrichRightsRequest {
  matches: MatchResult[];
  analysisId: string;
}

export interface EnrichedMatch extends MatchResult {
  rightsHolder: string | null;
  publisher: string | null;
  isrc: string | null;
  proRegistered: boolean;
  licenseType: string | null;
}

export interface EnrichRightsResponse {
  enrichedMatches: EnrichedMatch[];
  enrichHash: string;
}

// ────────────────────────────────────────────────────────────────────────────
// DTW Compare (Forensic)
// ────────────────────────────────────────────────────────────────────────────

export interface DTWCompareRequest {
  trackAFeatures: AnalysisFeatures;
  trackBFeatures: AnalysisFeatures;
  dimensions: ("chroma" | "mfcc" | "onset" | "pitch" | "rhythm")[];
}

export interface AlignedSegment {
  trackAStart: number;
  trackAEnd: number;
  trackBStart: number;
  trackBEnd: number;
  similarity: number;
  dimension: string;
}

export interface DTWCompareResponse {
  distances: Record<string, number>;
  similarities: Record<string, number>;
  warpingPaths: Record<string, [number, number][]>;
  alignedSegments: AlignedSegment[];
}
