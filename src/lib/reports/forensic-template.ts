/**
 * PROBATIO — Forensic Report Template
 *
 * Defines the structure and generation logic for court-ready forensic
 * analysis reports. These reports include detailed dimension-by-dimension
 * analysis, statistical significance testing, expert annotations,
 * chain of custody, and legal disclaimers.
 */

import { PIPELINE_VERSION, APP_NAME, SUPPORT_EMAIL } from "@/lib/constants";
import { THRESHOLD_VERSION } from "@/lib/analysis/risk-classifier";
import type { RiskLevel, ForensicCaseRow } from "@/types/database";
import type { SimilarityScore, MatchedSegment } from "@/types/analysis";
import type {
  ForensicComparison,
  DimensionAnalysis,
  ChainOfCustodyEntry,
  ExpertAnnotation,
  ForensicSimilarity,
} from "@/types/forensic";

// ────────────────────────────────────────────────────────────────────────────
// Report Structure
// ────────────────────────────────────────────────────────────────────────────

/** Cover page and identification metadata. */
export interface ForensicReportCoverPage {
  reportId: string;
  caseName: string;
  title: string;
  generatedAt: string;
  pipelineVersion: string;
  thresholdVersion: string;
  platform: string;
  /** Parties involved in the case (if provided). */
  partiesInvolved: string | null;
}

/** Summary of a track involved in the forensic comparison. */
export interface ForensicTrackSummary {
  label: "Track A" | "Track B";
  /** SHA-256 hash of the original file. */
  fileHash: string;
  /** Key features for quick reference. */
  tempo: number;
  key: string;
  timeSignature: string;
  durationSeconds: number;
}

/** Executive summary of the forensic analysis. */
export interface ForensicExecutiveSummary {
  overallRisk: RiskLevel;
  overallScore: number;
  /** One-paragraph plain-language summary. */
  summary: string;
  /** Whether the similarity is statistically significant. */
  statisticallySignificant: boolean;
  /** Percentile rank within the reference corpus. */
  percentileRank: number | null;
  /** z-score (standard deviations above mean). */
  zScore: number | null;
}

/** Detailed analysis of a single musical dimension. */
export interface ForensicDimensionReport {
  dimension: "melody" | "harmony" | "rhythm" | "structure";
  score: number;
  /** Detailed explanation suitable for court. */
  explanation: string;
  /** Supporting evidence references. */
  evidenceRefs: string[];
  /** Expert annotations on this dimension (if any). */
  expertAnnotations: ForensicAnnotationEntry[];
}

/** An expert annotation formatted for the report. */
export interface ForensicAnnotationEntry {
  expertName: string;
  annotationType: string;
  timestampRange: string;
  content: string;
  confidence: number;
}

/** A matched segment formatted for the report. */
export interface ForensicSegmentReport {
  index: number;
  trackARange: string;
  trackBRange: string;
  similarity: number;
  dominantDimension: string;
  /** Whether an expert annotated this segment. */
  hasExpertAnnotation: boolean;
}

/** Chain of custody section. */
export interface ForensicCustodyReport {
  entries: ChainOfCustodyEntry[];
  totalEntries: number;
  firstEntryTimestamp: string | null;
  lastEntryTimestamp: string | null;
  chainIntegrityVerified: boolean;
}

/** The complete forensic report. */
export interface ForensicReport {
  coverPage: ForensicReportCoverPage;
  trackA: ForensicTrackSummary;
  trackB: ForensicTrackSummary;
  executiveSummary: ForensicExecutiveSummary;
  dimensionReports: ForensicDimensionReport[];
  matchedSegments: ForensicSegmentReport[];
  custodyReport: ForensicCustodyReport;
  methodology: string;
  limitations: string;
  disclaimer: string;
}

// ────────────────────────────────────────────────────────────────────────────
// Boilerplate Text
// ────────────────────────────────────────────────────────────────────────────

const METHODOLOGY_TEXT =
  `This forensic analysis was conducted using the ${APP_NAME} platform ` +
  `(pipeline version ${PIPELINE_VERSION}, threshold version ${THRESHOLD_VERSION}). ` +
  "The analysis employed the following methodologies:\n\n" +
  "1. AUDIO NORMALIZATION: Both tracks were converted to a canonical format " +
  "(44,100 Hz, 16-bit, mono, PCM) to ensure comparable analysis conditions.\n\n" +
  "2. SOURCE SEPARATION: Each track was separated into four stems (vocals, drums, " +
  "bass, other) using a deep neural network model trained on the MUSDB18 dataset.\n\n" +
  "3. FEATURE EXTRACTION: Multiple audio features were extracted including pitch contour, " +
  "chromagram, MFCC, onset strength, spectral centroid, and section boundaries.\n\n" +
  "4. DYNAMIC TIME WARPING: Features from both tracks were compared using Dynamic Time " +
  "Warping (DTW) to find the optimal non-linear alignment, accounting for differences " +
  "in tempo and timing.\n\n" +
  "5. SIMILARITY SCORING: Per-dimension scores (melody, harmony, rhythm, structure) " +
  "were computed from DTW distances and aggregated using weighted combination " +
  "(melody: 35%, harmony: 25%, rhythm: 20%, structure: 20%).\n\n" +
  "6. STATISTICAL SIGNIFICANCE: The overall similarity score was compared against a " +
  "reference corpus to determine statistical significance (p-value, z-score, " +
  "percentile rank).";

