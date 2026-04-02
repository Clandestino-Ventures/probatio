import { describe, it, expect } from "vitest";
import { cosineSimilarity, formatPgVector, validateEmbeddingDim, normalizeEmbedding } from "@/lib/pgvector";
import { computeDTW, computeDTWWithTransposition } from "@/lib/forensic/dtw";

describe("Tier 4: Business Logic", () => {

  describe("Cosine Similarity", () => {
    it("identical vectors return 1.0", () => {
      const v = [0.5, 0.3, 0.8, 0.1, 0.6];
      expect(cosineSimilarity(v, v)).toBeCloseTo(1.0, 5);
    });

    it("orthogonal vectors return 0.0", () => {
      expect(cosineSimilarity([1, 0, 0], [0, 1, 0])).toBeCloseTo(0.0, 5);
    });

    it("opposite vectors return -1.0", () => {
      expect(cosineSimilarity([1, 0], [-1, 0])).toBeCloseTo(-1.0, 5);
    });

    it("normalized random 512-dim vectors produce values in [-1, 1]", () => {
      for (let i = 0; i < 20; i++) {
        const a = normalizeEmbedding(Array.from({ length: 512 }, () => Math.random() - 0.5));
        const b = normalizeEmbedding(Array.from({ length: 512 }, () => Math.random() - 0.5));
        const sim = cosineSimilarity(a, b);
        expect(sim).toBeGreaterThanOrEqual(-1.001);
        expect(sim).toBeLessThanOrEqual(1.001);
      }
    });

    it("throws on dimension mismatch", () => {
      expect(() => cosineSimilarity([1, 2], [1, 2, 3])).toThrow();
    });
  });

  describe("pgvector Formatting", () => {
    it("formatPgVector produces bracket-delimited string", () => {
      expect(formatPgVector([0.1, 0.2, 0.3])).toBe("[0.1,0.2,0.3]");
    });

    it("formatPgVector handles empty array", () => {
      expect(formatPgVector([])).toBe("[]");
    });

    it("validateEmbeddingDim accepts correct dimension", () => {
      expect(() => validateEmbeddingDim(new Array(512).fill(0), 512)).not.toThrow();
    });

    it("validateEmbeddingDim rejects wrong dimension", () => {
      expect(() => validateEmbeddingDim(new Array(256).fill(0), 512)).toThrow();
    });

    it("validateEmbeddingDim rejects NaN values", () => {
      const arr = new Array(512).fill(0);
      arr[100] = NaN;
      expect(() => validateEmbeddingDim(arr, 512)).toThrow();
    });

    it("normalizeEmbedding produces unit vector", () => {
      const raw = [3, 4, 0, 0]; // norm = 5
      const normalized = normalizeEmbedding(raw);
      expect(normalized[0]).toBeCloseTo(0.6, 5);
      expect(normalized[1]).toBeCloseTo(0.8, 5);
      // L2 norm should be 1
      const norm = Math.sqrt(normalized.reduce((s, v) => s + v * v, 0));
      expect(norm).toBeCloseTo(1.0, 5);
    });
  });

  describe("DTW", () => {
    it("identical sequences produce distance 0", () => {
      const seq = [440, 494, 523, 587, 659];
      const result = computeDTW(seq, seq);
      expect(result.totalDistance).toBeCloseTo(0, 1);
    });

    it("reversed sequence produces positive distance", () => {
      const seq = [440, 494, 523, 587, 659];
      const rev = [...seq].reverse();
      const result = computeDTW(seq, rev);
      expect(result.totalDistance).toBeGreaterThan(0);
    });

    it("handles different length sequences", () => {
      const short = [440, 494, 523];
      const long = [440, 494, 523, 587, 659, 698];
      const result = computeDTW(short, long);
      expect(result.path.length).toBeGreaterThan(0);
      expect(result.normalizedDistance).toBeGreaterThanOrEqual(0);
    });

    it("returns valid path", () => {
      const a = [440, 494, 523, 587];
      const b = [440, 523, 587, 659];
      const result = computeDTW(a, b);
      // Path should start at [0,0] and end at [len-1, len-1]
      expect(result.path[0]).toEqual([0, 0]);
      expect(result.path[result.path.length - 1]).toEqual([a.length - 1, b.length - 1]);
    });
  });

  describe("DTW with Transposition Detection", () => {
    it("detects zero transposition for identical sequences", () => {
      const freq = [440, 494, 523, 587, 659];
      const result = computeDTWWithTransposition(freq, freq);
      expect(result.transpositionSemitones).toBe(0);
      expect(result.bestSimilarity).toBeGreaterThan(0.8);
    });

    it("checks all 12 transpositions", () => {
      const freq = [440, 494, 523, 587, 659];
      const result = computeDTWWithTransposition(freq, freq);
      expect(result.allTranspositions.length).toBe(12);
    });

    it("handles empty frequency arrays gracefully", () => {
      const result = computeDTWWithTransposition([], [440, 494]);
      expect(result.bestSimilarity).toBe(0);
      expect(result.allTranspositions.length).toBe(0);
    });
  });
});
