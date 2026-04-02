/**
 * PROBATIO — Context-Aware Suggested Questions
 *
 * Generates question suggestions based on the actual analysis results:
 * highest dimension, transposition, genre adjustment, litigation assessment.
 */

import type { AnalysisQAContext } from "./analysis-qa";

const DIM_LABELS: Record<string, string> = {
  melody: "melody",
  harmony: "harmony",
  rhythm: "rhythm",
  timbre: "timbre",
  lyrics: "lyrics",
};

export function getSuggestedQuestions(ctx: AnalysisQAContext): string[] {
  const suggestions: string[] = [];

  if (ctx.matches.length === 0) {
    suggestions.push("Why were no matches found?");
    suggestions.push("What methodology was used for this analysis?");
    suggestions.push("How does genre affect similarity thresholds?");
    return suggestions;
  }

  const topMatch = ctx.matches[0]?.match;
  if (!topMatch) return ["What's the overall risk level and why?"];

  // Find highest adjusted dimension
  const dimScores: Array<{ key: string; raw: number; adj: number }> = [];
  const addDim = (key: string, raw: number | null, adj: number | null) => {
    if (raw != null) dimScores.push({ key, raw, adj: adj ?? raw });
  };
  addDim("melody", topMatch.score_melody, topMatch.score_melody_adjusted);
  addDim("harmony", topMatch.score_harmony, topMatch.score_harmony_adjusted);
  addDim("rhythm", topMatch.score_rhythm, topMatch.score_rhythm_adjusted);
  addDim("timbre", topMatch.score_timbre, topMatch.score_timbre_adjusted);
  addDim("lyrics", topMatch.score_lyrics, topMatch.score_lyrics_adjusted);

  dimScores.sort((a, b) => b.adj - a.adj);
  const highest = dimScores[0];

  if (highest) {
    const label = DIM_LABELS[highest.key] ?? highest.key;
    suggestions.push(`Why is the ${label} score ${Math.round(highest.raw * 100)}%?`);
  }

  // If genre adjustment is significant
  if (highest && Math.abs(highest.raw - highest.adj) > 0.10) {
    suggestions.push("How does the genre affect the similarity scores?");
  }

  // If transposition detected
  const hasTransposition = ctx.matches.some((m) =>
    m.evidence.some((e) => {
      const detail = e.detail as Record<string, unknown> | null;
      const t = detail?.transposition_semitones as number | undefined;
      return t != null && t !== 0;
    })
  );
  if (hasTransposition) {
    suggestions.push("What does the transposition detection mean?");
  }

  // If litigation assessment exists
  if (ctx.litigationAssessment) {
    suggestions.push("What case law is most relevant to this analysis?");
  }

  // Remediation — always suggest
  suggestions.push("How can I modify my track to reduce similarity?");

  // Risk explanation
  suggestions.push("What's the overall risk level and why?");

  // Low dimensions
  const safeCount = dimScores.filter((d) => d.adj < 0.30).length;
  if (safeCount > 0 && safeCount < dimScores.length) {
    suggestions.push("Which dimensions are safe and don't need changes?");
  }

  // Deduplicate and cap
  const unique = [...new Set(suggestions)];
  return unique.slice(0, 5);
}
