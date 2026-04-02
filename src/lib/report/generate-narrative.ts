/**
 * PROBATIO — Claude-Powered Forensic Report Generation
 *
 * Generates forensic analysis report narratives using the Anthropic Claude API.
 * The report is written with the voice of an expert forensic audio analyst —
 * precise, quantitative, objective. This is what the user reads, downloads,
 * sends to their attorney, and potentially presents in court.
 *
 * Falls back to a structured template if Claude API is unavailable.
 */

import Anthropic from "@anthropic-ai/sdk";

export interface ReportInput {
  analysisId: string;
  fileName: string;
  durationSec: number;
  tempoBpm: number | null;
  key: string | null;
  overallRisk: string;
  overallScore: number;
  matchCount: number;
  pipelineVersion: string;
  detectedGenre?: string | null;
  genreConfidence?: number | null;
  matches: Array<{
    id: string;
    referenceTitle: string;
    referenceArtist: string;
    scoreOverall: number;
    scoreMelody: number | null;
    scoreHarmony: number | null;
    scoreRhythm: number | null;
    scoreTimbre: number | null;
    scoreLyrics?: number | null;
    scoreOverallAdjusted?: number | null;
    riskLevel: string;
    rightsHolders: Record<string, unknown> | null;
    evidencePoints: Array<{
      dimension: string;
      similarity: number;
      sourceStart: number;
      sourceEnd: number;
      targetStart: number;
      targetEnd: number;
      description: string;
      detail: Record<string, unknown>;
    }>;
  }>;
}

export interface ReportOutput {
  executiveSummary: string;
  methodology: string;
  matchAnalyses: Array<{
    matchId: string;
    title: string;
    artist: string;
    overallSimilarity: number;
    riskLevel: string;
    narrative: string;
    keyEvidence: string[];
    recommendation: string;
  }>;
  riskAssessment: string;
  recommendations: string;
  limitations: string;
  fullNarrative: string;
}

export async function generateReport(input: ReportInput): Promise<ReportOutput> {
  const apiKey = process.env.ANTHROPIC_API_KEY;

  if (!apiKey) {
    // Fallback to template-based report
    return generateTemplateReport(input);
  }

  try {
    const client = new Anthropic({ apiKey });

    const systemPrompt = `You are Probatio, a forensic audio analysis system used by music industry professionals, entertainment attorneys, and expert witnesses. You generate forensic analysis reports that may be used in legal proceedings.

Your writing style:
- Precise, authoritative, objective — like an expert witness report
- Quantitative: always cite specific similarity percentages, timestamps, and dimensions
- Never speculative: distinguish between "the analysis shows" and "this may suggest"
- Use passive voice for findings ("A similarity of 94% was detected")
- Every claim is backed by specific data from the analysis
- When transposition is detected (melody shifted N semitones), state it explicitly — strong evidence of deliberate copying

CRITICAL RULES:
- Never use the word "plagiarism" — use "substantial similarity" or "potential infringement"
- Legal conclusions are for courts, not analysis tools
- Always include the specific pipeline version and methodology reference
- Format timestamps as M:SS (e.g., "1:23" not "83 seconds")
- Percentages should be rounded to whole numbers

Respond ONLY with valid JSON matching the requested structure.`;

    const analysisData = buildAnalysisPrompt(input);

    const response = await client.messages.create({
      model: "claude-sonnet-4-20250514",
      max_tokens: 4000,
      system: systemPrompt,
      messages: [{
        role: "user",
        content: `Generate a forensic analysis report for this audio analysis. Return JSON with keys: executiveSummary, methodology, matchAnalyses (array of {matchId, title, artist, overallSimilarity, riskLevel, narrative, keyEvidence (array of strings), recommendation}), riskAssessment, recommendations, limitations, fullNarrative.

${analysisData}`,
      }],
    });

    // Extract text content from Claude response
    const textContent = response.content.find(c => c.type === "text");
    if (!textContent || textContent.type !== "text") {
      throw new Error("No text content in Claude response");
    }

    // Parse JSON — Claude may wrap in markdown code blocks
    let jsonStr = textContent.text.trim();
    if (jsonStr.startsWith("```")) {
      jsonStr = jsonStr.replace(/^```(?:json)?\n?/, "").replace(/\n?```$/, "");
    }

    return JSON.parse(jsonStr) as ReportOutput;
  } catch (error) {
    console.error("[PROBATIO] Claude report generation failed, using template:", error);
    return generateTemplateReport(input);
  }
}

