// @ts-nocheck — Supabase query types will be auto-generated via `supabase gen types`
/**
 * PROBATIO — Reproduce Analysis API
 *
 * POST /api/analyses/[id]/reproduce — Trigger deterministic replay.
 * GET  /api/analyses/[id]/reproduce — List reproduction results.
 */

import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { inngest } from "@/lib/inngest/client";
import { getUserPlanTier } from "@/lib/auth/plan-check";
import { rateLimit } from "@/lib/rate-limit";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ analysisId: string }> },
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

    const { data: results } = await supabase
      .from("reproduction_results")
      .select("*")
      .eq("original_analysis_id", analysisId)
      .eq("requested_by", user.id)
      .order("requested_at", { ascending: false });

    return NextResponse.json({ results: results ?? [] });
  } catch (error) {
    console.error("[GET /api/analyses/:id/reproduce]", error);
    return NextResponse.json({ error: "Internal error" }, { status: 500 });
  }
}

export async function POST(
  _request: Request,
  { params }: { params: Promise<{ analysisId: string }> },
) {
  try {
    const { analysisId } = await params;
    const supabase = await createClient();
    const admin = createAdminClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Rate limit: 3/day
    const { success: rateLimitOk } = rateLimit(
      `reproduce:${user.id}`,
      3,
      86_400_000,
    );
    if (!rateLimitOk) {
      return NextResponse.json(
        { error: "Maximum 3 reproductions per day." },
        { status: 429 },
      );
    }

    // Plan check: Professional+
    const tier = await getUserPlanTier(user.id);
    if (tier !== "professional" && tier !== "enterprise") {
      return NextResponse.json(
        {
          error: "Reproduction requires a Professional or Enterprise plan.",
          code: "PLAN_REQUIRED",
        },
        { status: 403 },
      );
    }

    // Verify ownership and completion
    const { data: analysis } = await admin
      .from("analyses")
      .select("id, status, audio_url, user_id, pipeline_version")
      .eq("id", analysisId)
      .eq("user_id", user.id)
      .single();

    if (!analysis) {
      return NextResponse.json(
        { error: "Analysis not found" },
        { status: 404 },
      );
    }

    if (analysis.status !== "completed") {
      return NextResponse.json(
        { error: "Only completed analyses can be reproduced" },
        { status: 400 },
      );
    }

    if (!analysis.audio_url) {
      return NextResponse.json(
        {
          error:
            "Original audio file no longer available. Cannot reproduce.",
        },
        { status: 400 },
      );
    }

    // Create reproduction result row
    const { data: repro, error: insertError } = await admin
      .from("reproduction_results")
      .insert({
        original_analysis_id: analysisId,
        requested_by: user.id,
        status: "pending",
        pipeline_version: analysis.pipeline_version,
        comparisons: [],
      })
      .select("id")
      .single();

    if (insertError || !repro) {
      return NextResponse.json(
        { error: "Failed to create reproduction record" },
        { status: 500 },
      );
    }

    // Emit Inngest event
    await inngest.send({
      name: "analysis/reproduce",
      data: {
        original_analysis_id: analysisId,
        reproduction_id: repro.id,
        user_id: user.id,
      },
    });

    return NextResponse.json(
      {
        reproduction_id: repro.id,
        status: "running",
        estimated_minutes: 3,
      },
      { status: 201 },
    );
  } catch (error) {
    console.error("[POST /api/analyses/:id/reproduce]", error);
    return NextResponse.json({ error: "Internal error" }, { status: 500 });
  }
}
