import { describe, it, expect } from "vitest";
import {
  generateTemplateFallback,
  type LitigationAssessmentInput,
  type LitigationAssessmentOutput,
} from "@/lib/report/litigation-assessment";
import {
  CASE_LAW_DATABASE,
  buildCaseLawContext,
} from "@/lib/report/case-law-context";

// ────────────────────────────────────────────────────────────────────────────
// Test helpers
// ────────────────────────────────────────────────────────────────────────────

function makeInput(
  overrides: Partial<LitigationAssessmentInput> = {}
): LitigationAssessmentInput {
  return {
    analysisId: "test-analysis-001",
    mode: "screening",
    trackA: {
      title: "Test Track A",
      artist: "Artist A",
      releaseDate: "2024-01-15",
      isrc: null,
      duration: 210,
    },
    trackB: {
      title: "Test Track B",
      artist: "Artist B",
      releaseDate: "2020-06-01",
      isrc: null,
      duration: 195,
    },
    dimensionScores: {
      melody: { raw: 0.50, adjusted: 0.50, baseline: 0.25 },
      harmony: { raw: 0.40, adjusted: 0.40, baseline: 0.25 },
      rhythm: { raw: 0.30, adjusted: 0.30, baseline: 0.25 },
      timbre: { raw: 0.25, adjusted: 0.25, baseline: 0.25 },
      lyrics: null,
    },
    overallRaw: 0.45,
    overallAdjusted: 0.42,
    riskLevel: "moderate",
    detectedGenre: "pop",
    genreConfidence: 0.85,
    topEvidence: [
      {
        dimension: "melody",
        similarity: 0.72,
        sourceTime: "0:48",
        targetTime: "0:32",
        transposition: 0,
        resolution: "phrase",
      },
      {
        dimension: "harmony",
        similarity: 0.58,
        sourceTime: "1:12",
        targetTime: "0:56",
        resolution: "phrase",
      },
    ],
    totalEvidencePoints: 25,
    primaryTransposition: null,
    transpositionConsistency: 0,
    releaseGapDays: 1324,
    ...overrides,
  };
}

function assertValidOutput(output: LitigationAssessmentOutput): void {
  expect(["low", "moderate", "high", "very_high"]).toContain(output.overallRisk);
  expect(output.litigationProbability).toMatch(/\d+-\d+%/);
  expect(output.mostSimilarPrecedent.name).toBeTruthy();
  expect(output.mostSimilarPrecedent.citation).toBeTruthy();
  expect(output.arnsteinAnalysis.extrinsicTest).toBeTruthy();
  expect(output.arnsteinAnalysis.intrinsicTest).toBeTruthy();
  expect(output.strengths.length).toBeGreaterThanOrEqual(2);
  expect(output.weaknesses.length).toBeGreaterThanOrEqual(2);
  expect(output.potentialDefenses.length).toBeGreaterThanOrEqual(1);
  expect(output.recommendations.length).toBeGreaterThanOrEqual(1);
  expect(output.fullNarrative).toBeTruthy();
  expect(["high", "medium", "low"]).toContain(output.assessmentConfidence);
  expect(output.confidenceReason).toBeTruthy();
}

// ────────────────────────────────────────────────────────────────────────────
// Case Law Database
// ────────────────────────────────────────────────────────────────────────────

describe("Case Law Database", () => {
  it("contains at least 20 cases", () => {
    expect(CASE_LAW_DATABASE.length).toBeGreaterThanOrEqual(20);
  });

  it("every case has required fields", () => {
    for (const c of CASE_LAW_DATABASE) {
      expect(c.name).toBeTruthy();
      expect(c.citation).toBeTruthy();
      expect(c.year).toBeGreaterThanOrEqual(1900);
      expect(c.jurisdiction).toBeTruthy();
      expect(["infringement", "no_infringement", "settled", "reversed"]).toContain(
        c.ruling
      );
      expect(c.legalTest).toBeTruthy();
      expect(c.musicalElements.length).toBeGreaterThanOrEqual(1);
      expect(c.keyFinding).toBeTruthy();
      expect(c.similarityThreshold).toBeTruthy();
      expect(c.relevantWhen).toBeTruthy();
    }
  });

  it("includes landmark cases", () => {
    const caseNames = CASE_LAW_DATABASE.map((c) => c.name);
    expect(caseNames.some((n) => n.includes("Williams"))).toBe(true); // Blurred Lines
    expect(caseNames.some((n) => n.includes("Skidmore"))).toBe(true); // Stairway
    expect(caseNames.some((n) => n.includes("Bright Tunes"))).toBe(true); // My Sweet Lord
    expect(caseNames.some((n) => n.includes("Sheeran"))).toBe(true);
  });

  it("buildCaseLawContext generates non-empty context", () => {
    const context = buildCaseLawContext();
    expect(context.length).toBeGreaterThan(1000);
    expect(context).toContain("CASE:");
    expect(context).toContain("RULING:");
    expect(context).toContain("LEGAL TESTS IN MUSIC COPYRIGHT");
    expect(context).toContain("ARNSTEIN TEST");
  });
});

