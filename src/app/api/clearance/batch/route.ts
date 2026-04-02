// @ts-nocheck — Supabase query types will be auto-generated via `supabase gen types`
/**
 * PROBATIO — Bulk Clearance Batch API
 *
 * POST /api/clearance/batch — Create a bulk clearance batch.
 * Accepts JSON with track metadata and pre-hosted audio URLs.
 * Creates analyses, deducts credits, starts processing.
 *
 * GET /api/clearance/batch — List user's batches.
 */

import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { inngest } from "@/lib/inngest/client";
import { CREDIT_COSTS, PIPELINE_VERSION } from "@/lib/constants";
import { getUserPlanTier } from "@/lib/auth/plan-check";

const PLAN_TRACK_LIMITS: Record<string, number> = {
  professional: 10,
  enterprise: 100,
};

export async function GET() {
  try {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { data: batches } = await supabase
      .from("clearance_batches")
      .select("*")
      .eq("user_id", user.id)
      .order("created_at", { ascending: false });

    return NextResponse.json({ batches: batches ?? [] });
  } catch (error) {
    console.error("[GET /api/clearance/batch]", error);
    return NextResponse.json({ error: "Internal error" }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const supabase = await createClient();
    const admin = createAdminClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Check plan tier
    const planTier = await getUserPlanTier(user.id);
    const maxTracks = PLAN_TRACK_LIMITS[planTier] ?? 0;
    if (maxTracks === 0) {
      return NextResponse.json(
        {
          error: "Bulk clearance requires a Professional or Enterprise plan.",
          code: "PLAN_REQUIRED",
        },
        { status: 403 },
      );
    }

    const body = await request.json();
    const {
      name,
      catalog_ids,
      tracks,
    } = body as {
      name?: string;
      catalog_ids: string[];
      tracks: Array<{ title: string; audio_url: string; file_hash?: string }>;
    };

    if (!Array.isArray(tracks) || tracks.length === 0) {
      return NextResponse.json(
        { error: "tracks array is required" },
        { status: 400 },
      );
    }

    if (tracks.length > maxTracks) {
      return NextResponse.json(
        {
          error: `Maximum ${maxTracks} tracks per batch for ${planTier} plan.`,
          code: "TRACK_LIMIT_EXCEEDED",
        },
        { status: 400 },
      );
    }

    if (!Array.isArray(catalog_ids) || catalog_ids.length === 0) {
      return NextResponse.json(
        { error: "catalog_ids array is required" },
        { status: 400 },
      );
    }

    // Check credit balance
    const creditCost = CREDIT_COSTS.clearance;
    const totalCreditsNeeded = tracks.length * creditCost;

    const { data: credits } = await admin
      .from("credits")
      .select("balance")
      .eq("user_id", user.id)
      .single();

    if (!credits || credits.balance < totalCreditsNeeded) {
      return NextResponse.json(
        {
          error: `Insufficient credits. Need ${totalCreditsNeeded}, have ${credits?.balance ?? 0}.`,
          code: "INSUFFICIENT_CREDITS",
        },
        { status: 402 },
      );
    }

    // Create batch
    const batchName =
      name?.trim() ||
      `Clearance Batch — ${new Date().toLocaleDateString()}`;

    const { data: batch, error: batchError } = await admin
      .from("clearance_batches")
      .insert({
        user_id: user.id,
        name: batchName,
        catalog_ids,
        track_count: tracks.length,
        credits_used: totalCreditsNeeded,
      })
      .select("id")
      .single();

    if (batchError || !batch) {
      return NextResponse.json(
        { error: "Failed to create batch" },
        { status: 500 },
      );
    }

    // Create analysis rows for each track
    const analysisIds: string[] = [];

    for (const track of tracks) {
      const { data: analysis } = await admin
        .from("analyses")
        .insert({
          user_id: user.id,
          file_name: track.title,
          mode: "clearance",
          status: "queued",
          audio_url: track.audio_url,
          file_hash: track.file_hash ?? "",
          file_size_bytes: 0,
          pipeline_version: PIPELINE_VERSION,
          batch_id: batch.id,
          catalog_ids,
        })
        .select("id")
        .single();

      if (analysis) {
        analysisIds.push(analysis.id);
      }
    }

    // Deduct credits
    await admin
      .from("credits")
      .update({
        balance: credits.balance - totalCreditsNeeded,
        lifetime_used: (credits.lifetime_used ?? 0) + totalCreditsNeeded,
        updated_at: new Date().toISOString(),
      })
      .eq("user_id", user.id);

    // Record credit usage
    await admin.from("credit_usage").insert({
      user_id: user.id,
      analysis_id: analysisIds[0] ?? null,
      action: "bulk_clearance",
      amount: -totalCreditsNeeded,
      balance_after: credits.balance - totalCreditsNeeded,
      description: `Bulk clearance: ${tracks.length} tracks`,
    });

    // Emit batch processing event
    await inngest.send({
      name: "clearance-batch/process",
      data: {
        batch_id: batch.id,
        analysis_ids: analysisIds,
        catalog_ids,
        user_id: user.id,
      },
    });

    return NextResponse.json(
      {
        batch_id: batch.id,
        tracks_queued: analysisIds.length,
        credits_used: totalCreditsNeeded,
        estimated_minutes: Math.ceil(tracks.length * 2.5),
      },
      { status: 201 },
    );
  } catch (error) {
    console.error("[POST /api/clearance/batch]", error);
    return NextResponse.json({ error: "Internal error" }, { status: 500 });
  }
}
