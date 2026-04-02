// @ts-nocheck
/**
 * PROBATIO — Admin Pipeline Health API
 *
 * GET /api/admin/pipeline — Pipeline success rates and performance.
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

    const weekAgo = new Date(Date.now() - 7 * 86400000).toISOString();

    // Per-mode stats
    const modes = ["screening", "clearance", "forensic"] as const;
    const pipelineStats = [];

    for (const mode of modes) {
      const { count: completed } = await admin
        .from("analyses")
        .select("*", { count: "exact", head: true })
        .eq("mode", mode)
        .eq("status", "completed");

      const { count: failed } = await admin
        .from("analyses")
        .select("*", { count: "exact", head: true })
        .eq("mode", mode)
        .eq("status", "failed");

      const total = (completed ?? 0) + (failed ?? 0);
      const rate = total > 0 ? ((completed ?? 0) / total) * 100 : 100;

      const { count: failedWeek } = await admin
        .from("analyses")
        .select("*", { count: "exact", head: true })
        .eq("mode", mode)
        .eq("status", "failed")
        .gt("created_at", weekAgo);

      pipelineStats.push({
        mode,
        total,
        completed: completed ?? 0,
        failed: failed ?? 0,
        success_rate: Math.round(rate * 10) / 10,
        failed_this_week: failedWeek ?? 0,
      });
    }

    // Recent failures
    const { data: recentFailures } = await admin
      .from("analyses")
      .select("id, file_name, mode, error_message, created_at")
      .eq("status", "failed")
      .order("created_at", { ascending: false })
      .limit(10);

    return NextResponse.json({
      pipelines: pipelineStats,
      recent_failures: recentFailures ?? [],
    });
  } catch (error) {
    console.error("[GET /api/admin/pipeline]", error);
    return NextResponse.json({ error: "Internal error" }, { status: 500 });
  }
}
