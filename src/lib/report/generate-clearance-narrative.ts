/**
 * PROBATIO — Clearance-Specific Report Narrative
 *
 * Generates action-oriented narratives for pre-release clearance reports.
 * Uses Claude API when available, falls back to structured templates.
 *
 * Different from forensic narrative:
 * - Audience: label managers, not lawyers
 * - Tone: concise, action-oriented, not exhaustive
 * - Focus: CLEARED/CONDITIONAL/BLOCKED with specific next steps
 */

import Anthropic from "@anthropic-ai/sdk";

export interface ClearanceNarrativeInput {
  fileName: string;
  durationSec: number;
  clearanceStatus: string;
  detectedGenre: string | null;
  genreConfidence: number | null;
  overallScore: number;
  matchCount: number;
  catalogNames: string[];
  totalTracksScanned: number;
  pipelineVersion: string;
  matches: Array<{
    title: string;
    artist: string;
    scoreOverall: number;
    scoreOverallAdjusted: number | null;
    scoreMelody: number | null;
    riskLevel: string;
    topEvidence: string[];
  }>;
}

export interface ClearanceNarrativeOutput {
  executiveSummary: string;
  methodology: string;
  recommendations: string;
  limitations: string;
}

export async function generateClearanceNarrative(
  input: ClearanceNarrativeInput,
): Promise<ClearanceNarrativeOutput> {
  const apiKey = process.env.ANTHROPIC_API_KEY;

  if (!apiKey) {
    return generateTemplateNarrative(input);
  }

  try {
    const client = new Anthropic({ apiKey });

    const systemPrompt = `You are a music industry clearance analyst writing a pre-release clearance report for a label manager. Be concise, factual, and action-oriented.

Rules:
- If CLEARED: confirm no actionable matches, recommend proceeding with release.
- If CONDITIONAL: identify the specific matches that need review, explain WHY they flagged (which dimension, which section), and recommend specific actions (modify melody, obtain clearance, consult legal).
- If BLOCKED: clearly state the risk, identify the specific track(s), and recommend NOT releasing without clearance or modification.
- Always reference genre-adjusted scores, not raw scores.
- Never say "plagiarism" or "infringement" — say "similarity" and "match".
- Include timestamps for key matching sections when available.
- Be specific: "the chorus melody at 0:48" not "parts of the song".

Respond ONLY with valid JSON matching: { "executiveSummary": string, "methodology": string, "recommendations": string, "limitations": string }`;

    const prompt = buildPrompt(input);

    const response = await client.messages.create({
      model: "claude-sonnet-4-20250514",
      max_tokens: 2000,
      system: systemPrompt,
      messages: [{ role: "user", content: prompt }],
    });

    const textContent = response.content.find((c) => c.type === "text");
    if (!textContent || textContent.type !== "text") {
      throw new Error("No text content in response");
    }

    let jsonStr = textContent.text.trim();
    if (jsonStr.startsWith("```")) {
      jsonStr = jsonStr
        .replace(/^```(?:json)?\n?/, "")
        .replace(/\n?```$/, "");
    }

    return JSON.parse(jsonStr) as ClearanceNarrativeOutput;
  } catch (error) {
    console.error(
      "[PROBATIO] Clearance narrative generation failed, using template:",
      error,
    );
    return generateTemplateNarrative(input);
  }
}

function buildPrompt(input: ClearanceNarrativeInput): string {
  let prompt = `Generate a pre-release clearance report narrative.

## Track
- File: ${input.fileName}
- Duration: ${Math.floor(input.durationSec / 60)}:${String(Math.floor(input.durationSec % 60)).padStart(2, "0")}
- Genre: ${input.detectedGenre ?? "Unknown"} (${input.genreConfidence ? Math.round(input.genreConfidence * 100) : "?"}% confidence)
- Clearance Status: ${input.clearanceStatus.toUpperCase()}
- Pipeline: v${input.pipelineVersion}

## Scan Scope
- Catalogs: ${input.catalogNames.join(", ") || "Platform Library"}
- Total tracks scanned: ${input.totalTracksScanned}
- Matches found: ${input.matchCount}

`;

  if (input.matches.length > 0) {
    prompt += "## Matches\n\n";
    for (const match of input.matches) {
      prompt += `### "${match.title}" by ${match.artist}
- Overall: ${Math.round(match.scoreOverall * 100)}% raw${match.scoreOverallAdjusted != null ? ` → ${Math.round(match.scoreOverallAdjusted * 100)}% genre-adjusted` : ""}
- Risk: ${match.riskLevel}
- Key evidence: ${match.topEvidence.slice(0, 3).join("; ") || "None"}

`;
    }
  }

  return prompt;
}