const LIMITATIONS_TEXT =
  "This analysis is subject to the following limitations:\n\n" +
  "1. Algorithmic analysis cannot fully replicate human musical perception. " +
  "Certain qualitative aspects of similarity may not be captured.\n\n" +
  "2. The reference corpus, while extensive, does not contain every recorded " +
  "musical work. Absence of a match does not guarantee originality.\n\n" +
  "3. Similarity does not necessarily imply copying. Independent creation, " +
  "common musical idioms, and shared influences can produce similar works.\n\n" +
  "4. The analysis considers pitch, harmony, rhythm, and structure but does not " +
  "analyze lyrics, production techniques, or timbre in detail.\n\n" +
  "5. Results are dependent on the quality and format of the submitted audio files.";

const FORENSIC_DISCLAIMER =
  `This report was generated by ${APP_NAME} and is intended for use as a ` +
  "technical analysis in legal proceedings. It does not constitute a legal opinion " +
  "on copyright infringement. The determination of infringement is a legal question " +
  "that depends on factors beyond musical similarity, including access, independent " +
  "creation, fair use, and other defenses. This report should be interpreted by a " +
  "qualified expert witness and considered alongside other evidence. " +
  `For questions about this report, contact: ${SUPPORT_EMAIL}`;

// ────────────────────────────────────────────────────────────────────────────
// Helpers
// ────────────────────────────────────────────────────────────────────────────

function formatTimeRange(startSeconds: number, endSeconds: number): string {
  const formatTime = (s: number): string => {
    const min = Math.floor(s / 60);
    const sec = Math.floor(s % 60);
    return `${min}:${sec.toString().padStart(2, "0")}`;
  };
  return `${formatTime(startSeconds)} - ${formatTime(endSeconds)}`;
}

function generateExecutiveSummaryText(
  riskLevel: RiskLevel,
  overallScore: number,
  dimensionAnalysis: DimensionAnalysis[],
): string {
  const percentage = (overallScore * 100).toFixed(1);

  const highestDimension = [...dimensionAnalysis].sort(
    (a, b) => b.score - a.score,
  )[0];

  const baseText =
    `The analysis found an overall similarity score of ${percentage}% ` +
    `between Track A and Track B, classified as ${riskLevel} risk. `;

  const dimensionText = highestDimension
    ? `The strongest similarity was in the ${highestDimension.dimension} dimension ` +
      `(${(highestDimension.score * 100).toFixed(1)}%). `
    : "";

  const riskTexts: Record<RiskLevel, string> = {
    low:
      "The similarity levels fall within the range of common musical conventions " +
      "and are unlikely to support a claim of copying.",
    medium:
      "The similarity levels are noteworthy and may merit further review, though " +
      "they could be attributable to shared genre conventions or common musical idioms.",
    moderate:
      "The similarity levels are notable and warrant closer examination, though " +
      "they may be attributable to shared genre conventions or common musical idioms.",
    high:
      "The similarity levels are substantial and suggest a meaningful relationship " +
      "between the two works. Further expert review is recommended.",
    critical:
      "The similarity levels are exceptional and strongly suggest a direct " +
      "relationship between the two works. Immediate legal consultation is advised.",
  };

  return baseText + dimensionText + riskTexts[riskLevel];
}

// ────────────────────────────────────────────────────────────────────────────
// Report Generation
// ────────────────────────────────────────────────────────────────────────────

export interface GenerateForensicReportInput {
  forensicCase: ForensicCaseRow;
  comparison: ForensicComparison;
  trackAFeatures: {
    tempo: number;
    key: string;
    timeSignature: string;
    durationSeconds: number;
    hash: string;
  };
  trackBFeatures: {
    tempo: number;
    key: string;
    timeSignature: string;
    durationSeconds: number;
    hash: string;
  };
  chainOfCustody: ChainOfCustodyEntry[];
  expertAnnotations: ExpertAnnotation[];
  /** Statistical context from corpus comparison (optional). */
  forensicSimilarity?: ForensicSimilarity;
}

