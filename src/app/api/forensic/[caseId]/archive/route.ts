// @ts-nocheck
/**
 * POST /api/forensic/[caseId]/archive
 * Archives a completed forensic case: deletes audio, preserves results + custody.
 */

import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { deleteAnalysisAudioFiles } from "@/lib/retention/scheduled-jobs";
import { recordCustody } from "@/lib/custody";
import { rateLimit } from "@/lib/rate-limit";

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ caseId: string }> }
) {
  try {
    const { caseId } = await params;
    const body = await request.json();

    if (!body.confirm) {
      return NextResponse.json(
        { error: "Confirmation required. Send { confirm: true } to proceed." },
        { status: 400 }
      );
    }

    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { success: rateLimitOk, resetIn } = rateLimit(`forensic-archive:${user.id}`, 5, 60_000);
    if (!rateLimitOk) {
      return NextResponse.json(
        { error: "Rate limit exceeded. Try again later." },
        { status: 429, headers: { "Retry-After": String(Math.ceil(resetIn / 1000)) } }
      );
    }

    const adminClient = createAdminClient();
    const { data: forensicCase } = await adminClient
      .from("forensic_cases")
      .select("id, user_id, status, track_a_analysis_id, track_b_analysis_id, archived_at")
      .eq("id", caseId)
      .eq("user_id", user.id)
      .single();

    if (!forensicCase) {
      return NextResponse.json({ error: "Case not found" }, { status: 404 });
    }

    if (forensicCase.archived_at) {
      return NextResponse.json({ error: "Case already archived" }, { status: 400 });
    }

    if (forensicCase.status !== "completed") {
      return NextResponse.json(
        { error: "Only completed cases can be archived" },
        { status: 400 }
      );
    }

    const now = new Date().toISOString();

    // Delete audio for both tracks
    for (const trackAnalysisId of [forensicCase.track_a_analysis_id, forensicCase.track_b_analysis_id]) {
      if (!trackAnalysisId) continue;

      const { data: analysis } = await adminClient
        .from("analyses")
        .select("id, user_id, audio_url, normalized_audio_url, stems_urls, file_hash")
        .eq("id", trackAnalysisId)
        .single();

      if (analysis) {
        await deleteAnalysisAudioFiles(trackAnalysisId, user.id, analysis, "case_archived");
      }
    }

    // Update forensic case
    await adminClient
      .from("forensic_cases")
      .update({
        archived_at: now,
        archived_by: user.id,
        audio_deleted_at: now,
      })
      .eq("id", caseId);

    // Record on case custody chain
    await recordCustody({
      entityType: "forensic_case",
      entityId: caseId,
      action: "case_archived",
      actorId: user.id,
      detail: {
        step_name: "case_archiving",
        reason: "owner_request",
        tracks_archived: 2,
        preserved: ["forensic report", "analysis results", "match evidence", "chain of custody"],
      },
    });

    return NextResponse.json({
      success: true,
      message: "Case archived. Audio deleted. Results and custody chain preserved.",
      archivedAt: now,
    });
  } catch (error) {
    console.error("Case archive error:", error);
    return NextResponse.json({ error: "Failed to archive case" }, { status: 500 });
  }
}
