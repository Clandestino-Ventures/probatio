import { describe, it, expect } from 'vitest';
import {
  weightedScore,
  computeOverallSimilarity,
  cosineSimilarity,
  euclideanSimilarity,
  DEFAULT_WEIGHTS,
} from '@/lib/analysis/similarity';

describe('similarity scoring', () => {
  // 1. Overall score is weighted average of components
  it('weightedScore computes correct weighted average', () => {
    const scores = { melody: 0.8, harmony: 0.6, rhythm: 0.4, structure: 0.2 };
    const result = weightedScore(scores, DEFAULT_WEIGHTS);
    // melody=0.35, harmony=0.25, rhythm=0.20, structure=0.20
    // 0.8*0.35 + 0.6*0.25 + 0.4*0.20 + 0.2*0.20 = 0.28 + 0.15 + 0.08 + 0.04 = 0.55
    expect(result).toBeCloseTo(0.55, 10);
  });

  // 2. Cosine similarity of identical vectors returns 1.0
  it('cosineSimilarity of identical vectors returns 1.0', () => {
    const vec = [1, 2, 3, 4, 5];
    expect(cosineSimilarity(vec, vec)).toBeCloseTo(1.0, 10);
  });

  // 3. Cosine similarity of orthogonal vectors returns 0.0
  it('cosineSimilarity of orthogonal vectors returns 0.0', () => {
    const a = [1, 0, 0];
    const b = [0, 1, 0];
    expect(cosineSimilarity(a, b)).toBeCloseTo(0.0, 10);
  });

  // 4. Zero-length vectors handled gracefully (throws)
  it('cosineSimilarity throws for empty vectors', () => {
    expect(() => cosineSimilarity([], [])).toThrow('Vectors must not be empty');
  });
});
