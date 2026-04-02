/**
 * PROBATIO — Forensic Case Types
 *
 * Types for court-ready forensic analysis, evidence packaging,
 * chain-of-custody tracking, and expert annotations.
 */

import type { RiskLevel, ForensicStatus } from "./database";
import type { SimilarityScore, MatchedSegment } from "./analysis";

// ────────────────────────────────────────────────────────────────────────────
// Forensic Comparison
// ────────────────────────────────────────────────────────────────────────────

/** A detailed forensic comparison between two audio works. */
export interface ForensicComparison {
  id: string;
  forensicCaseId: string;
  queryTrackId: string;
  referenceTrackId: string;
  scores: SimilarityScore;
  riskLevel: RiskLevel;
  /** Per-dimension deep-dive findings. */
  dimensionAnalysis: DimensionAnalysis[];
  matchedSegments: MatchedSegment[];
  /** Timestamp of when the comparison was run (ISO 8601). */
  analyzedAt: string;
  /** Pipeline version used. */
  pipelineVersion: string;
}

/** Deep analysis for a single similarity dimension. */
export interface DimensionAnalysis {
  dimension: "melody" | "harmony" | "rhythm" | "structure";
  score: number;
  /** Textual explanation suitable for an expert report. */
  explanation: string;
  /** Supporting evidence references (e.g. bar numbers, timestamps). */
  evidenceRefs: string[];
}

// ────────────────────────────────────────────────────────────────────────────
// Forensic Similarity
// ────────────────────────────────────────────────────────────────────────────

/** Extended similarity report used in forensic contexts. */
export interface ForensicSimilarity {
  /** Standard similarity scores. */
  scores: SimilarityScore;
  /** Whether the similarity is statistically significant. */
  isStatisticallySignificant: boolean;
  /** p-value from the statistical test. */
  pValue: number;
  /** Number of reference corpus tracks used for the significance test. */
  corpusSize: number;
  /** Percentile rank within the reference corpus (0–100). */
  percentileRank: number;
  /** How many standard deviations above the corpus mean. */
  zScore: number;
}

// ────────────────────────────────────────────────────────────────────────────
// Evidence Package
// ────────────────────────────────────────────────────────────────────────────

/** A sealed, court-ready evidence package. */
export interface EvidencePackage {
  id: string;
  forensicCaseId: string;
  caseNumber: string;
  /** ISO 8601 timestamp when the package was sealed. */
  generatedAt: string;
  /** SHA-256 hash of the entire package contents. */
  packageHash: string;
  /** URL to the downloadable ZIP / PDF bundle. */
  downloadUrl: string;
  /** Individual items included in the package. */
  items: EvidenceItem[];
  /** Full chain of custody up to the sealing point. */
  chainOfCustody: ChainOfCustodyEntry[];
  /** Metadata about the generating system. */
  systemInfo: EvidenceSystemInfo;
}

/** A single item within the evidence package. */
export interface EvidenceItem {
  /** Unique label within the package (e.g. "EXHIBIT-A"). */
  label: string;
  /** Human-readable description. */
  description: string;
  /** MIME type. */
  mimeType: string;
  /** SHA-256 hash of the item content. */
  hashSha256: string;
  /** Byte size. */
  sizeBytes: number;
  /** Relative path inside the package archive. */
  relativePath: string;
}

/** System metadata embedded in the evidence package for reproducibility. */
export interface EvidenceSystemInfo {
  platform: string;
  pipelineVersion: string;
  thresholdVersion: string;
  /** ISO 8601 timestamp of the analysis run. */
  analysisTimestamp: string;
  /** Normalization parameters used during analysis. */
  normalization: {
    sampleRate: number;
    bitDepth: number;
    channels: number;
  };
}

// ────────────────────────────────────────────────────────────────────────────
// Chain of Custody
// ────────────────────────────────────────────────────────────────────────────

/** A single entry in the chain-of-custody log. */
export interface ChainOfCustodyEntry {
  /** Monotonically increasing sequence number. */
  sequence: number;
  /** ISO 8601 timestamp of the event. */
  timestamp: string;
  /** Who or what performed the action (user ID or system identifier). */
  actor: string;
  /** Human-readable action description. */
  action: string;
  /** SHA-256 hash of the entity *after* this action. */
  hashAfter: string;
  /** SHA-256 hash of the entity *before* this action (null for first entry). */
  hashBefore: string | null;
  /** IP address of the actor (null for system actions). */
  ipAddress: string | null;
  /** Additional context. */
  metadata: Record<string, unknown> | null;
}

// ────────────────────────────────────────────────────────────────────────────
// Expert Annotations
// ────────────────────────────────────────────────────────────────────────────

/** The type of annotation an expert can leave. */
export type AnnotationType = "similarity" | "difference" | "note" | "opinion";

/** An expert annotation attached to a forensic case. */
export interface ExpertAnnotation {
  id: string;
  forensicCaseId: string;
  expertId: string;
  expertName: string;
  /** Optional link to a specific analysis match. */
  analysisMatchId: string | null;
  /** Start timestamp in the audio (seconds). */
  timestampStart: number;
  /** End timestamp in the audio (seconds). */
  timestampEnd: number;
  annotationType: AnnotationType;
  /** The expert's written annotation. */
  content: string;
  /** Expert's self-assessed confidence (0.0 – 1.0). */
  confidence: number;
  metadata: Record<string, unknown> | null;
  createdAt: string;
  updatedAt: string;
}

/** Summary of all expert annotations on a forensic case. */
export interface ExpertAnnotationSummary {
  forensicCaseId: string;
  totalAnnotations: number;
  byType: Record<AnnotationType, number>;
  averageConfidence: number;
  experts: {
    expertId: string;
    expertName: string;
    annotationCount: number;
  }[];
}

/** Parameters for creating or updating an expert annotation. */
export interface ExpertAnnotationInput {
  forensicCaseId: string;
  analysisMatchId?: string | null;
  timestampStart: number;
  timestampEnd: number;
  annotationType: AnnotationType;
  content: string;
  confidence: number;
  metadata?: Record<string, unknown> | null;
}
