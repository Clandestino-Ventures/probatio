import { describe, it, expect } from "vitest";
import {
  buildAnalysisContext,
  extractCitations,
  extractFollowUps,
  type AnalysisQAContext,
} from "@/lib/ai/analysis-qa";
import { getSuggestedQuestions } from "@/lib/ai/suggested-questions";
import type { AnalysisRow, AnalysisMatchRow, MatchEvidenceRow } from "@/types/database";

// ────────────────────────────────────────────────────────────────────────────
// Test Helpers
// ────────────────────────────────────────────────────────────────────────────

function makeAnalysis(overrides: Partial<AnalysisRow> = {}): AnalysisRow {
  return {
    id: "test-analysis-001",
    user_id: "user-001",
    mode: "screening",
    status: "completed",
    file_name: "my-track.wav",
    file_hash: "abc123",
    file_size_bytes: 10000000,
    audio_url: null,
    duration_seconds: 210,
    pipeline_version: "1.0.0",
    current_step: null,
    processing_time_ms: 30000,
    stems_urls: null,
    features: null,
    embeddings: null,
    results: null,
    report: null,
    overall_risk: "moderate",
    overall_score: 0.55,
    match_count: 1,
    output_hash: null,
    error_message: null,
    error_step: null,
    normalization_params: null,
    progress_pct: 100,
    identified_track: null,
    normalized_audio_url: null,
    normalized_hash: null,
    normalization_metrics: null,
    lyrics_text: null,
    lyrics_language: null,
    detected_genre: "pop",
    genre_confidence: 0.85,
    batch_id: null,
    catalog_ids: null,
    monitoring_enabled: false,
    last_monitored_at: null,
    monitoring_catalog_ids: null,
    litigation_assessment: null,
    clearance_status: null,
    audio_expires_at: null,
    audio_deleted_at: null,
    deletion_notified: false,
    deletion_notification_sent_at: null,
    created_at: "2024-01-01T00:00:00Z",
    updated_at: "2024-01-01T00:00:00Z",
    ...overrides,
  };
}

function makeMatch(overrides: Partial<AnalysisMatchRow> = {}): AnalysisMatchRow {
  return {
    id: "match-001",
    analysis_id: "test-analysis-001",
    reference_track_id: "ref-001",
    compared_analysis_id: null,
    similarity_score: {},
    overall_similarity: 0.55,
    score_melody: 0.82,
    score_harmony: 0.45,
    score_rhythm: 0.30,
    score_timbre: 0.25,
    score_lyrics: null,
    score_overall: 0.55,
    score_melody_adjusted: 0.71,
    score_harmony_adjusted: 0.40,
    score_rhythm_adjusted: 0.17,
    score_timbre_adjusted: 0.20,
    score_lyrics_adjusted: null,
    score_overall_adjusted: 0.48,
    detected_genre: "pop",
    genre_confidence: 0.85,
    risk_level: "moderate",
    timestamps_similarity: null,
    rights_info: null,
    action_recommended: null,
    match_source: "embedding",
    created_at: "2024-01-01T00:00:00Z",
    ...overrides,
  };
}

function makeEvidence(overrides: Partial<MatchEvidenceRow> = {}): MatchEvidenceRow {
  return {
    id: "ev-001",
    match_id: "match-001",
    source_start_sec: 48,
    source_end_sec: 52,
    target_start_sec: 32,
    target_end_sec: 36,
    dimension: "melody",
    similarity_score: 0.94,
    detail: { transposition_semitones: 2 },
    description: null,
    resolution: "bar",
    created_at: "2024-01-01T00:00:00Z",
    ...overrides,
  };
}

