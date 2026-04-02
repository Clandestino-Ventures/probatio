// @ts-nocheck
/**
 * POST /api/analyses/[analysisId]/delete-audio
 * Auth required, must own the analysis.
 * Deletes audio files only — preserves results and custody.
 */

import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { deleteAnalysisAudioFiles } from "@/lib/retention/scheduled-jobs";
import { rateLimit } from "@/lib/rate-limit";

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ analysisId: string }> }
) {
  try {
    const { analysisId } = await params;
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { success: rateLimitOk, resetIn } = rateLimit(`delete-audio:${user.id}`, 5, 60_000);
    if (!rateLimitOk) {
      return NextResponse.json(
        { error: "Rate limit exceeded. Try again later." },
        { status: 429, headers: { "Retry-After": String(Math.ceil(resetIn / 1000)) } }
      );
    }

    // Fetch analysis with ownership check
    const adminClient = createAdminClient();
    const { data: analysis } = await adminClient
      .from("analyses")
      .select("id, user_id, audio_url, normalized_audio_url, stems_urls, file_hash, audio_deleted_at")
      .eq("id", analysisId)
      .eq("user_id", user.id)
      .single();

    if (!analysis) {
      return NextResponse.json({ error: "Analysis not found" }, { status: 404 });
    }

    if (analysis.audio_deleted_at) {
      return NextResponse.json({ error: "Audio already deleted" }, { status: 400 });
    }

    await deleteAnalysisAudioFiles(analysisId, user.id, analysis, "user_request");

    return NextResponse.json({
      success: true,
      message: "Audio files deleted. Analysis results are preserved.",
      deletedAt: new Date().toISOString(),
    });
  } catch (error) {
    console.error("Audio deletion error:", error);
    return NextResponse.json({ error: "Failed to delete audio" }, { status: 500 });
  }
}
