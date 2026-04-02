/**
 * PROBATIO — Mock Comparison Data
 *
 * Realistic mock data for testing the pipeline locally without
 * Modal.com or real audio. Used when MODAL_BASE_URL is not set.
 */

import type { ReportOutput } from "@/lib/report/generate-narrative";

export interface MockEvidence {
  dimension: string;
  similarity_score: number;
  source_start_sec: number;
  source_end_sec: number;
  target_start_sec: number;
  target_end_sec: number;
  detail: Record<string, unknown>;
  description: string;
}

/**
 * Generate realistic mock segment comparison evidence.
 * Returns 8-12 evidence points across melody, harmony, and rhythm.
 */
export function mockCompareSegments(): MockEvidence[] {
  return [
    // Melody evidence — strongest matches
    {
      dimension: "melody",
      similarity_score: 0.94,
      source_start_sec: 48.0,
      source_end_sec: 56.0,
      target_start_sec: 32.0,
      target_end_sec: 40.0,
      detail: { transposition_semitones: 2, dtw_distance: 0.08, confidence: 0.92 },
      description: "Vocal melody at 0:48-0:56 matches reference at 0:32-0:40 with 94% similarity, transposed +2 semitones. Strong indicator of melodic interpolation.",
    },
    {
      dimension: "melody",
      similarity_score: 0.87,
      source_start_sec: 72.0,
      source_end_sec: 80.0,
      target_start_sec: 56.0,
      target_end_sec: 64.0,
      detail: { transposition_semitones: 2, dtw_distance: 0.15, confidence: 0.88 },
      description: "Vocal melody at 1:12-1:20 matches reference at 0:56-1:04 with 87% similarity, same transposition (+2 semitones). Pattern consistent with first match.",
    },
    {
      dimension: "melody",
      similarity_score: 0.72,
      source_start_sec: 120.0,
      source_end_sec: 128.0,
      target_start_sec: 80.0,
      target_end_sec: 88.0,
      detail: { transposition_semitones: 0, dtw_distance: 0.31, confidence: 0.78 },
      description: "Melody at 2:00-2:08 shows 72% similarity to reference at 1:20-1:28. No transposition detected.",
    },
    // Harmony evidence
    {
      dimension: "harmony",
      similarity_score: 0.81,
      source_start_sec: 0.0,
      source_end_sec: 32.0,
      target_start_sec: 0.0,
      target_end_sec: 32.0,
      detail: { chord_progression: "I-vi-IV-V", progression_match: true },
      description: "Harmonic progression in intro (0:00-0:32) matches reference intro with 81% similarity. Both use I-vi-IV-V progression.",
    },
    {
      dimension: "harmony",
      similarity_score: 0.68,
      source_start_sec: 48.0,
      source_end_sec: 80.0,
      target_start_sec: 32.0,
      target_end_sec: 64.0,
      detail: { chord_progression: "vi-IV-I-V", progression_match: true },
      description: "Chorus harmony (0:48-1:20) shows 68% similarity. Common progression variant (vi-IV-I-V).",
    },
    // Rhythm evidence — lower similarity (different arrangement)
    {
      dimension: "rhythm",
      similarity_score: 0.45,
      source_start_sec: 0.0,
      source_end_sec: 16.0,
      target_start_sec: 0.0,
      target_end_sec: 16.0,
      detail: { tempo_ratio: 1.02, grid_correlation: 0.41 },
      description: "Rhythmic pattern in intro shows 45% similarity. Different arrangement but similar tempo (±2%).",
    },
    {
      dimension: "rhythm",
      similarity_score: 0.38,
      source_start_sec: 48.0,
      source_end_sec: 64.0,
      target_start_sec: 32.0,
      target_end_sec: 48.0,
      detail: { tempo_ratio: 0.98, grid_correlation: 0.35 },
      description: "Chorus rhythm shows 38% similarity. Onset patterns differ significantly.",
    },
    // Timbre evidence
    {
      dimension: "timbre",
      similarity_score: 0.56,
      source_start_sec: 0.0,
      source_end_sec: 210.0,
      target_start_sec: 0.0,
      target_end_sec: 195.0,
      detail: { spectral_centroid_correlation: 0.52 },
      description: "Overall timbral similarity of 56%. Similar production aesthetics but distinct instrumentation.",
    },
  ];
}

