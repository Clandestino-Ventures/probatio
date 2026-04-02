// @ts-nocheck
/**
 * PROBATIO — Admin Metrics API
 *
 * GET /api/admin/metrics — Platform-level KPIs.
 * Auth: Platform admin only.
 */

import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { requireAdmin } from "@/lib/auth/require-admin";

export async function GET() {
  try {
    const supabase = await createClient();
    const admin = createAdminClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    try {
      await requireAdmin(user.id);
    } catch {
      return NextResponse.json({ error: "Admin access required" }, { status: 403 });
    }

    // Users
    const { count: totalUsers } = await admin
      .from("profiles")
      .select("*", { count: "exact", head: true });

    const thirtyDaysAgo = new Date(Date.now() - 30 * 86400000).toISOString();
    const { count: activeUsers } = await admin
      .from("analyses")
      .select("user_id", { count: "exact", head: true })
      .gt("created_at", thirtyDaysAgo);

    const { count: payingUsers } = await admin
      .from("profiles")
      .select("*", { count: "exact", head: true })
      .neq("plan_tier", "free");

    const { count: enterpriseUsers } = await admin
      .from("profiles")
      .select("*", { count: "exact", head: true })
      .eq("plan_tier", "enterprise");

    // Analyses
    const { count: totalAnalyses } = await admin
      .from("analyses")
      .select("*", { count: "exact", head: true });

    const monthStart = new Date(new Date().getFullYear(), new Date().getMonth(), 1).toISOString();
    const { count: monthAnalyses } = await admin
      .from("analyses")
      .select("*", { count: "exact", head: true })
      .gt("created_at", monthStart);

    const { count: screeningCount } = await admin
      .from("analyses")
      .select("*", { count: "exact", head: true })
      .eq("mode", "screening");

    const { count: clearanceCount } = await admin
      .from("analyses")
      .select("*", { count: "exact", head: true })
      .eq("mode", "clearance");

    const { count: forensicCount } = await admin
      .from("analyses")
      .select("*", { count: "exact", head: true })
      .eq("mode", "forensic");

    // Catalogs
    const { count: totalCatalogs } = await admin
      .from("enterprise_catalogs")
      .select("*", { count: "exact", head: true });

    const { count: totalRefTracks } = await admin
      .from("reference_tracks")
      .select("*", { count: "exact", head: true });

    const { count: tracksWithEmb } = await admin
      .from("reference_tracks")
      .select("*", { count: "exact", head: true })
      .eq("fingerprinted", true);

    // Forensic
    const { count: totalCases } = await admin
      .from("forensic_cases")
      .select("*", { count: "exact", head: true });

    const { count: activeCases } = await admin
      .from("forensic_cases")
      .select("*", { count: "exact", head: true })
      .in("status", ["intake", "in_review", "expert_assigned", "processing"]);

    // Pipeline
    const { count: completedAnalyses } = await admin
      .from("analyses")
      .select("*", { count: "exact", head: true })
      .eq("status", "completed");

    const { count: failedAnalyses } = await admin
      .from("analyses")
      .select("*", { count: "exact", head: true })
      .eq("status", "failed");

    const weekAgo = new Date(Date.now() - 7 * 86400000).toISOString();
    const { count: failedThisWeek } = await admin
      .from("analyses")
      .select("*", { count: "exact", head: true })
      .eq("status", "failed")
      .gt("created_at", weekAgo);

    // Custody
    const { count: totalCustody } = await admin
      .from("audit_log")
      .select("*", { count: "exact", head: true });

    const total = (completedAnalyses ?? 0) + (failedAnalyses ?? 0);
    const successRate = total > 0 ? ((completedAnalyses ?? 0) / total) * 100 : 100;

    // Revenue estimate (from plan tiers × pricing)
    const planPricing: Record<string, number> = {
      starter: 149,
      professional: 499,
      enterprise: 1499,
    };

    const { data: planCounts } = await admin
      .from("profiles")
      .select("plan_tier")
      .neq("plan_tier", "free");

    let mrr = 0;
    for (const p of planCounts ?? []) {
      mrr += planPricing[p.plan_tier as string] ?? 0;
    }

    return NextResponse.json(
      {
        users: {
          total: totalUsers ?? 0,
          active_30d: activeUsers ?? 0,
          paying: payingUsers ?? 0,
          enterprise: enterpriseUsers ?? 0,
        },
        analyses: {
          total: totalAnalyses ?? 0,
          this_month: monthAnalyses ?? 0,
          by_mode: {
            screening: screeningCount ?? 0,
            clearance: clearanceCount ?? 0,
            forensic: forensicCount ?? 0,
          },
        },
        revenue: {
          mrr,
          arr_estimate: mrr * 12,
        },
        catalogs: {
          total: totalCatalogs ?? 0,
          total_tracks: totalRefTracks ?? 0,
          tracks_with_embeddings: tracksWithEmb ?? 0,
        },
        forensic: {
          total_cases: totalCases ?? 0,
          active_cases: activeCases ?? 0,
        },
        pipeline: {
          success_rate: Math.round(successRate * 10) / 10,
          failed_this_week: failedThisWeek ?? 0,
        },
        platform: {
          total_reference_tracks: totalRefTracks ?? 0,
          total_custody_entries: totalCustody ?? 0,
        },
      },
      { headers: { "Cache-Control": "private, max-age=300" } },
    );
  } catch (error) {
    console.error("[GET /api/admin/metrics]", error);
    return NextResponse.json({ error: "Internal error" }, { status: 500 });
  }
}
