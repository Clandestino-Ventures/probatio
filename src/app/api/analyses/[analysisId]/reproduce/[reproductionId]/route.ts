// @ts-nocheck — Supabase query types will be auto-generated via `supabase gen types`
/**
 * PROBATIO — Reproduction Result Detail
 *
 * GET /api/analyses/[id]/reproduce/[reproductionId]
 */

import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ analysisId: string; reproductionId: string }> },
) {
  try {
    const { reproductionId } = await params;
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { data: result } = await supabase
      .from("reproduction_results")
      .select("*")
      .eq("id", reproductionId)
      .eq("requested_by", user.id)
      .single();

    if (!result) {
      return NextResponse.json(
        { error: "Reproduction result not found" },
        { status: 404 },
      );
    }

    return NextResponse.json(result);
  } catch (error) {
    console.error("[GET /api/analyses/:id/reproduce/:reproductionId]", error);
    return NextResponse.json({ error: "Internal error" }, { status: 500 });
  }
}
