/**
 * PROBATIO — pgvector Helpers
 *
 * Utilities for formatting embeddings for Supabase's pgvector extension.
 * Supabase JS client accepts number[] directly for vector columns,
 * but these helpers add validation and formatting safety.
 */

/**
 * Validate that an embedding has the expected dimensionality.
 * Throws if the dimension doesn't match — catches CLAP output bugs
 * before they corrupt the database.
 */
export function validateEmbeddingDim(
  embedding: number[],
  expected: number = 512
): void {
  if (!Array.isArray(embedding)) {
    throw new Error(`Embedding must be an array, got ${typeof embedding}`);
  }
  if (embedding.length !== expected) {
    throw new Error(
      `Embedding dimension mismatch: expected ${expected}, got ${embedding.length}`
    );
  }
  if (embedding.some((v) => typeof v !== "number" || isNaN(v))) {
    throw new Error("Embedding contains non-numeric or NaN values");
  }
}

/**
 * Format a number array as a pgvector string: '[0.1,0.2,...]'
 * Supabase JS client handles number[] natively for vector columns,
 * but this is useful for RPC calls and raw SQL.
 */
export function formatPgVector(embedding: number[]): string {
  return `[${embedding.join(",")}]`;
}

/**
 * Normalize an embedding to unit length (L2 norm = 1).
 * Required for cosine similarity to work correctly with pgvector's <=> operator.
 */
export function normalizeEmbedding(embedding: number[]): number[] {
  const norm = Math.sqrt(embedding.reduce((sum, v) => sum + v * v, 0));
  if (norm === 0) return embedding;
  return embedding.map((v) => v / norm);
}

/**
 * Compute cosine similarity between two embeddings.
 * Both must be the same dimension. Returns value between -1 and 1.
 */
export function cosineSimilarity(a: number[], b: number[]): number {
  if (a.length !== b.length) {
    throw new Error(`Dimension mismatch: ${a.length} vs ${b.length}`);
  }
  let dot = 0;
  let normA = 0;
  let normB = 0;
  for (let i = 0; i < a.length; i++) {
    dot += a[i] * b[i];
    normA += a[i] * a[i];
    normB += b[i] * b[i];
  }
  const denom = Math.sqrt(normA) * Math.sqrt(normB);
  return denom === 0 ? 0 : dot / denom;
}
