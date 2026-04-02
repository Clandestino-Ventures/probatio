/**
 * PROBATIO — Interactive AI Q&A Engine for Analysis Results
 *
 * Conversational assistant that answers questions about forensic audio
 * analysis results, citing specific evidence points, timestamps, and
 * case law precedents. Also provides musically-specific remediation
 * suggestions when asked "how do I fix this?"
 *
 * Uses Claude with the full analysis context injected into the system
 * prompt so every answer references the actual data.
 */

import Anthropic from "@anthropic-ai/sdk";
import type {
  AnalysisRow,
  AnalysisMatchRow,
  MatchEvidenceRow,
  ReferenceTrackRow,
} from "@/types/database";
import type { LitigationAssessmentOutput } from "@/lib/report/litigation-assessment";

// ────────────────────────────────────────────────────────────────────────────
// Types
// ────────────────────────────────────────────────────────────────────────────

export interface AnalysisQAContext {
  analysis: AnalysisRow;
  matches: Array<{
    match: AnalysisMatchRow;
    evidence: MatchEvidenceRow[];
    reference?: ReferenceTrackRow | null;
  }>;
  litigationAssessment?: LitigationAssessmentOutput | null;
}

export interface QAMessage {
  role: "user" | "assistant";
  content: string;
  timestamp: string;
}

export interface QACitation {
  type: "evidence" | "score" | "precedent" | "methodology";
  reference: string;
}

export interface QAResponse {
  answer: string;
  citations: QACitation[];
  suggestedFollowUps: string[];
}

// ────────────────────────────────────────────────────────────────────────────
// System Prompt
// ────────────────────────────────────────────────────────────────────────────

const QA_SYSTEM_PROMPT = `You are Probatio's analysis assistant. You answer questions about audio forensic analysis results in a clear, precise, and educational way. You have access to the complete analysis data for the current track comparison.

YOUR ROLE:
- Answer questions about WHY scores are what they are, citing specific evidence points
- Explain technical concepts (DTW, cosine similarity, transposition) in plain language
- Suggest specific musical modifications to reduce similarity when asked
- Reference timestamps, dimension scores, and evidence data in every answer
- Be conversational but precise — this is a professional tool, not a chatbot

WHAT YOU KNOW:
- All dimension scores (raw and genre-adjusted) for every match
- Every segment-level evidence point with timestamps
- The detected genre and how it affects thresholds
- Transposition data (if detected)
- The litigation risk assessment (if generated)
- The methodology (Demucs, CREPE, CLAP, DTW with transposition detection)
- Case law precedents relevant to the analysis

RULES:
- Always cite specific data: "The melody score of 82% is driven primarily by evidence at 0:48-0:52 where..."
- When explaining a score, mention the genre-adjusted value: "The raw rhythm score of 75% adjusts to 17% for reggaeton, indicating this is typical genre similarity."
- When suggesting modifications, be musically specific: "Change the ascending major 3rd to a perfect 4th in bar 14" not "change the melody"
- If asked about legal implications, reference the litigation assessment but add: "This is a technical assessment, not legal advice."
- Keep answers focused and concise. Aim for 150-300 words unless the question requires more detail.
- Use bullet points for listing multiple evidence points or recommendations.

REMEDIATION SUGGESTIONS (when asked "how do I fix this?" or similar):
- Identify the specific bars/seconds where modification would have the most impact
- Suggest minimal changes that would reduce the highest-similarity evidence points
- Frame in terms of similarity reduction: "This change would likely reduce melody similarity from 82% to approximately 55-60%, below the actionable threshold for this genre."
- Note which dimensions are NOT problematic: "Your rhythm and timbre are sufficiently different — no changes needed there."
- Never suggest changes that would require rewriting the entire song — focus on the concentrated similarity sections

FORMAT:
- Use markdown for formatting (bold for key numbers, bullets for lists)
- End every response with 2-3 suggested follow-up questions prefixed with "→ " on separate lines
- Example follow-ups:
  → "How can I reduce the melody score?"
  → "Is the harmony also a concern?"
  → "What case law is most relevant here?"`;

// ────────────────────────────────────────────────────────────────────────────
// Context Builder
// ────────────────────────────────────────────────────────────────────────────

function formatTime(sec: number): string {
  const m = Math.floor(sec / 60);
  const s = Math.floor(sec % 60);
  return `${m}:${s.toString().padStart(2, "0")}`;
}

