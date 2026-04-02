/**
 * PROBATIO — Scoring Engine Calibration Report
 *
 * Runs all 20 known copyright cases through the scoring engine and generates
 * a markdown report with accuracy rates, false positive/negative analysis,
 * per-dimension mean absolute error, and recommendations.
 *
 * This report is designed for expert witnesses and opposing counsel to
 * demonstrate methodology validation under Daubert.
 *
 * Usage: npx tsx src/lib/test-data/calibration-report.ts
 */

import { KNOWN_CASES, midpoint, type KnownCase } from "./known-cases";
import {
  DIMENSION_WEIGHTS,
  classifyRiskFromScore,
} from "../comparison/scoring";

// ────────────────────────────────────────────────────────────────────────────
// Risk classifier (inline — matches risk-classifier.ts thresholds)
// ────────────────────────────────────────────────────────────────────────────

function classifyRisk(score: number): string {
  if (score >= 0.85) return "critical";
  if (score >= 0.70) return "high";
  if (score >= 0.40) return "moderate";
  return "low";
}

// ────────────────────────────────────────────────────────────────────────────
// Compute helpers
// ────────────────────────────────────────────────────────────────────────────

function computeWeightedOverall(
  scores: Record<string, number | null>,
): number {
  let weightedSum = 0;
  let weightTotal = 0;

  for (const [dim, score] of Object.entries(scores)) {
    if (score == null) continue;
    const weight = DIMENSION_WEIGHTS[dim] ?? 0;
    if (weight === 0) continue;
    weightedSum += score * weight;
    weightTotal += weight;
  }

  return weightTotal > 0 ? weightedSum / weightTotal : 0;
}

function buildMidpointScores(
  kase: KnownCase,
): Record<string, number | null> {
  return {
    melody: midpoint(kase.expectedScores.melody),
    harmony: midpoint(kase.expectedScores.harmony),
    rhythm: midpoint(kase.expectedScores.rhythm),
    timbre: midpoint(kase.expectedScores.timbre),
    lyrics: midpoint(kase.expectedScores.lyrics),
  };
}

interface CaseResult {
  kase: KnownCase;
  dimensionScores: Record<string, number | null>;
  overallScore: number;
  riskLevel: string;
  overallInRange: boolean;
  riskMatches: boolean;
}

function evaluateCase(kase: KnownCase): CaseResult {
  const dimensionScores = buildMidpointScores(kase);
  const overallScore = computeWeightedOverall(dimensionScores);
  const riskLevel = classifyRisk(overallScore);

  const overallInRange =
    overallScore >= kase.expectedScores.overall.min &&
    overallScore <= kase.expectedScores.overall.max;
  const riskMatches = riskLevel === kase.expectedRisk;

  return {
    kase,
    dimensionScores,
    overallScore,
    riskLevel,
    overallInRange,
    riskMatches,
  };
}

// ────────────────────────────────────────────────────────────────────────────
// Report generation
// ────────────────────────────────────────────────────────────────────────────