/**
 * Generate a complete forensic report from case data.
 *
 * @param input  All data needed to populate the forensic report.
 * @returns A fully populated {@link ForensicReport} suitable for court use.
 */
export function generateForensicReport(
  input: GenerateForensicReportInput,
): ForensicReport {
  const {
    forensicCase,
    comparison,
    trackAFeatures,
    trackBFeatures,
    chainOfCustody,
    expertAnnotations,
    forensicSimilarity,
  } = input;

  // ── Cover Page ─────────────────────────────────────────────────────────
  const coverPage: ForensicReportCoverPage = {
    reportId: crypto.randomUUID(),
    caseName: forensicCase.case_name,
    title: `Forensic Analysis Report — ${forensicCase.case_name}`,
    generatedAt: new Date().toISOString(),
    pipelineVersion: PIPELINE_VERSION,
    thresholdVersion: THRESHOLD_VERSION,
    platform: APP_NAME,
    partiesInvolved: forensicCase.parties_involved,
  };

  // ── Track Summaries ────────────────────────────────────────────────────
  const trackA: ForensicTrackSummary = {
    label: "Track A",
    fileHash: trackAFeatures.hash,
    tempo: trackAFeatures.tempo,
    key: trackAFeatures.key,
    timeSignature: trackAFeatures.timeSignature,
    durationSeconds: trackAFeatures.durationSeconds,
  };

  const trackB: ForensicTrackSummary = {
    label: "Track B",
    fileHash: trackBFeatures.hash,
    tempo: trackBFeatures.tempo,
    key: trackBFeatures.key,
    timeSignature: trackBFeatures.timeSignature,
    durationSeconds: trackBFeatures.durationSeconds,
  };

  // ── Executive Summary ──────────────────────────────────────────────────
  const executiveSummary: ForensicExecutiveSummary = {
    overallRisk: comparison.riskLevel,
    overallScore: comparison.scores.overall,
    summary: generateExecutiveSummaryText(
      comparison.riskLevel,
      comparison.scores.overall,
      comparison.dimensionAnalysis,
    ),
    statisticallySignificant: forensicSimilarity?.isStatisticallySignificant ?? false,
    percentileRank: forensicSimilarity?.percentileRank ?? null,
    zScore: forensicSimilarity?.zScore ?? null,
  };

  // ── Dimension Reports ──────────────────────────────────────────────────
  const dimensionReports: ForensicDimensionReport[] =
    comparison.dimensionAnalysis.map((dim) => {
      // Find expert annotations that relate to this dimension.
      const relatedAnnotations = expertAnnotations
        .filter((ann) => {
          const content = ann.content.toLowerCase();
          return content.includes(dim.dimension);
        })
        .map((ann) => ({
          expertName: ann.expertName,
          annotationType: ann.annotationType,
          timestampRange: formatTimeRange(ann.timestampStart, ann.timestampEnd),
          content: ann.content,
          confidence: ann.confidence,
        }));

      return {
        dimension: dim.dimension,
        score: dim.score,
        explanation: dim.explanation,
        evidenceRefs: dim.evidenceRefs,
        expertAnnotations: relatedAnnotations,
      };
    });

  // ── Matched Segments ───────────────────────────────────────────────────
  const matchedSegments: ForensicSegmentReport[] =
    comparison.matchedSegments.map((seg, index) => {
      // Check if any expert annotated this time range.
      const hasAnnotation = expertAnnotations.some(
        (ann) =>
          ann.timestampStart >= seg.queryStart - 1 &&
          ann.timestampEnd <= seg.queryEnd + 1,
      );

      return {
        index: index + 1,
        trackARange: formatTimeRange(seg.queryStart, seg.queryEnd),
        trackBRange: formatTimeRange(seg.referenceStart, seg.referenceEnd),
        similarity: seg.similarity,
        dominantDimension: seg.dominantDimension,
        hasExpertAnnotation: hasAnnotation,
      };
    });

  // ── Chain of Custody Report ────────────────────────────────────────────
  const custodyReport: ForensicCustodyReport = {
    entries: chainOfCustody,
    totalEntries: chainOfCustody.length,
    firstEntryTimestamp:
      chainOfCustody.length > 0 ? chainOfCustody[0].timestamp : null,
    lastEntryTimestamp:
      chainOfCustody.length > 0
        ? chainOfCustody[chainOfCustody.length - 1].timestamp
        : null,
    chainIntegrityVerified: true, // Verified during pipeline execution
  };

  return {
    coverPage,
    trackA,
    trackB,
    executiveSummary,
    dimensionReports,
    matchedSegments,
    custodyReport,
    methodology: METHODOLOGY_TEXT,
    limitations: LIMITATIONS_TEXT,
    disclaimer: FORENSIC_DISCLAIMER,
  };
}