/**
 * Generate a mock report for testing without Claude API.
 */
export function mockGenerateReport(): ReportOutput {
  return {
    executiveSummary: "Forensic audio analysis of the submitted track has identified one significant match in the reference catalog. The analysis detected substantial melodic similarity (87-94%) in the chorus sections, with a consistent transposition of +2 semitones. Harmonic progressions show moderate overlap (68-81%), while rhythmic patterns are largely distinct (38-45%). Overall risk assessment: HIGH (76% maximum similarity). Legal review is strongly recommended before commercial release.",
    methodology: "This analysis was performed using the Probatio forensic audio intelligence platform (pipeline version v1.0.0-alpha). The methodology includes: (1) Audio normalization to 44.1kHz/16-bit/mono, (2) Source separation via Demucs htdemucs_ft, (3) Pitch contour extraction via CREPE neural network, (4) Multi-dimensional embedding generation via CLAP, (5) Vector similarity search with weighted scoring (melody 35%, harmony 25%, timbre 25%, rhythm 15%), (6) Segment-level DTW alignment with transposition detection, and (7) Rights holder identification via MusicBrainz. All intermediate outputs are cryptographically hashed and logged in an immutable chain of custody.",
    matchAnalyses: [{
      matchId: "mock-match-001",
      title: "Noche Original",
      artist: "Santos",
      overallSimilarity: 0.76,
      riskLevel: "high",
      narrative: "The analyzed track shows 76% overall similarity to \"Noche Original\" by Santos. The most significant finding is in the melodic dimension: the vocal melody in the chorus sections (0:48-0:56 and 1:12-1:20) matches the reference track's chorus at 0:32-0:40 and 0:56-1:04 with 87-94% similarity. Critically, a consistent transposition of +2 semitones was detected across both matching sections, suggesting deliberate melodic interpolation rather than coincidental similarity. The harmonic progression in the intro follows the same I-vi-IV-V pattern (81% similarity), though this is a common progression in popular music. Rhythmic patterns show low similarity (38-45%), indicating different arrangements despite melodic overlap.",
      keyEvidence: [
        "Vocal melody at 0:48-0:56 matches reference at 0:32-0:40 with 94% similarity, transposed +2 semitones",
        "Second melodic match at 1:12-1:20 with 87% similarity, same transposition pattern",
        "Harmonic progression I-vi-IV-V shared in intro sections (81% similarity)",
        "Consistent +2 semitone transposition across multiple sections suggests deliberate modification",
      ],
      recommendation: "Legal review strongly recommended. The combination of high melodic similarity with consistent transposition across multiple sections is a strong indicator of melodic interpolation. Recommend obtaining clearance from Santos Music Publishing before commercial release.",
    }],
    riskAssessment: "Overall risk is assessed as HIGH based on substantial melodic similarity (87-94%) with detected transposition. While harmonic similarities fall within common genre conventions, the melodic overlap is specific enough to warrant legal review. The consistent +2 semitone transposition across matched sections reduces the likelihood of coincidental similarity.",
    recommendations: "1. Do not release commercially without legal review.\n2. Contact Santos Music Publishing to discuss potential licensing or clearance.\n3. Consider modifying the melodic content in sections 0:48-0:56 and 1:12-1:20 to reduce similarity.\n4. If proceeding to litigation support, request a Probatio Forensic Analysis for court-admissible evidence packaging.",
    limitations: "This analysis is based on automated audio comparison and does not constitute legal advice. Similarity scores reflect statistical measures of audio feature overlap. The reference catalog does not represent all copyrighted works globally. The determination of copyright infringement is a legal conclusion that can only be made by a court of law. Admissibility of this report as evidence is at the discretion of the presiding court.",
    fullNarrative: "PROBATIO FORENSIC AUDIO ANALYSIS REPORT\n\nForensic audio analysis of the submitted track has identified one significant match in the reference catalog...",
  };
}
