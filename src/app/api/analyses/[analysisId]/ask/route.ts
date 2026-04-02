// @ts-nocheck — Supabase query types will be auto-generated via `supabase gen types`
/**
 * PROBATIO — Analysis Q&A API
 *
 * POST /api/analyses/[analysisId]/ask
 *
 * Auth: Required. Must own the analysis.
 * Plan: Professional or Enterprise (AI Q&A is a premium feature).
 * Rate limit: 20 requests/hour per user.
 *
 * Body: { question: string, conversationHistory: QAMessage[] }
 * Returns: QAResponse
 */

import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { getUserPlanTier } from "@/lib/auth/plan-check";
import { rateLimit } from "@/lib/rate-limit";

const QA_RATE_LIMIT = 20;
const QA_RATE_WINDOW_MS = 60 * 60 * 1000; // 1 hour

export async function POST(
  request: Request,
  { params }: { params: Promise<{ analysisId: string }> }
) {
  try {
    const { analysisId } = await params;
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Plan gate: Professional or Enterprise
    const tier = await getUserPlanTier(user.id);
    if (tier === "free" || tier === "starter") {
      return NextResponse.json(
        {
          error: "AI Q&A requires a Professional or Enterprise plan",
          requiredPlan: "professional",
        },
        { status: 403 }
      );
    }

    // Rate limit
    const rl = rateLimit(`qa:${user.id}`, QA_RATE_LIMIT, QA_RATE_WINDOW_MS);
    if (!rl.success) {
      return NextResponse.json(
        {
          error: "Rate limit exceeded. Try again later.",
          remaining: rl.remaining,
          resetIn: rl.resetIn,
        },
        { status: 429 }
      );
    }

    // Parse body
    const body = await request.json();
    const question = body.question as string;
    const conversationHistory = (body.conversationHistory ?? []) as Array<{
      role: "user" | "assistant";
      content: string;
      timestamp: string;
    }>;

    if (!question || typeof question !== "string" || question.trim().length === 0) {
      return NextResponse.json(
        { error: "Question is required" },
        { status: 400 }
      );
    }

    if (question.length > 1000) {
      return NextResponse.json(
        { error: "Question too long (max 1000 characters)" },
        { status: 400 }
      );
    }

    // Verify ownership
    const { data: analysis, error: fetchError } = await supabase
      .from("analyses")
      .select("*")
      .eq("id", analysisId)
      .eq("user_id", user.id)
      .single();

    if (fetchError || !analysis) {
      return NextResponse.json(
        { error: "Analysis not found" },
        { status: 404 }
      );
    }

    const admin = createAdminClient();

    // Fetch matches with reference tracks
    const { data: matchRows } = await admin
      .from("analysis_matches")
      .select(
        "*, reference_tracks(id, title, artist, isrc, release_year, genre, duration_seconds)"
      )
      .eq("analysis_id", analysisId)
      .order("score_overall", { ascending: false })
      .limit(5);

    // Fetch evidence for each match
    const matchesWithEvidence = [];
    for (const row of matchRows ?? []) {
      const { data: evidence } = await admin
        .from("match_evidence")
        .select("*")
        .eq("match_id", row.id)
        .order("similarity_score", { ascending: false })
        .limit(15);

      matchesWithEvidence.push({
        match: row,
        evidence: evidence ?? [],
        reference: row.reference_tracks ?? null,
      });
    }

    // Build context
    const { askAnalysisQuestion } = await import("@/lib/ai/analysis-qa");

    const qaResponse = await askAnalysisQuestion(
      question.trim(),
      {
        analysis,
        matches: matchesWithEvidence,
        litigationAssessment: analysis.litigation_assessment ?? null,
      },
      conversationHistory
    );

    return NextResponse.json(qaResponse, {
      headers: {
        "X-RateLimit-Remaining": String(rl.remaining),
      },
    });
  } catch (err) {
    console.error("[PROBATIO] Q&A error:", err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Internal error" },
      { status: 500 }
    );
  }
}
