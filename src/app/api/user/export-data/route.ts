/**
 * PROBATIO — GDPR Data Export (Art. 15 & 20)
 * POST /api/user/export-data
 *
 * Exports all user data as a downloadable JSON file.
 */

import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { rateLimit } from "@/lib/rate-limit";

export async function POST() {
  try {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const userId = user.id;

    // Rate limit: 3 exports per hour
    const { success: rateLimitOk, resetIn } = rateLimit(
      `data-export:${userId}`,
      3,
      3_600_000,
    );
    if (!rateLimitOk) {
      return NextResponse.json(
        { error: "Rate limit exceeded. Try again later." },
        {
          status: 429,
          headers: { "Retry-After": String(Math.ceil(resetIn / 1000)) },
        },
      );
    }

    const [profile, credits, creditUsage, analyses, forensicCases, auditLog] =
      await Promise.all([
        supabase.from("profiles").select("*").eq("id", userId).single(),
        supabase.from("credits").select("*").eq("user_id", userId).single(),
        supabase
          .from("credit_usage")
          .select("*")
          .eq("user_id", userId)
          .order("created_at", { ascending: false }),
        supabase
          .from("analyses")
          .select("*")
          .eq("user_id", userId)
          .order("created_at", { ascending: false }),
        supabase
          .from("forensic_cases")
          .select("*")
          .eq("user_id", userId)
          .order("created_at", { ascending: false }),
        supabase
          .from("audit_log")
          .select("*")
          .eq("actor_id", userId)
          .order("created_at", { ascending: false }),
      ]);

    const exportData = {
      exported_at: new Date().toISOString(),
      platform: "Probatio",
      version: "1.0",
      user: {
        profile: profile.data,
        credits: credits.data,
      },
      credit_history: creditUsage.data || [],
      analyses: analyses.data || [],
      forensic_cases: forensicCases.data || [],
      audit_trail: auditLog.data || [],
    };

    const dateStr = new Date().toISOString().split("T")[0];

    return new NextResponse(JSON.stringify(exportData, null, 2), {
      headers: {
        "Content-Type": "application/json",
        "Content-Disposition": `attachment; filename="probatio-data-export-${userId}-${dateStr}.json"`,
      },
    });
  } catch (error) {
    console.error("[export-data] Error:", error);
    return NextResponse.json(
      { error: "Failed to export data" },
      { status: 500 },
    );
  }
}