function buildAnalysisPrompt(input: ReportInput): string {
  const formatTime = (sec: number) => {
    const m = Math.floor(sec / 60);
    const s = Math.floor(sec % 60);
    return `${m}:${s.toString().padStart(2, "0")}`;
  };

  let prompt = `## Analysis Summary
- File: ${input.fileName}
- Duration: ${input.durationSec ? formatTime(input.durationSec) : "unknown"}
- Tempo: ${input.tempoBpm ? `${Math.round(input.tempoBpm)} BPM` : "not detected"}
- Key: ${input.key || "not detected"}
- Pipeline Version: ${input.pipelineVersion}
- Overall Risk: ${input.overallRisk.toUpperCase()} (${Math.round(input.overallScore * 100)}%)
- Matches Found: ${input.matchCount}
`;

  if (input.detectedGenre) {
    prompt += `- Detected Genre: ${input.detectedGenre} (${input.genreConfidence != null ? Math.round(input.genreConfidence * 100) : "?"}% confidence)
- IMPORTANT: Genre-aware baseline normalization has been applied. Scores are adjusted relative to the expected similarity baseline for ${input.detectedGenre}. Genre-typical similarity (e.g., shared rhythmic patterns in reggaeton) has been factored out — only similarity ABOVE the genre baseline is reported as forensically significant.
`;
  }

  prompt += "\n";

  if (input.matches.length === 0) {
    prompt += "No significant matches were found. The track appears to be original.\n";
  } else {
    prompt += "## Matches\n\n";
    for (const match of input.matches) {
      prompt += `### Match: "${match.referenceTitle}" by ${match.referenceArtist}
- Overall Similarity (raw): ${Math.round(match.scoreOverall * 100)}%${match.scoreOverallAdjusted != null ? ` → Genre-Adjusted: ${Math.round(match.scoreOverallAdjusted * 100)}%` : ""}
- Risk Level: ${match.riskLevel}
- Melody: ${match.scoreMelody != null ? Math.round(match.scoreMelody * 100) + "%" : "N/A"}
- Harmony: ${match.scoreHarmony != null ? Math.round(match.scoreHarmony * 100) + "%" : "N/A"}
- Rhythm: ${match.scoreRhythm != null ? Math.round(match.scoreRhythm * 100) + "%" : "N/A"}
- Timbre: ${match.scoreTimbre != null ? Math.round(match.scoreTimbre * 100) + "%" : "N/A"}
- Lyrics: ${match.scoreLyrics != null ? Math.round(match.scoreLyrics * 100) + "%" : "N/A"}
`;

      if (match.rightsHolders) {
        const rh = match.rightsHolders;
        if (Array.isArray(rh.composers) && rh.composers.length > 0) {
          prompt += `- Composers: ${(rh.composers as Array<{name: string}>).map(c => c.name).join(", ")}\n`;
        }
        if (Array.isArray(rh.publishers) && rh.publishers.length > 0) {
          prompt += `- Publishers: ${(rh.publishers as Array<{name: string}>).map(p => p.name).join(", ")}\n`;
        }
      }

      if (match.evidencePoints.length > 0) {
        prompt += "\nKey Evidence Points:\n";
        for (const ev of match.evidencePoints.slice(0, 8)) {
          prompt += `- [${ev.dimension}] ${formatTime(ev.sourceStart)}-${formatTime(ev.sourceEnd)} matches ${formatTime(ev.targetStart)}-${formatTime(ev.targetEnd)} (${Math.round(ev.similarity * 100)}% similarity)`;
          const transposition = ev.detail?.transposition_semitones as number | undefined;
          if (transposition && transposition !== 0) {
            prompt += ` [transposed ${transposition > 0 ? "+" : ""}${transposition} semitones]`;
          }
          prompt += "\n";
        }
      }
      prompt += "\n";
    }
  }

  return prompt;
}

/**
 * Template-based fallback report when Claude API is unavailable.
 */