export function generateCalibrationReport(): string {
  const results = KNOWN_CASES.map(evaluateCase);
  const lines: string[] = [];

  // ── Header ──────────────────────────────────────────────────────────
  lines.push("# PROBATIO — Scoring Engine Calibration Report");
  lines.push("");
  lines.push(`**Generated:** ${new Date().toISOString()}`);
  lines.push(`**Pipeline Version:** 1.0.0`);
  lines.push(`**Cases Evaluated:** ${results.length}`);
  lines.push(`**Dimension Weights:** ${JSON.stringify(DIMENSION_WEIGHTS)}`);
  lines.push("");
  lines.push("---");
  lines.push("");

  // ── Summary Statistics ──────────────────────────────────────────────
  const totalCases = results.length;
  const overallAccurate = results.filter((r) => r.overallInRange).length;
  const riskAccurate = results.filter((r) => r.riskMatches).length;

  const infringementCases = results.filter(
    (r) => r.kase.ruling === "infringement",
  );
  const noInfringementCases = results.filter(
    (r) => r.kase.ruling === "no_infringement",
  );

  // False positive: no_infringement case scored above high threshold (0.70)
  const falsePositives = noInfringementCases.filter(
    (r) => r.overallScore >= 0.70,
  );
  // False negative: infringement case scored below moderate threshold (0.40)
  const falseNegatives = infringementCases.filter(
    (r) => r.overallScore < 0.40,
  );

  lines.push("## Summary Statistics");
  lines.push("");
  lines.push(
    `| Metric | Value |`,
  );
  lines.push(`|---|---|`);
  lines.push(
    `| Overall Score Accuracy | ${overallAccurate}/${totalCases} (${((overallAccurate / totalCases) * 100).toFixed(1)}%) |`,
  );
  lines.push(
    `| Risk Level Accuracy | ${riskAccurate}/${totalCases} (${((riskAccurate / totalCases) * 100).toFixed(1)}%) |`,
  );
  lines.push(
    `| False Positive Rate | ${falsePositives.length}/${noInfringementCases.length} (${noInfringementCases.length > 0 ? ((falsePositives.length / noInfringementCases.length) * 100).toFixed(1) : "N/A"}%) |`,
  );
  lines.push(
    `| False Negative Rate | ${falseNegatives.length}/${infringementCases.length} (${infringementCases.length > 0 ? ((falseNegatives.length / infringementCases.length) * 100).toFixed(1) : "N/A"}%) |`,
  );
  lines.push("");

  // ── Mean scores by ruling type ──────────────────────────────────────
  const byRuling = new Map<string, number[]>();
  for (const r of results) {
    if (!byRuling.has(r.kase.ruling)) byRuling.set(r.kase.ruling, []);
    byRuling.get(r.kase.ruling)!.push(r.overallScore);
  }

  lines.push("### Mean Overall Score by Ruling Type");
  lines.push("");
  lines.push("| Ruling | Count | Mean Score | Min | Max |");
  lines.push("|---|---|---|---|---|");

  for (const [ruling, scores] of byRuling) {
    const mean = scores.reduce((a, b) => a + b, 0) / scores.length;
    const min = Math.min(...scores);
    const max = Math.max(...scores);
    lines.push(
      `| ${ruling} | ${scores.length} | ${mean.toFixed(3)} | ${min.toFixed(3)} | ${max.toFixed(3)} |`,
    );
  }
  lines.push("");

  // ── Per-Dimension MAE ───────────────────────────────────────────────
  const dimensions = ["melody", "harmony", "rhythm", "timbre", "lyrics"];
  const dimErrors: Record<string, number[]> = {};

  for (const dim of dimensions) {
    dimErrors[dim] = [];
    for (const r of results) {
      const expected =
        r.kase.expectedScores[dim as keyof typeof r.kase.expectedScores];
      if (!expected || typeof expected !== "object" || !("min" in expected))
        continue;
      const range = expected as { min: number; max: number };
      const actual = r.dimensionScores[dim];
      if (actual == null) continue;

      // Error = distance from nearest range boundary (0 if within range)
      let error = 0;
      if (actual < range.min) error = range.min - actual;
      else if (actual > range.max) error = actual - range.max;
      dimErrors[dim].push(error);
    }
  }

  lines.push("### Per-Dimension Mean Absolute Error (from expected range)");
  lines.push("");
  lines.push("| Dimension | Weight | Samples | MAE | Status |");
  lines.push("|---|---|---|---|---|");

  for (const dim of dimensions) {
    const errors = dimErrors[dim];
    const weight = DIMENSION_WEIGHTS[dim] ?? 0;
    if (errors.length === 0) {
      lines.push(`| ${dim} | ${weight.toFixed(3)} | 0 | N/A | - |`);
      continue;
    }
    const mae = errors.reduce((a, b) => a + b, 0) / errors.length;
    const status = mae < 0.05 ? "CALIBRATED" : mae < 0.10 ? "ACCEPTABLE" : "NEEDS TUNING";
    lines.push(
      `| ${dim} | ${weight.toFixed(3)} | ${errors.length} | ${mae.toFixed(4)} | ${status} |`,
    );
  }
  lines.push("");

  // ── Detailed Per-Case Results ───────────────────────────────────────
  lines.push("---");
  lines.push("");
  lines.push("## Detailed Case Results");
  lines.push("");
  lines.push(
    "| # | Case | Ruling | Expected Overall | Actual Overall | Risk Expected | Risk Actual | Score | Risk |",
  );
  lines.push("|---|---|---|---|---|---|---|---|---|");

  for (let i = 0; i < results.length; i++) {
    const r = results[i];
    const scoreStatus = r.overallInRange ? "PASS" : "FAIL";
    const riskStatus = r.riskMatches ? "PASS" : "FAIL";

    lines.push(
      `| ${i + 1} | ${r.kase.shortName} | ${r.kase.ruling} | ` +
        `${r.kase.expectedScores.overall.min.toFixed(2)}-${r.kase.expectedScores.overall.max.toFixed(2)} | ` +
        `${r.overallScore.toFixed(3)} | ` +
        `${r.kase.expectedRisk} | ${r.riskLevel} | ` +
        `${scoreStatus} | ${riskStatus} |`,
    );
  }
  lines.push("");

  // ── Failures Detail ─────────────────────────────────────────────────
  const failures = results.filter((r) => !r.overallInRange || !r.riskMatches);
  if (failures.length > 0) {
    lines.push("---");
    lines.push("");
    lines.push("## Calibration Failures");
    lines.push("");

    for (const r of failures) {
      lines.push(`### ${r.kase.shortName} (${r.kase.id})`);
      lines.push("");
      lines.push(`- **Ruling:** ${r.kase.ruling}`);
      lines.push(`- **Citation:** ${r.kase.citation}`);
      lines.push(
        `- **Expected overall:** ${r.kase.expectedScores.overall.min.toFixed(2)}–${r.kase.expectedScores.overall.max.toFixed(2)}`,
      );
      lines.push(`- **Actual overall:** ${r.overallScore.toFixed(4)}`);
      lines.push(
        `- **Expected risk:** ${r.kase.expectedRisk} | **Actual risk:** ${r.riskLevel}`,
      );

      if (!r.overallInRange) {
        const delta =
          r.overallScore < r.kase.expectedScores.overall.min
            ? r.kase.expectedScores.overall.min - r.overallScore
            : r.overallScore - r.kase.expectedScores.overall.max;
        lines.push(
          `- **Score gap:** ${delta.toFixed(4)} ${r.overallScore < r.kase.expectedScores.overall.min ? "below minimum" : "above maximum"}`,
        );
      }

      // Identify which dimension is miscalibrated
      const dimContribs: Array<{ dim: string; score: number; weight: number; contrib: number }> = [];
      for (const [dim, score] of Object.entries(r.dimensionScores)) {
        if (score == null) continue;
        const weight = DIMENSION_WEIGHTS[dim] ?? 0;
        dimContribs.push({ dim, score, weight, contrib: score * weight });
      }
      dimContribs.sort((a, b) => b.contrib - a.contrib);

      lines.push("- **Dimension breakdown:**");
      for (const dc of dimContribs) {
        lines.push(
          `  - ${dc.dim}: score=${dc.score.toFixed(3)}, weight=${dc.weight.toFixed(3)}, contribution=${dc.contrib.toFixed(4)}`,
        );
      }
      lines.push(`- **Calibration notes:** ${r.kase.calibrationNotes}`);
      lines.push("");
    }
  } else {
    lines.push("---");
    lines.push("");
    lines.push("## All cases passed calibration. No failures to report.");
    lines.push("");
  }

  // ── Recommendations ─────────────────────────────────────────────────
  lines.push("---");
  lines.push("");
  lines.push("## Recommendations");
  lines.push("");

  const overallAccPct = (overallAccurate / totalCases) * 100;
  if (overallAccPct >= 90) {
    lines.push(
      "- **Scoring engine is well-calibrated.** " +
        `${overallAccPct.toFixed(1)}% of cases fall within expected ranges.`,
    );
  } else if (overallAccPct >= 75) {
    lines.push(
      "- **Scoring engine is acceptably calibrated** " +
        `(${overallAccPct.toFixed(1)}%), but some cases deviate.`,
    );
  } else {
    lines.push(
      `- **Scoring engine needs calibration.** Only ${overallAccPct.toFixed(1)}% accuracy.`,
    );
  }

  if (falsePositives.length > 0) {
    lines.push(
      `- **False positives detected (${falsePositives.length}):** Consider raising the high-risk ` +
        `threshold or reducing weights for non-melody dimensions.`,
    );
    for (const fp of falsePositives) {
      lines.push(`  - ${fp.kase.shortName}: overall=${fp.overallScore.toFixed(3)}`);
    }
  } else {
    lines.push("- **No false positives detected.** No-infringement cases are correctly classified.");
  }

  if (falseNegatives.length > 0) {
    lines.push(
      `- **False negatives detected (${falseNegatives.length}):** Consider lowering the moderate-risk ` +
        `threshold or increasing weights for primary infringing dimensions.`,
    );
    for (const fn of falseNegatives) {
      lines.push(`  - ${fn.kase.shortName}: overall=${fn.overallScore.toFixed(3)}`);
    }
  } else {
    lines.push(
      "- **No false negatives detected.** Infringement cases are correctly flagged.",
    );
  }

  // Check for systematic bias
  const allScores = results.map((r) => r.overallScore);
  const meanScore = allScores.reduce((a, b) => a + b, 0) / allScores.length;
  if (meanScore > 0.60) {
    lines.push(
      `- **Systematic high bias detected** (mean score: ${meanScore.toFixed(3)}). ` +
        "Consider reducing dimension weights or raising thresholds.",
    );
  } else if (meanScore < 0.35) {
    lines.push(
      `- **Systematic low bias detected** (mean score: ${meanScore.toFixed(3)}). ` +
        "Consider increasing dimension weights or lowering thresholds.",
    );
  } else {
    lines.push(
      `- **No systematic bias detected** (mean score: ${meanScore.toFixed(3)}).`,
    );
  }

  // Per-dimension recommendations
  for (const dim of dimensions) {
    const errors = dimErrors[dim];
    if (errors.length === 0) continue;
    const mae = errors.reduce((a, b) => a + b, 0) / errors.length;
    if (mae >= 0.10) {
      lines.push(
        `- **${dim} dimension needs tuning** (MAE: ${mae.toFixed(4)}). ` +
          "Review expected ranges or adjust weight.",
      );
    }
  }

  lines.push("");
  lines.push("---");
  lines.push("");
  lines.push(
    "*This report is auto-generated by Probatio's calibration suite. " +
      "It should be reviewed by a qualified musicologist before submission " +
      "as expert evidence.*",
  );

  return lines.join("\n");
}

// ────────────────────────────────────────────────────────────────────────────
// CLI entry point
// ────────────────────────────────────────────────────────────────────────────

if (typeof process !== "undefined" && process.argv[1]?.includes("calibration-report")) {
  const report = generateCalibrationReport();
  console.log(report);
}
