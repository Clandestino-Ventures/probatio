// @ts-nocheck — Supabase query types will be auto-generated via `supabase gen types`
/**
 * PROBATIO — Monitoring Toggle API
 *
 * POST /api/monitoring — Enable/disable monitoring for an analysis.
 */

import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { requireEnterprisePlan } from "@/lib/auth/plan-check";

export async function POST(request: Request) {
  try {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    try {
      await requireEnterprisePlan(user.id);
    } catch {
      return NextResponse.json(
        {
          error: "Continuous monitoring requires an Enterprise plan.",
          code: "PLAN_REQUIRED",
        },
        { status: 403 },
      );
    }

    const body = await request.json();
    const { analysis_id, enabled } = body as {
      analysis_id: string;
      enabled: boolean;
    };

    if (!analysis_id) {
      return NextResponse.json(
        { error: "analysis_id is required" },
        { status: 400 },
      );
    }

    // Verify ownership and mode
    const { data: analysis } = await supabase
      .from("analyses")
      .select("id, mode, catalog_ids, user_id")
      .eq("id", analysis_id)
      .eq("user_id", user.id)
      .single();

    if (!analysis) {
      return NextResponse.json(
        { error: "Analysis not found" },
        { status: 404 },
      );
    }

    if (analysis.mode !== "clearance") {
      return NextResponse.json(
        { error: "Monitoring is only available for clearance analyses" },
        { status: 400 },
      );
    }

    const { error } = await supabase
      .from("analyses")
      .update({
        monitoring_enabled: enabled,
        monitoring_catalog_ids: enabled
          ? (analysis.catalog_ids ?? [])
          : null,
        last_monitored_at: enabled ? new Date().toISOString() : null,
      })
      .eq("id", analysis_id);

    if (error) {
      return NextResponse.json(
        { error: "Failed to update monitoring" },
        { status: 500 },
      );
    }

    return NextResponse.json({
      analysis_id,
      monitoring_enabled: enabled,
    });
  } catch (error) {
    console.error("[POST /api/monitoring]", error);
    return NextResponse.json({ error: "Internal error" }, { status: 500 });
  }
}
