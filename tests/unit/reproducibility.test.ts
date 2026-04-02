import { describe, it, expect } from "vitest";
import {
  compareHashes,
  compareEmbeddings,
  compareScores,
  buildVerificationResult,
} from "@/lib/reproducibility/verification";
import { DRIFT_TOLERANCES, TEST_CORPUS, CORPUS_VERSION, runDriftDetection } from "@/lib/reproducibility/drift-detection";

function createMockEmbedding(dim: number = 512): number[] {
  const raw = Array.from({ length: dim }, () => Math.random() - 0.5);
  const norm = Math.sqrt(raw.reduce((s, v) => s + v * v, 0));
  return raw.map((v) => v / norm);
}

describe("Tier 1: Reproducibility Verification", () => {

  describe("Hash Comparison", () => {
    it("identical hashes pass", () => {
      const hash = "a".repeat(64);
      const result = compareHashes(hash, hash);
      expect(result.pass).toBe(true);
      expect(result.match).toBe(true);
    });

    it("different hashes fail", () => {
      const result = compareHashes("a".repeat(64), "b".repeat(64));
      expect(result.pass).toBe(false);
    });

    it("case-insensitive comparison", () => {
      const result = compareHashes("aAbBcC" + "0".repeat(58), "aabbcc" + "0".repeat(58));
      expect(result.pass).toBe(true);
    });
  });

  describe("Embedding Comparison", () => {
    it("identical vectors pass with similarity 1.0", () => {
      const v = createMockEmbedding(512);
      const result = compareEmbeddings(v, v);
      expect(result.cosineSimilarity).toBeCloseTo(1.0, 5);
      expect(result.pass).toBe(true);
    });

    it("different random vectors fail", () => {
      const a = createMockEmbedding(512);
      const b = createMockEmbedding(512);
      const result = compareEmbeddings(a, b, 0.001);
      expect(result.pass).toBe(false);
    });

    it("respects tolerance parameter", () => {
      const v = createMockEmbedding(512);
      // Slightly perturb one element
      const perturbed = [...v];
      perturbed[0] += 0.0001;
      const result = compareEmbeddings(v, perturbed, 0.01);
      expect(result.pass).toBe(true); // Within tolerance
    });
  });

  describe("Score Comparison", () => {
    it("identical scores pass", () => {
      const result = compareScores(0.87, 0.87, 0.001);
      expect(result.pass).toBe(true);
      expect(result.diff).toBe(0);
    });

    it("scores within tolerance pass", () => {
      const result = compareScores(0.870000, 0.870001, 0.001);
      expect(result.pass).toBe(true);
    });

    it("scores outside tolerance fail", () => {
      const result = compareScores(0.87, 0.88, 0.001);
      expect(result.pass).toBe(false);
      expect(result.diff).toBeCloseTo(0.01, 5);
    });

    it("returns original, rerun, diff, and tolerance", () => {
      const result = compareScores(0.5, 0.6, 0.01);
      expect(result.original).toBe(0.5);
      expect(result.rerun).toBe(0.6);
      expect(result.diff).toBeCloseTo(0.1, 5);
      expect(result.tolerance).toBe(0.01);
    });
  });

  describe("Verification Result Builder", () => {
    it("reports reproducible when all checks pass", () => {
      const result = buildVerificationResult("test-id", "v1.0.0", {
        riskLevel: { pass: true, original: "high", rerun: "high" },
        overallScore: { pass: true, original: 0.87, rerun: 0.87, diff: 0, tolerance: 0.001 },
      });
      expect(result.reproducible).toBe(true);
    });

    it("reports not reproducible when any check fails", () => {
      const result = buildVerificationResult("test-id", "v1.0.0", {
        riskLevel: { pass: true, original: "high", rerun: "high" },
        overallScore: { pass: false, original: 0.87, rerun: 0.90, diff: 0.03, tolerance: 0.001 },
      });
      expect(result.reproducible).toBe(false);
    });

    it("includes timestamp", () => {
      const result = buildVerificationResult("test-id", "v1.0.0", {});
      expect(result.timestamp).toBeTruthy();
      expect(new Date(result.timestamp).getTime()).toBeGreaterThan(0);
    });
  });

  describe("Drift Detection", () => {
    it("test corpus has at least 3 tracks", () => {
      expect(TEST_CORPUS.length).toBeGreaterThanOrEqual(3);
    });

    it("corpus version is defined", () => {
      expect(CORPUS_VERSION).toBeTruthy();
    });

    it("drift tolerances are defined for all metrics", () => {
      expect(DRIFT_TOLERANCES.lufs).toBeDefined();
      expect(DRIFT_TOLERANCES.tempoBpm).toBeDefined();
      expect(DRIFT_TOLERANCES.embeddingSimilarity).toBeDefined();
      expect(DRIFT_TOLERANCES.score).toBeDefined();
    });

    it("runDriftDetection returns valid result", async () => {
      const result = await runDriftDetection("v1.0.0-test");
      expect(result.corpusVersion).toBe(CORPUS_VERSION);
      expect(result.pipelineVersion).toBe("v1.0.0-test");
      expect(result.allPassed).toBe(true);
      expect(result.tracks.length).toBeGreaterThanOrEqual(3);
    });

    it("each test track has at least one check", async () => {
      const result = await runDriftDetection("v1.0.0-test");
      for (const track of result.tracks) {
        expect(Object.keys(track.checks).length).toBeGreaterThanOrEqual(1);
      }
    });
  });

  describe("Determinism Guarantees", () => {
    it("same weighted score computation is deterministic (1000 runs)", async () => {
      const { computeRefinedScores } = await import("@/lib/comparison/scoring");
      const evidence = [
        { dimension: "melody", similarity_score: 0.94, source_start_sec: 0, source_end_sec: 4, target_start_sec: 0, target_end_sec: 4, detail: {}, description: "" },
        { dimension: "harmony", similarity_score: 0.72, source_start_sec: 0, source_end_sec: 4, target_start_sec: 0, target_end_sec: 4, detail: {}, description: "" },
      ];
      const results = new Set<string>();
      for (let i = 0; i < 1000; i++) {
        const r = computeRefinedScores(evidence);
        results.add(r.overall.toFixed(10));
      }
      expect(results.size).toBe(1);
    });

    it("same risk classification is deterministic (1000 runs)", async () => {
      const { classifyRiskFromScore } = await import("@/lib/comparison/scoring");
      const results = new Set<string>();
      for (let i = 0; i < 1000; i++) {
        results.add(classifyRiskFromScore(0.72));
      }
      expect(results.size).toBe(1);
    });
  });
});
