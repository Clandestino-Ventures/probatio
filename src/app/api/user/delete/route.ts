/**
 * PROBATIO — Account Deletion (GDPR Art. 17)
 * POST /api/user/delete
 *
 * Permanently deletes all user data, storage files, and auth record.
 * Blocks deletion if user has active forensic cases.
 */

import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
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

    // Rate limit: 3 attempts per hour
    const { success: rateLimitOk, resetIn } = rateLimit(
      `delete-account:${userId}`,
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

    const admin = createAdminClient();

    // ── Check for active forensic cases ──────────────────────────────────
    const { data: activeCases } = await admin
      .from("forensic_cases")
      .select("id, status")
      .eq("user_id", userId)
      .not("status", "in", '("completed","canceled","archived")');

    if (activeCases && activeCases.length > 0) {
      return NextResponse.json(
        {
          error: "active_cases",
          message:
            "You have active forensic cases. Account deletion will be processed after all cases are resolved. Contact legal@probatio.audio for assistance.",
          active_cases: activeCases.length,
        },
        { status: 409 },
      );
    }

    // ── Delete storage files ─────────────────────────────────────────────
    const storageBuckets = ["probatio-audio", "forensic-evidence"];
    for (const bucket of storageBuckets) {
      const { data: files } = await admin.storage
        .from(bucket)
        .list(userId, { limit: 1000 });

      if (files && files.length > 0) {
        const filePaths = files.map((f) => `${userId}/${f.name}`);
        await admin.storage.from(bucket).remove(filePaths);
      }
    }

    // ── Delete database records (order matters for FK constraints) ──────
    // Child tables first, then parent tables
    await admin.from("credit_usage").delete().eq("user_id", userId);
    await admin.from("credits").delete().eq("user_id", userId);
    await admin.from("audit_log").delete().eq("actor_id", userId);

    // Analyses cascade: analysis_matches, analysis_segments deleted by FK
    await admin.from("analyses").delete().eq("user_id", userId);

    // Forensic cases (completed/canceled/archived only at this point)
    await admin.from("forensic_cases").delete().eq("user_id", userId);

    // Profile
    await admin.from("profiles").delete().eq("id", userId);

    // ── Delete auth user ─────────────────────────────────────────────────
    const { error: authError } = await admin.auth.admin.deleteUser(userId);
    if (authError) {
      console.error("[delete-account] Auth deletion error:", authError);
      // Data is already deleted — log but don't fail the response
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("[delete-account] Error:", error);
    return NextResponse.json(
      { error: "Failed to delete account" },
      { status: 500 },
    );
  }
}