function makeContext(overrides: Partial<AnalysisQAContext> = {}): AnalysisQAContext {
  return {
    analysis: makeAnalysis(),
    matches: [
      {
        match: makeMatch(),
        evidence: [
          makeEvidence(),
          makeEvidence({
            id: "ev-002",
            source_start_sec: 72,
            source_end_sec: 76,
            target_start_sec: 56,
            target_end_sec: 60,
            dimension: "harmony",
            similarity_score: 0.58,
            detail: {},
            resolution: "phrase",
          }),
        ],
        reference: {
          id: "ref-001",
          title: "Reference Song",
          artist: "Reference Artist",
          album: null,
          isrc: "US1234567890",
          release_year: 2020,
          genre: "Pop",
          fingerprint: null,
          duration_seconds: 195,
          source: "catalog",
          visibility: "public",
          organization_id: null,
          contributed_by: null,
          catalog_id: null,
          embedding: null,
          embedding_vocals: null,
          lyrics_embedding: null,
          acoustid: null,
          musicbrainz_id: null,
          publisher: null,
          composer: null,
          pro_registration: null,
          fingerprinted: true,
          status: "completed",
          features_json: null,
          lyrics_text: null,
          lyrics_language: null,
          audio_url: null,
          error_message: null,
          created_at: "2020-01-01T00:00:00Z",
        },
      },
    ],
    ...overrides,
  };
}

// ────────────────────────────────────────────────────────────────────────────
// Context Builder
// ────────────────────────────────────────────────────────────────────────────

describe("buildAnalysisContext", () => {
  it("includes track info, scores, and evidence", () => {
    const ctx = makeContext();
    const result = buildAnalysisContext(ctx);

    expect(result).toContain("my-track.wav");
    expect(result).toContain("pop");
    expect(result).toContain("MODERATE");
    expect(result).toContain("Reference Song");
    expect(result).toContain("Reference Artist");
    expect(result).toContain("melody: 82%");
    expect(result).toContain("0:48-0:52");
    expect(result).toContain("transposed +2 semitones");
  });

  it("handles no matches", () => {
    const ctx = makeContext({ matches: [] });
    const result = buildAnalysisContext(ctx);

    expect(result).toContain("No significant matches");
    expect(result).not.toContain("Evidence Points");
  });

  it("includes litigation assessment when present", () => {
    const ctx = makeContext({
      litigationAssessment: {
        overallRisk: "high",
        litigationProbability: "55-70%",
        mostSimilarPrecedent: {
          name: "Williams v. Gaye",
          citation: "885 F.3d 1150",
          ruling: "infringement",
          whySimilar: "Similar constellation",
        },
        additionalPrecedents: [],
        arnsteinAnalysis: {
          extrinsicTest: "test",
          intrinsicTest: "test",
          conclusion: "test",
        },
        strengths: ["High melody"],
        weaknesses: ["Genre"],
        potentialDefenses: [
          { defense: "Scenes a faire", applicability: "moderate", explanation: "Genre" },
        ],
        recommendations: ["Review"],
        fullNarrative: "narrative",
        assessmentConfidence: "high",
        confidenceReason: "reason",
      },
    });
    const result = buildAnalysisContext(ctx);

    expect(result).toContain("LITIGATION RISK ASSESSMENT");
    expect(result).toContain("Williams v. Gaye");
    expect(result).toContain("55-70%");
  });
});

// ────────────────────────────────────────────────────────────────────────────
// Citation Extraction
// ────────────────────────────────────────────────────────────────────────────

describe("extractCitations", () => {
  it("extracts timestamps", () => {
    const text = "The similarity at 0:48-0:52 is very high.";
    const citations = extractCitations(text);
    expect(citations.some((c) => c.type === "evidence" && c.reference.includes("0:48-0:52"))).toBe(true);
  });

  it("extracts score references", () => {
    const text = "The 82% melody score is driven by the hook.";
    const citations = extractCitations(text);
    expect(citations.some((c) => c.type === "score" && c.reference.includes("melody"))).toBe(true);
  });

  it("extracts case law references", () => {
    const text = "This is similar to Williams v. Gaye where courts found infringement.";
    const citations = extractCitations(text);
    expect(citations.some((c) => c.type === "precedent" && c.reference.includes("Williams v. Gaye"))).toBe(true);
  });

  it("extracts methodology references", () => {
    const text = "The CREPE pitch detector and DTW alignment show strong correlation.";
    const citations = extractCitations(text);
    expect(citations.some((c) => c.type === "methodology" && c.reference === "CREPE")).toBe(true);
    expect(citations.some((c) => c.type === "methodology" && c.reference === "DTW")).toBe(true);
  });

  it("deduplicates citations", () => {
    const text = "At 0:48-0:52 the melody is 82% melody similar. Again at 0:48-0:52.";
    const citations = extractCitations(text);
    const timestamps = citations.filter((c) => c.reference.includes("0:48-0:52"));
    expect(timestamps.length).toBe(1);
  });
});

