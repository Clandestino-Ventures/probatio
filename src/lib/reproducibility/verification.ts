/**
 * PROBATIO — Reproducibility Verification
 *
 * Functions for comparing re-analysis outputs against originals
 * to prove deterministic reproducibility.
 */

import { cosineSimilarity } from "@/lib/pgvector";

export interface HashComparisonResult {
  pass: boolean;
  original: string;
  rerun: string;
  match: boolean;
}

export interface EmbeddingComparisonResult {
  cosineSimilarity: number;
  pass: boolean;
}

export interface ScoreComparisonResult {
  pass: boolean;
  original: number;
  rerun: number;
  diff: number;
  tolerance: number;
}

export interface VerificationResult {
  analysisId: string;
  pipelineVersion: string;
  reproducible: boolean;
  timestamp: string;
  checks: {
    stemHashes?: {
      pass: boolean;
      detail: Record<string, HashComparisonResult>;
    };
    featuresHash?: {
      pass: boolean;
      original: string;
      rerun: string;
    };
    embeddings?: {
      pass: boolean;
      detail: Record<string, EmbeddingComparisonResult>;
    };
    riskLevel?: {
      pass: boolean;
      original: string;
      rerun: string;
    };
    overallScore?: ScoreComparisonResult;
  };
}

/**
 * Compare two SHA-256 hashes.
 */
export function compareHashes(original: string, rerun: string): HashComparisonResult {
  const match = original.toLowerCase() === rerun.toLowerCase();
  return { pass: match, original, rerun, match };
}

/**
 * Compare two embedding vectors.
 * Pass if cosine similarity >= 1.0 - tolerance.
 */
export function compareEmbeddings(
  original: number[],
  rerun: number[],
  tolerance: number = 0.001
): EmbeddingComparisonResult {
  const sim = cosineSimilarity(original, rerun);
  return {
    cosineSimilarity: sim,
    pass: Math.abs(sim - 1.0) < tolerance,
  };
}

/**
 * Compare two numeric scores with tolerance.
 */
export function compareScores(
  original: number,
  rerun: number,
  tolerance: number = 0.001
): ScoreComparisonResult {
  const diff = Math.abs(original - rerun);
  return {
    pass: diff < tolerance,
    original,
    rerun,
    diff,
    tolerance,
  };
}

/**
 * Build a verification result from individual check results.
 */
export function buildVerificationResult(
  analysisId: string,
  pipelineVersion: string,
  checks: VerificationResult["checks"]
): VerificationResult {
  const allPass = Object.values(checks).every((check) =>
    check ? check.pass : true
  );

  return {
    analysisId,
    pipelineVersion,
    reproducible: allPass,
    timestamp: new Date().toISOString(),
    checks,
  };
}
