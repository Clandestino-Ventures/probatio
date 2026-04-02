// @ts-nocheck — Supabase query types will be auto-generated via `supabase gen types`
/**
 * PROBATIO — Clearance Batch Detail API
 *
 * GET /api/clearance/batch/[batchId] — Get batch status with per-track results.
 */

import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ batchId: string }> },
) {
  try {
    const { batchId } = await params;
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Fetch batch
    const { data: batch } = await supabase
      .from("clearance_batches")
      .select("*")
      .eq("id", batchId)
      .eq("user_id", user.id)
      .single();

    if (!batch) {
      return NextResponse.json({ error: "Batch not found" }, { status: 404 });
    }

    // Fetch all analyses in this batch
    const { data: analyses } = await supabase
      .from("analyses")
      .select(
        "id, file_name, status, clearance_status, overall_score, overall_risk, match_count, created_at",
      )
      .eq("batch_id", batchId)
      .order("created_at");

    return NextResponse.json({
      batch,
      analyses: analyses ?? [],
    });
  } catch (error) {
    console.error("[GET /api/clearance/batch/:id]", error);
    return NextResponse.json({ error: "Internal error" }, { status: 500 });
  }
}