function buildAnalysisContext(ctx: AnalysisQAContext): string {
  const a = ctx.analysis;
  let prompt = `## ANALYZED TRACK
File: "${a.file_name}"
Duration: ${a.duration_seconds ? formatTime(a.duration_seconds) : "unknown"}
Genre: ${a.detected_genre ?? "unknown"} (${a.genre_confidence != null ? Math.round(a.genre_confidence * 100) : "?"}% confidence)
Overall Risk: ${(a.overall_risk ?? "unknown").toUpperCase()} (${a.overall_score != null ? Math.round(a.overall_score * 100) : "?"}%)
Mode: ${a.mode}
${a.lyrics_text ? `Lyrics available: Yes (${a.lyrics_language ?? "unknown"} language)` : "Lyrics: Not extracted"}
`;

  if (ctx.matches.length === 0) {
    prompt += "\n## MATCHES\nNo significant matches were found.\n";
    return prompt;
  }

  prompt += `\n## MATCHES (${ctx.matches.length})\n`;

  for (const { match, evidence, reference } of ctx.matches) {
    const refName = reference
      ? `"${reference.title}" by ${reference.artist}`
      : `Reference ${match.reference_track_id}`;

    prompt += `\n### Match: ${refName}\n`;
    if (reference) {
      if (reference.release_year) prompt += `Released: ${reference.release_year}\n`;
      if (reference.genre) prompt += `Genre: ${reference.genre}\n`;
      if (reference.isrc) prompt += `ISRC: ${reference.isrc}\n`;
    }

    prompt += `Risk: ${match.risk_level.toUpperCase()}\n`;
    prompt += `Overall: ${match.score_overall != null ? Math.round(match.score_overall * 100) : "?"}%`;
    if (match.score_overall_adjusted != null)
      prompt += ` → Adjusted: ${Math.round(match.score_overall_adjusted * 100)}%`;
    prompt += "\n";

    const dims = [
      { key: "melody", raw: match.score_melody, adj: match.score_melody_adjusted },
      { key: "harmony", raw: match.score_harmony, adj: match.score_harmony_adjusted },
      { key: "rhythm", raw: match.score_rhythm, adj: match.score_rhythm_adjusted },
      { key: "timbre", raw: match.score_timbre, adj: match.score_timbre_adjusted },
      { key: "lyrics", raw: match.score_lyrics, adj: match.score_lyrics_adjusted },
    ];

    prompt += "\nDimension Scores:\n";
    for (const d of dims) {
      if (d.raw == null) continue;
      prompt += `- ${d.key}: ${Math.round(d.raw * 100)}%`;
      if (d.adj != null) prompt += ` → adjusted: ${Math.round(d.adj * 100)}%`;
      prompt += "\n";
    }

    if (evidence.length > 0) {
      prompt += `\nEvidence Points (${evidence.length} total, showing top ${Math.min(evidence.length, 15)}):\n`;
      for (const ev of evidence.slice(0, 15)) {
        prompt += `- [${ev.dimension}] ${formatTime(ev.source_start_sec)}-${formatTime(ev.source_end_sec)} → ${formatTime(ev.target_start_sec)}-${formatTime(ev.target_end_sec)} (${Math.round(ev.similarity_score * 100)}%)`;
        const detail = ev.detail as Record<string, unknown> | null;
        const transposition = detail?.transposition_semitones as number | undefined;
        if (transposition != null && transposition !== 0) {
          prompt += ` [transposed ${transposition > 0 ? "+" : ""}${transposition} semitones]`;
        }
        prompt += ` [${ev.resolution}]\n`;
      }
    }
  }

  if (ctx.litigationAssessment) {
    const la = ctx.litigationAssessment;
    prompt += `\n## LITIGATION RISK ASSESSMENT
Risk: ${la.overallRisk.toUpperCase()}
Probability: ${la.litigationProbability}
Most Similar Precedent: ${la.mostSimilarPrecedent.name} (${la.mostSimilarPrecedent.citation}) — ${la.mostSimilarPrecedent.ruling}
Why similar: ${la.mostSimilarPrecedent.whySimilar}
Strengths: ${la.strengths.join("; ")}
Weaknesses: ${la.weaknesses.join("; ")}
Defenses: ${la.potentialDefenses.map((d) => `${d.defense} (${d.applicability})`).join("; ")}
`;
  }

  return prompt;
}

// ────────────────────────────────────────────────────────────────────────────
// Citation Extraction
// ────────────────────────────────────────────────────────────────────────────