function generateTemplateReport(input: ReportInput): ReportOutput {
  const formatTime = (sec: number) => {
    const m = Math.floor(sec / 60);
    const s = Math.floor(sec % 60);
    return `${m}:${s.toString().padStart(2, "0")}`;
  };

  const riskDescriptions: Record<string, string> = {
    clear: "No significant similarities were detected. The analyzed track appears to be original.",
    low: "Minor similarities were detected that fall within common genre conventions. No action is recommended.",
    moderate: "Notable similarities were detected in one or more dimensions. Legal review is recommended before release.",
    high: "Substantial similarities were detected across multiple dimensions. Legal counsel should be consulted before distribution.",
    critical: "Near-identical similarity was detected. Do not release without obtaining clearance from rights holders.",
  };

  const matchAnalyses = input.matches.map(match => ({
    matchId: match.id,
    title: match.referenceTitle,
    artist: match.referenceArtist,
    overallSimilarity: match.scoreOverall,
    riskLevel: match.riskLevel,
    narrative: `The analyzed track shows ${Math.round(match.scoreOverall * 100)}% overall similarity to "${match.referenceTitle}" by ${match.referenceArtist}. ${
      match.scoreMelody != null && match.scoreMelody > 0.5
        ? `Melodic similarity of ${Math.round(match.scoreMelody * 100)}% was detected, indicating potential melodic overlap. `
        : ""
    }${
      match.scoreHarmony != null && match.scoreHarmony > 0.5
        ? `Harmonic similarity of ${Math.round(match.scoreHarmony * 100)}% suggests shared chord progressions. `
        : ""
    }Risk level: ${match.riskLevel}.`,
    keyEvidence: match.evidencePoints.slice(0, 5).map(ev =>
      `${ev.dimension} similarity of ${Math.round(ev.similarity * 100)}% at ${formatTime(ev.sourceStart)}-${formatTime(ev.sourceEnd)}`
    ),
    recommendation: match.riskLevel === "critical"
      ? "Immediate clearance required before release."
      : match.riskLevel === "high"
        ? "Legal review strongly recommended."
        : match.riskLevel === "moderate"
          ? "Review recommended; similarities may be coincidental."
          : "No action required.",
  }));

  const executiveSummary = `Forensic audio analysis of "${input.fileName}" was conducted using Probatio pipeline version ${input.pipelineVersion}. The analysis identified ${input.matchCount} potential match${input.matchCount === 1 ? "" : "es"} against the reference catalog. Overall risk assessment: ${input.overallRisk.toUpperCase()} (${Math.round(input.overallScore * 100)}% maximum similarity). ${riskDescriptions[input.overallRisk] || ""}`;

  const methodology = `This analysis was performed using the Probatio forensic audio intelligence platform (pipeline version ${input.pipelineVersion}). The methodology includes: (1) Audio normalization to 44.1kHz/16-bit/mono, (2) Source separation via Demucs htdemucs_ft into vocals, bass, drums, and other stems, (3) Pitch contour extraction via CREPE neural network, (4) Chromatic feature extraction via librosa, (5) Multi-dimensional embedding generation via CLAP (timbre, melody, harmony, rhythm), (6) Vector similarity search against the reference catalog, (7) Segment-level DTW alignment with transposition detection, and (8) Rights holder identification via MusicBrainz. All intermediate outputs are cryptographically hashed and logged in an immutable chain of custody.`;

  const fullNarrative = [executiveSummary, "", methodology, "", ...matchAnalyses.map(m => m.narrative)].join("\n\n");

  return {
    executiveSummary,
    methodology,
    matchAnalyses,
    riskAssessment: riskDescriptions[input.overallRisk] || "Risk assessment unavailable.",
    recommendations: input.overallRisk === "critical" || input.overallRisk === "high"
      ? "Legal review is recommended before release. Contact rights holders for clearance if similarities are confirmed."
      : input.overallRisk === "moderate"
        ? "Review the identified similarities. Consider consulting with a music attorney if the track will be commercially released."
        : "No immediate action required. The analyzed track shows minimal similarity to known works.",
    limitations: "This analysis is based on automated audio comparison and does not constitute legal advice. Similarity scores reflect statistical measures of audio feature overlap and should be interpreted by qualified professionals. The reference catalog does not represent all copyrighted works. Admissibility of this report as evidence is at the discretion of the presiding court.",
    fullNarrative,
  };
}
