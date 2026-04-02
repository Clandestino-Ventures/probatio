/**
 * PROBATIO — Risk Classification
 *
 * Deterministic classification of similarity scores into risk levels.
 * Threshold values are versioned for reproducibility in forensic contexts.
 */

import type { RiskLevel } from "@/types/database";
import type { RiskThreshold, SimilarityScore } from "@/types/analysis";

// ────────────────────────────────────────────────────────────────────────────
// Version
// ────────────────────────────────────────────────────────────────────────────

/** Semantic version of the threshold table. Bump on any threshold change. */
export const THRESHOLD_VERSION = "1.0.0" as const;

// ────────────────────────────────────────────────────────────────────────────
// Thresholds
// ────────────────────────────────────────────────────────────────────────────

/**
 * Risk threshold bands ordered from lowest to highest.
 *
 * - **Low**       0.00 – 0.39  Minimal similarity; unlikely to raise concerns.
 * - **Moderate**  0.40 – 0.69  Notable similarity; warrants closer inspection.
 * - **High**      0.70 – 0.84  Substantial similarity; legal review recommended.
 * - **Critical**  0.85 – 1.00  Near-identical; immediate legal action likely.
 */
export const RISK_THRESHOLDS: readonly RiskThreshold[] = [
  {
    level: "low",
    min: 0.0,
    max: 0.4,
    label: "Low Risk",
    description:
      "Minimal similarity detected. The works are unlikely to raise copyright concerns.",
  },
  {
    level: "moderate",
    min: 0.4,
    max: 0.7,
    label: "Moderate Risk",
    description:
      "Notable similarity detected. Closer inspection or a deeper analysis is recommended.",
  },
  {
    level: "high",
    min: 0.7,
    max: 0.85,
    label: "High Risk",
    description:
      "Substantial similarity detected. Legal review is strongly recommended before release.",
  },
  {
    level: "critical",
    min: 0.85,
    max: 1.01, // inclusive upper bound for 1.0
    label: "Critical Risk",
    description:
      "Near-identical similarity detected. Immediate legal consultation is advised.",
  },
] as const;

// ────────────────────────────────────────────────────────────────────────────
// Classification
// ────────────────────────────────────────────────────────────────────────────

/**
 * Classify an overall similarity score into a risk level.
 *
 * @param overallScore  Aggregate similarity score in [0, 1].
 * @returns The corresponding {@link RiskLevel}.
 * @throws {RangeError} If the score is outside [0, 1].
 */
export function classifyRisk(overallScore: number): RiskLevel {
  if (overallScore < 0 || overallScore > 1) {
    throw new RangeError(
      `overallScore must be between 0 and 1, received ${overallScore}`,
    );
  }

  for (const threshold of RISK_THRESHOLDS) {
    if (overallScore >= threshold.min && overallScore < threshold.max) {
      return threshold.level;
    }
  }

  // Fallback — should never happen with the thresholds defined above.
  return "critical";
}

/**
 * Classify a full {@link SimilarityScore} object using its `overall` field.
 */
export function classifyRiskFromScores(scores: SimilarityScore): RiskLevel {
  return classifyRisk(scores.overall);
}

// ────────────────────────────────────────────────────────────────────────────
// Recommendations
// ────────────────────────────────────────────────────────────────────────────

/** Structured recommendation returned alongside a risk classification. */
export interface RiskRecommendation {
  level: RiskLevel;
  label: string;
  description: string;
  /** Actionable next steps for the user. */
  actions: readonly string[];
}

/**
 * Get a human-readable recommendation for a given risk level.
 *
 * @param level  The classified risk level.
 * @returns A {@link RiskRecommendation} with suggested actions.
 */
export function getRecommendation(level: RiskLevel): RiskRecommendation {
  const threshold = RISK_THRESHOLDS.find((t) => t.level === level);

  const recommendations: Record<RiskLevel, readonly string[]> = {
    low: [
      "No immediate action required.",
      "Consider running a forensic analysis for additional confidence.",
    ],
    medium: [
      "Review the matched segments carefully.",
      "Run a forensic analysis to identify specific overlapping regions.",
      "Consider consulting a music attorney if releasing commercially.",
    ],
    moderate: [
      "Review the matched segments carefully.",
      "Run a forensic analysis to identify specific overlapping regions.",
      "Consider consulting a music attorney if releasing commercially.",
    ],
    high: [
      "Do not release without legal review.",
      "Run a forensic analysis for court-ready evidence.",
      "Consult with a music copyright attorney.",
      "Consider modifying the flagged sections before release.",
    ],
    critical: [
      "Halt any planned release immediately.",
      "Engage a music copyright attorney.",
      "Commission a forensic analysis with expert annotations.",
      "Prepare for potential litigation or licensing negotiations.",
    ],
  } as const;

  return {
    level,
    label: threshold?.label ?? level,
    description: threshold?.description ?? "",
    actions: recommendations[level],
  };
}