function extractCitations(text: string): QACitation[] {
  const citations: QACitation[] = [];
  const seen = new Set<string>();

  // Timestamps: "0:48-0:52", "1:12-1:16", etc.
  const timePattern = /(\d+:\d{2}(?:-\d+:\d{2})?)/g;
  for (const m of text.matchAll(timePattern)) {
    const ref = `Evidence at ${m[1]}`;
    if (!seen.has(ref)) {
      citations.push({ type: "evidence", reference: ref });
      seen.add(ref);
    }
  }

  // Percentage scores: "82% melody", "melody score of 82%"
  const scorePattern = /(\d{1,3})%\s*(melody|harmony|rhythm|timbre|lyrics|overall|adjusted|genre-adjusted|raw)/gi;
  for (const m of text.matchAll(scorePattern)) {
    const ref = `${m[2]} ${m[1]}%`;
    if (!seen.has(ref)) {
      citations.push({ type: "score", reference: ref });
      seen.add(ref);
    }
  }

  // Case law: "Williams v.", "Skidmore v.", etc.
  const casePattern = /(\w+\s+v\.\s+\w+)/g;
  for (const m of text.matchAll(casePattern)) {
    const ref = m[1];
    if (!seen.has(ref)) {
      citations.push({ type: "precedent", reference: ref });
      seen.add(ref);
    }
  }

  // Methodology: CREPE, DTW, CLAP, Demucs
  const methodPattern = /\b(CREPE|DTW|CLAP|Demucs|cosine similarity|transposition detection)\b/gi;
  for (const m of text.matchAll(methodPattern)) {
    const ref = m[1];
    if (!seen.has(ref)) {
      citations.push({ type: "methodology", reference: ref });
      seen.add(ref);
    }
  }

  return citations;
}

// ────────────────────────────────────────────────────────────────────────────
// Follow-up extraction from response
// ────────────────────────────────────────────────────────────────────────────

function extractFollowUps(text: string): { cleanedText: string; followUps: string[] } {
  const followUps: string[] = [];
  const lines = text.split("\n");
  const contentLines: string[] = [];

  for (const line of lines) {
    const trimmed = line.trim();
    if (trimmed.startsWith("→ ") || trimmed.startsWith("-> ")) {
      const q = trimmed.replace(/^(→|->)\s*/, "").replace(/^["']|["']$/g, "");
      if (q) followUps.push(q);
    } else {
      contentLines.push(line);
    }
  }

  // Remove trailing empty lines
  while (contentLines.length > 0 && contentLines[contentLines.length - 1].trim() === "") {
    contentLines.pop();
  }

  return { cleanedText: contentLines.join("\n"), followUps };
}

// ────────────────────────────────────────────────────────────────────────────
// Main Q&A function
// ────────────────────────────────────────────────────────────────────────────

export async function askAnalysisQuestion(
  question: string,
  context: AnalysisQAContext,
  conversationHistory: QAMessage[]
): Promise<QAResponse> {
  const apiKey = process.env.ANTHROPIC_API_KEY;

  if (!apiKey) {
    return {
      answer:
        "AI Q&A is not available — the Anthropic API key is not configured. " +
        "Please set ANTHROPIC_API_KEY in your environment variables.",
      citations: [],
      suggestedFollowUps: [],
    };
  }

  const client = new Anthropic({ apiKey });
  const contextPrompt = buildAnalysisContext(context);

  const messages: Array<{ role: "user" | "assistant"; content: string }> = [
    ...conversationHistory.map((m) => ({
      role: m.role,
      content: m.content,
    })),
    { role: "user", content: question },
  ];

  const response = await client.messages.create({
    model: "claude-sonnet-4-20250514",
    max_tokens: 2000,
    system: QA_SYSTEM_PROMPT + "\n\nANALYSIS DATA:\n" + contextPrompt,
    messages,
  });

  const textContent = response.content.find((c) => c.type === "text");
  const rawText = textContent?.type === "text" ? textContent.text : "";

  const { cleanedText, followUps } = extractFollowUps(rawText);
  const citations = extractCitations(cleanedText);

  return {
    answer: cleanedText,
    citations,
    suggestedFollowUps: followUps.length > 0 ? followUps : getDefaultFollowUps(question),
  };
}

function getDefaultFollowUps(question: string): string[] {
  const q = question.toLowerCase();
  if (q.includes("melody") || q.includes("score"))
    return ["How can I reduce the melody score?", "Is the harmony also a concern?"];
  if (q.includes("fix") || q.includes("reduce") || q.includes("change"))
    return ["Which dimensions are safe?", "What case law is most relevant?"];
  if (q.includes("legal") || q.includes("court") || q.includes("litigation"))
    return ["What are the strongest defenses?", "How can I reduce similarity?"];
  return ["Why is the top score so high?", "How can I modify my track?"];
}

// ────────────────────────────────────────────────────────────────────────────
// Exports for testing
// ────────────────────────────────────────────────────────────────────────────

export { buildAnalysisContext, extractCitations, extractFollowUps };