// ────────────────────────────────────────────────────────────────────────────
// Follow-up Extraction
// ────────────────────────────────────────────────────────────────────────────

describe("extractFollowUps", () => {
  it("extracts arrow-prefixed follow-ups", () => {
    const text = `The melody score is high.

→ "How can I reduce this?"
→ "Is the harmony also a concern?"`;

    const { cleanedText, followUps } = extractFollowUps(text);
    expect(followUps).toHaveLength(2);
    expect(followUps[0]).toBe("How can I reduce this?");
    expect(followUps[1]).toBe("Is the harmony also a concern?");
    expect(cleanedText).not.toContain("→");
  });

  it("handles text without follow-ups", () => {
    const text = "The melody score is 82% and driven by the chorus.";
    const { cleanedText, followUps } = extractFollowUps(text);
    expect(followUps).toHaveLength(0);
    expect(cleanedText).toBe(text);
  });

  it("handles -> alternative arrow syntax", () => {
    const text = `Answer here.
-> Follow up 1
-> Follow up 2`;
    const { followUps } = extractFollowUps(text);
    expect(followUps).toHaveLength(2);
    expect(followUps[0]).toBe("Follow up 1");
  });
});

// ────────────────────────────────────────────────────────────────────────────
// Suggested Questions
// ────────────────────────────────────────────────────────────────────────────

describe("getSuggestedQuestions", () => {
  it("suggests question about highest dimension", () => {
    const ctx = makeContext();
    const questions = getSuggestedQuestions(ctx);
    expect(questions.some((q) => q.toLowerCase().includes("melody"))).toBe(true);
  });

  it("suggests transposition question when detected", () => {
    const ctx = makeContext();
    const questions = getSuggestedQuestions(ctx);
    expect(questions.some((q) => q.toLowerCase().includes("transposition"))).toBe(true);
  });

  it("suggests remediation question", () => {
    const ctx = makeContext();
    const questions = getSuggestedQuestions(ctx);
    expect(questions.some((q) => q.toLowerCase().includes("modify") || q.toLowerCase().includes("reduce"))).toBe(true);
  });

  it("returns max 5 suggestions", () => {
    const ctx = makeContext({
      litigationAssessment: {
        overallRisk: "high",
        litigationProbability: "55-70%",
        mostSimilarPrecedent: { name: "Test", citation: "Test", ruling: "infringement", whySimilar: "test" },
        additionalPrecedents: [],
        arnsteinAnalysis: { extrinsicTest: "", intrinsicTest: "", conclusion: "" },
        strengths: [],
        weaknesses: [],
        potentialDefenses: [],
        recommendations: [],
        fullNarrative: "",
        assessmentConfidence: "high",
        confidenceReason: "",
      },
    });
    const questions = getSuggestedQuestions(ctx);
    expect(questions.length).toBeLessThanOrEqual(5);
  });

  it("handles no matches gracefully", () => {
    const ctx = makeContext({ matches: [] });
    const questions = getSuggestedQuestions(ctx);
    expect(questions.length).toBeGreaterThan(0);
    expect(questions.some((q) => q.toLowerCase().includes("no matches"))).toBe(true);
  });

  it("suggests case law question when litigation assessment exists", () => {
    const ctx = makeContext({
      litigationAssessment: {
        overallRisk: "moderate",
        litigationProbability: "30-50%",
        mostSimilarPrecedent: { name: "Test", citation: "Test", ruling: "settled", whySimilar: "test" },
        additionalPrecedents: [],
        arnsteinAnalysis: { extrinsicTest: "", intrinsicTest: "", conclusion: "" },
        strengths: [],
        weaknesses: [],
        potentialDefenses: [],
        recommendations: [],
        fullNarrative: "",
        assessmentConfidence: "medium",
        confidenceReason: "",
      },
    });
    const questions = getSuggestedQuestions(ctx);
    expect(questions.some((q) => q.toLowerCase().includes("case law"))).toBe(true);
  });
});
