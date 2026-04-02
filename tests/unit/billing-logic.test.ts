import { describe, it, expect } from "vitest";
import { PLANS, CREDIT_COSTS } from "@/lib/constants";
import {
  DIMENSION_WEIGHTS,
  computeRefinedScores,
  type SegmentEvidence,
} from "@/lib/comparison/scoring";

describe("Tier 3: Billing Logic", () => {
  describe("Plan Configuration", () => {
    it("free plan has 3 credits", () => {
      expect(PLANS.free.creditsPerMonth).toBe(3);
    });

    it("starter plan has 50 credits at $149/mo", () => {
      expect(PLANS.starter.creditsPerMonth).toBe(50);
      expect(PLANS.starter.priceCentsMonthly).toBe(14900);
    });

    it("professional plan has forensic access", () => {
      expect(PLANS.professional.forensicAccess).toBe(true);
    });

    it("enterprise plan has forensic access", () => {
      expect(PLANS.enterprise.forensicAccess).toBe(true);
    });

    it("free and starter plans do NOT have forensic access", () => {
      expect(PLANS.free.forensicAccess).toBe(false);
      expect(PLANS.starter.forensicAccess).toBe(false);
    });

    it("credit costs are defined for all modes", () => {
      expect(CREDIT_COSTS.screening).toBe(1);
      expect(CREDIT_COSTS.forensic).toBe(5);
      expect(CREDIT_COSTS.clearance).toBe(2);
    });

    it("professional plan allows all analysis modes", () => {
      expect(PLANS.professional.allowedModes).toContain("screening");
      expect(PLANS.professional.allowedModes).toContain("forensic");
      expect(PLANS.professional.allowedModes).toContain("clearance");
    });

    it("free plan only allows screening mode", () => {
      expect(PLANS.free.allowedModes).toEqual(["screening"]);
    });
  });

  describe("Dimension Weights", () => {
    it("melody has the highest weight (legal significance)", () => {
      expect(DIMENSION_WEIGHTS.melody).toBeGreaterThan(DIMENSION_WEIGHTS.harmony);
      expect(DIMENSION_WEIGHTS.melody).toBeGreaterThan(DIMENSION_WEIGHTS.rhythm);
      expect(DIMENSION_WEIGHTS.melody).toBeGreaterThan(DIMENSION_WEIGHTS.timbre);
    });

    it("weights sum to 1.0", () => {
      const sum = Object.values(DIMENSION_WEIGHTS).reduce((a, b) => a + b, 0);
      expect(sum).toBeCloseTo(1.0, 5);
    });

    it("all weights are positive", () => {
      for (const [, w] of Object.entries(DIMENSION_WEIGHTS)) {
        expect(w).toBeGreaterThan(0);
      }
    });

    it("rhythm and timbre have the lowest weights", () => {
      expect(DIMENSION_WEIGHTS.rhythm).toBeLessThan(DIMENSION_WEIGHTS.melody);
      expect(DIMENSION_WEIGHTS.rhythm).toBeLessThanOrEqual(DIMENSION_WEIGHTS.harmony);
      expect(DIMENSION_WEIGHTS.rhythm).toBeLessThanOrEqual(DIMENSION_WEIGHTS.timbre);
    });
  });

  describe("Weighted Scoring", () => {
    it("computes correct weighted average for two dimensions", () => {
      const evidence: SegmentEvidence[] = [
        {
          dimension: "melody",
          similarity_score: 0.9,
          source_start_sec: 0,
          source_end_sec: 4,
          target_start_sec: 0,
          target_end_sec: 4,
          detail: {},
          description: "",
        },
        {
          dimension: "harmony",
          similarity_score: 0.7,
          source_start_sec: 0,
          source_end_sec: 4,
          target_start_sec: 0,
          target_end_sec: 4,
          detail: {},
          description: "",
        },
      ];
      const result = computeRefinedScores(evidence);
      expect(result.overall).toBeGreaterThan(0);
      expect(result.melody).toBe(0.9);
      expect(result.harmony).toBe(0.7);

      // Manual: (0.9 * 0.35 + 0.7 * 0.25) / (0.35 + 0.25) = (0.315 + 0.175) / 0.6 = 0.8166...
      const expectedOverall =
        (0.9 * DIMENSION_WEIGHTS.melody + 0.7 * DIMENSION_WEIGHTS.harmony) /
        (DIMENSION_WEIGHTS.melody + DIMENSION_WEIGHTS.harmony);
      expect(result.overall).toBeCloseTo(expectedOverall, 5);
    });

    it("returns nulls for empty evidence", () => {
      const result = computeRefinedScores([]);
      expect(result.overall).toBe(0);
      expect(result.melody).toBeNull();
      expect(result.harmony).toBeNull();
      expect(result.rhythm).toBeNull();
      expect(result.timbre).toBeNull();
    });

    it("computes temporal offset from melody evidence", () => {
      const evidence: SegmentEvidence[] = [
        {
          dimension: "melody",
          similarity_score: 0.8,
          source_start_sec: 10,
          source_end_sec: 20,
          target_start_sec: 15,
          target_end_sec: 25,
          detail: {},
          description: "",
        },
      ];
      const result = computeRefinedScores(evidence);
      // temporal_offset = target_start - source_start = 15 - 10 = 5
      expect(result.temporal_offset).toBe(5);
    });

    it("averages multiple segments within same dimension", () => {
      const evidence: SegmentEvidence[] = [
        {
          dimension: "melody",
          similarity_score: 0.8,
          source_start_sec: 0,
          source_end_sec: 4,
          target_start_sec: 0,
          target_end_sec: 4,
          detail: {},
          description: "",
        },
        {
          dimension: "melody",
          similarity_score: 0.6,
          source_start_sec: 4,
          source_end_sec: 8,
          target_start_sec: 4,
          target_end_sec: 8,
          detail: {},
          description: "",
        },
      ];
      const result = computeRefinedScores(evidence);
      // Average of 0.8 and 0.6 = 0.7
      expect(result.melody).toBeCloseTo(0.7, 5);
    });
  });
});