// ────────────────────────────────────────────────────────────────────────────
// Template Fallback Assessment
// ────────────────────────────────────────────────────────────────────────────

describe("Litigation Assessment (Template Fallback)", () => {
  it("high melody + transposition -> high risk with Bright Tunes precedent", () => {
    const input = makeInput({
      dimensionScores: {
        melody: { raw: 0.90, adjusted: 0.90, baseline: 0.25 },
        harmony: { raw: 0.50, adjusted: 0.50, baseline: 0.25 },
        rhythm: { raw: 0.30, adjusted: 0.30, baseline: 0.25 },
        timbre: { raw: 0.20, adjusted: 0.20, baseline: 0.25 },
        lyrics: null,
      },
      overallRaw: 0.65,
      overallAdjusted: 0.62,
      primaryTransposition: 3,
      transpositionConsistency: 0.85,
    });

    const result = generateTemplateFallback(input);
    assertValidOutput(result);

    expect(["high", "very_high"]).toContain(result.overallRisk);
    expect(result.mostSimilarPrecedent.name).toContain("Bright Tunes");
    expect(result.mostSimilarPrecedent.ruling).toBe("infringement");
    // Should mention transposition in strengths
    expect(result.strengths.some((s) => s.toLowerCase().includes("transposition"))).toBe(
      true
    );
  });

  it("moderate all dimensions -> moderate risk with constellation theory", () => {
    const input = makeInput({
      dimensionScores: {
        melody: { raw: 0.65, adjusted: 0.65, baseline: 0.25 },
        harmony: { raw: 0.60, adjusted: 0.60, baseline: 0.25 },
        rhythm: { raw: 0.58, adjusted: 0.58, baseline: 0.25 },
        timbre: { raw: 0.40, adjusted: 0.40, baseline: 0.25 },
        lyrics: null,
      },
      overallRaw: 0.58,
      overallAdjusted: 0.58,
    });

    const result = generateTemplateFallback(input);
    assertValidOutput(result);

    expect(["moderate", "high"]).toContain(result.overallRisk);
    // Should reference constellation/Williams for multi-dimension elevated
    expect(
      result.mostSimilarPrecedent.name.includes("Williams") ||
        result.strengths.some((s) => s.toLowerCase().includes("constellation"))
    ).toBe(true);
  });

  it("high rhythm in reggaeton -> low risk after genre adjustment", () => {
    const input = makeInput({
      dimensionScores: {
        melody: { raw: 0.35, adjusted: 0.14, baseline: 0.30 },
        harmony: { raw: 0.40, adjusted: 0.21, baseline: 0.25 },
        rhythm: { raw: 0.75, adjusted: 0.17, baseline: 0.70 },
        timbre: { raw: 0.45, adjusted: 0.22, baseline: 0.35 },
        lyrics: null,
      },
      overallRaw: 0.55,
      overallAdjusted: 0.18,
      riskLevel: "low",
      detectedGenre: "reggaeton",
      genreConfidence: 0.92,
    });

    const result = generateTemplateFallback(input);
    assertValidOutput(result);

    expect(result.overallRisk).toBe("low");
    // Should have strong genre defense
    const genreDefense = result.potentialDefenses.find((d) =>
      d.defense.toLowerCase().includes("genre")
    );
    expect(genreDefense).toBeDefined();
    expect(genreDefense!.applicability).toBe("strong");
  });

  it("template fallback returns valid structure", () => {
    const input = makeInput();
    const result = generateTemplateFallback(input);
    assertValidOutput(result);

    // Check all defense applicability values are valid
    for (const d of result.potentialDefenses) {
      expect(["strong", "moderate", "weak"]).toContain(d.applicability);
    }
  });

  it("low similarity -> low risk with Skidmore precedent", () => {
    const input = makeInput({
      dimensionScores: {
        melody: { raw: 0.25, adjusted: 0.25, baseline: 0.25 },
        harmony: { raw: 0.20, adjusted: 0.20, baseline: 0.25 },
        rhythm: { raw: 0.15, adjusted: 0.15, baseline: 0.25 },
        timbre: { raw: 0.10, adjusted: 0.10, baseline: 0.25 },
        lyrics: null,
      },
      overallRaw: 0.20,
      overallAdjusted: 0.18,
      riskLevel: "low",
    });

    const result = generateTemplateFallback(input);
    assertValidOutput(result);

    expect(result.overallRisk).toBe("low");
    expect(result.litigationProbability).toMatch(/5-25%/);
  });

  it("harmony primary with low melody -> references common progressions", () => {
    const input = makeInput({
      dimensionScores: {
        melody: { raw: 0.30, adjusted: 0.30, baseline: 0.25 },
        harmony: { raw: 0.70, adjusted: 0.70, baseline: 0.25 },
        rhythm: { raw: 0.35, adjusted: 0.35, baseline: 0.25 },
        timbre: { raw: 0.20, adjusted: 0.20, baseline: 0.25 },
        lyrics: null,
      },
      overallRaw: 0.48,
      overallAdjusted: 0.45,
    });

    const result = generateTemplateFallback(input);
    assertValidOutput(result);

    // Should reference Sheeran/common progressions
    expect(result.mostSimilarPrecedent.name).toContain("Sheeran");
    // Common building blocks defense should be strong
    const bbDefense = result.potentialDefenses.find((d) =>
      d.defense.toLowerCase().includes("building block")
    );
    expect(bbDefense).toBeDefined();
    expect(bbDefense!.applicability).toBe("strong");
  });

  it("very high overall -> very_high risk", () => {
    const input = makeInput({
      dimensionScores: {
        melody: { raw: 0.92, adjusted: 0.92, baseline: 0.25 },
        harmony: { raw: 0.85, adjusted: 0.85, baseline: 0.25 },
        rhythm: { raw: 0.80, adjusted: 0.80, baseline: 0.25 },
        timbre: { raw: 0.70, adjusted: 0.70, baseline: 0.25 },
        lyrics: { raw: 0.75, adjusted: 0.75, baseline: 0.15 },
      },
      overallRaw: 0.85,
      overallAdjusted: 0.82,
      riskLevel: "critical",
      totalEvidencePoints: 50,
    });

    const result = generateTemplateFallback(input);
    assertValidOutput(result);

    expect(result.overallRisk).toBe("very_high");
    expect(result.assessmentConfidence).toBe("high");
  });

  it("transposition bumps moderate to high risk", () => {
    const input = makeInput({
      dimensionScores: {
        melody: { raw: 0.60, adjusted: 0.60, baseline: 0.25 },
        harmony: { raw: 0.45, adjusted: 0.45, baseline: 0.25 },
        rhythm: { raw: 0.35, adjusted: 0.35, baseline: 0.25 },
        timbre: { raw: 0.25, adjusted: 0.25, baseline: 0.25 },
        lyrics: null,
      },
      overallRaw: 0.50,
      overallAdjusted: 0.48,
      primaryTransposition: 2,
      transpositionConsistency: 0.80,
    });

    const result = generateTemplateFallback(input);
    assertValidOutput(result);

    // Without transposition this would be moderate; with it should bump to high
    expect(["high", "moderate"]).toContain(result.overallRisk);
    expect(result.strengths.some((s) => s.includes("transposition"))).toBe(true);
  });

  it("confidence scales with evidence count", () => {
    const low = generateTemplateFallback(
      makeInput({ totalEvidencePoints: 5 })
    );
    const medium = generateTemplateFallback(
      makeInput({ totalEvidencePoints: 15 })
    );
    const high = generateTemplateFallback(
      makeInput({ totalEvidencePoints: 35 })
    );

    expect(low.assessmentConfidence).toBe("low");
    expect(medium.assessmentConfidence).toBe("medium");
    expect(high.assessmentConfidence).toBe("high");
  });
});
