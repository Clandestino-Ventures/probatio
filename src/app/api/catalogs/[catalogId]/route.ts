// @ts-nocheck — Supabase query types will be auto-generated via `supabase gen types`
/**
 * PROBATIO — Catalog Detail API
 *
 * GET /api/catalogs/[catalogId] — Get catalog details with computed stats.
 */

import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ catalogId: string }> },
) {
  try {
    const { catalogId } = await params;
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { data: catalog, error } = await supabase
      .from("enterprise_catalogs")
      .select("*")
      .eq("id", catalogId)
      .single();

    if (error || !catalog) {
      return NextResponse.json({ error: "Catalog not found" }, { status: 404 });
    }

    // Compute stats from reference_tracks
    const { count: totalTracks } = await supabase
      .from("reference_tracks")
      .select("*", { count: "exact", head: true })
      .eq("catalog_id", catalogId);

    const { count: processedTracks } = await supabase
      .from("reference_tracks")
      .select("*", { count: "exact", head: true })
      .eq("catalog_id", catalogId)
      .eq("fingerprinted", true);

    const { count: failedTracks } = await supabase
      .from("reference_tracks")
      .select("*", { count: "exact", head: true })
      .eq("catalog_id", catalogId)
      .eq("status", "failed");

    const total = totalTracks ?? 0;
    const processed = processedTracks ?? 0;
    const failed = failedTracks ?? 0;
    const pending = total - processed - failed;

    return NextResponse.json({
      ...catalog,
      stats: {
        total,
        processed,
        failed,
        pending,
        completion_pct: total > 0 ? Math.round((processed / total) * 100) : 0,
      },
    });
  } catch (error) {
    console.error("[GET /api/catalogs/:id]", error);
    return NextResponse.json({ error: "Internal error" }, { status: 500 });
  }
}