function generateTemplateNarrative(
  input: ClearanceNarrativeInput,
): ClearanceNarrativeOutput {
  const status = input.clearanceStatus;
  const genre = input.detectedGenre ?? "Unknown";

  let executiveSummary: string;
  let recommendations: string;

  if (status === "cleared") {
    executiveSummary =
      `Pre-release clearance analysis of "${input.fileName}" has been completed. ` +
      `The track was scanned against ${input.totalTracksScanned.toLocaleString()} reference tracks ` +
      `across ${input.catalogNames.length || 1} catalog(s). ` +
      `No matches above the actionable similarity threshold were detected. ` +
      `The track is cleared for release.`;
    recommendations =
      "No action required. The track may proceed to release. " +
      "Consider re-scanning if significant modifications are made before final release.";
  } else if (status === "conditional") {
    executiveSummary =
      `Pre-release clearance analysis of "${input.fileName}" detected ` +
      `${input.matchCount} match(es) that require review before release. ` +
      `After genre adjustment for ${genre}, ` +
      `${input.matches.filter((m) => (m.scoreOverallAdjusted ?? m.scoreOverall) >= 0.30).length} ` +
      `match(es) remain above the actionable threshold. Legal review is recommended.`;
    const matchDetails = input.matches
      .map(
        (m) =>
          `"${m.title}" by ${m.artist} (${Math.round((m.scoreOverallAdjusted ?? m.scoreOverall) * 100)}% adjusted similarity)`,
      )
      .join("; ");
    recommendations =
      `Review the following match(es) with legal counsel before release: ${matchDetails}. ` +
      "Options include: (1) obtain sample clearance from rights holders, " +
      "(2) modify the flagged sections to reduce similarity, or " +
      "(3) proceed with legal opinion confirming the similarity is non-actionable.";
  } else {
    executiveSummary =
      `Pre-release clearance analysis of "${input.fileName}" detected ` +
      `${input.matchCount} high-similarity match(es) that pose significant risk. ` +
      `DO NOT release without clearance or modification. ` +
      `The highest match has ${Math.round((input.matches[0]?.scoreOverall ?? 0) * 100)}% overall similarity.`;
    recommendations =
      "HALT release. Engage a music copyright attorney immediately. " +
      "Options: (1) obtain clearance from the matched rights holders, " +
      "(2) substantially modify the flagged sections, or " +
      "(3) commission a forensic analysis with expert annotations for a detailed opinion.";
  }

  return {
    executiveSummary,
    methodology:
      `This analysis was performed using the Probatio forensic audio intelligence platform (v${input.pipelineVersion}). ` +
      "The methodology includes: (1) Audio normalization to 44.1kHz/16-bit/mono, " +
      "(2) Source separation via Demucs htdemucs_ft, " +
      "(3) Multi-dimensional embedding generation via CLAP for timbre and melody, " +
      "(4) Lyrics extraction via Whisper large-v3, " +
      "(5) Vector similarity search with genre-adjusted scoring " +
      "(melody 30%, harmony 20%, lyrics 20%, timbre 15%, rhythm 15%), and " +
      "(6) Transposition detection via DTW with 12-semitone search. " +
      `Genre-aware baselines for ${genre} were applied to normalize scores.`,
    recommendations,
    limitations:
      "This analysis is based on automated audio comparison and does not constitute legal advice. " +
      "Similarity scores reflect technical resemblance and do not determine copyright infringement. " +
      "The reference catalog does not represent all copyrighted works globally. " +
      "Genre-adjusted scores are based on statistical baselines and may not capture all genre conventions.",
  };
}
