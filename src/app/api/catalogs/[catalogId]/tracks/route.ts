// @ts-nocheck — Supabase query types will be auto-generated via `supabase gen types`
/**
 * PROBATIO — Catalog Tracks Upload API
 *
 * POST /api/catalogs/[catalogId]/tracks — Add tracks to a catalog.
 * Accepts JSON with pre-hosted track URLs.
 * Creates reference_track rows in 'pending' state.
 * Does NOT start processing — that's triggered via /ingest.
 *
 * GET /api/catalogs/[catalogId]/tracks — List tracks in a catalog.
 */

import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { requireEnterprisePlan, getUserOrganizationId } from "@/lib/auth/plan-check";

const MAX_TRACKS_PER_REQUEST = 100;

export async function GET(
  request: Request,
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

    const url = new URL(request.url);
    const page = parseInt(url.searchParams.get("page") ?? "0", 10);
    const limit = Math.min(
      parseInt(url.searchParams.get("limit") ?? "25", 10),
      100,
    );
    const statusFilter = url.searchParams.get("status");
    const search = url.searchParams.get("search");

    let query = supabase
      .from("reference_tracks")
      .select(
        "id, title, artist, isrc, status, fingerprinted, duration_seconds, created_at",
        { count: "exact" },
      )
      .eq("catalog_id", catalogId)
      .order("created_at", { ascending: false })
      .range(page * limit, (page + 1) * limit - 1);

    if (statusFilter && statusFilter !== "all") {
      query = query.eq("status", statusFilter);
    }
    if (search) {
      query = query.or(`title.ilike.%${search}%,artist.ilike.%${search}%`);
    }

    const { data: tracks, count, error } = await query;

    if (error) {
      return NextResponse.json({ error: "Failed to fetch tracks" }, { status: 500 });
    }

    return NextResponse.json({
      tracks: tracks ?? [],
      total: count ?? 0,
      page,
      limit,
    });
  } catch (error) {
    console.error("[GET /api/catalogs/:id/tracks]", error);
    return NextResponse.json({ error: "Internal error" }, { status: 500 });
  }
}

export async function POST(
  request: Request,
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

    try {
      await requireEnterprisePlan(user.id);
    } catch {
      return NextResponse.json(
        { error: "Enterprise plan required", code: "PLAN_REQUIRED" },
        { status: 403 },
      );
    }

    const organizationId = await getUserOrganizationId(user.id);
    if (!organizationId) {
      return NextResponse.json(
        { error: "Organization required", code: "NO_ORG" },
        { status: 403 },
      );
    }

    // Verify catalog ownership
    const { data: catalog } = await supabase
      .from("enterprise_catalogs")
      .select("id, organization_id")
      .eq("id", catalogId)
      .eq("organization_id", organizationId)
      .single();

    if (!catalog) {
      return NextResponse.json(
        { error: "Catalog not found or access denied" },
        { status: 404 },
      );
    }

    const body = await request.json();
    const tracks = body.tracks as Array<{
      title: string;
      artist: string;
      isrc?: string;
      audio_url: string;
      album?: string;
      release_year?: number;
      genre?: string;
    }>;

    if (!Array.isArray(tracks) || tracks.length === 0) {
      return NextResponse.json(
        { error: "tracks array is required and must not be empty" },
        { status: 400 },
      );
    }

    if (tracks.length > MAX_TRACKS_PER_REQUEST) {
      return NextResponse.json(
        {
          error: `Maximum ${MAX_TRACKS_PER_REQUEST} tracks per request. Send multiple requests for larger batches.`,
        },
        { status: 400 },
      );
    }

    // Validate each track
    for (const track of tracks) {
      if (!track.audio_url) {
        return NextResponse.json(
          { error: `Track "${track.title ?? "unknown"}" is missing audio_url` },
          { status: 400 },
        );
      }
    }

    // Insert reference_track rows
    const rows = tracks.map((t) => ({
      catalog_id: catalogId,
      organization_id: organizationId,
      title: t.title || "Untitled",
      artist: t.artist || "Unknown",
      isrc: t.isrc || null,
      album: t.album || null,
      release_year: t.release_year || null,
      genre: t.genre || null,
      audio_url: t.audio_url,
      source: "enterprise_upload",
      visibility: "enterprise" as const,
      fingerprinted: false,
      status: "pending" as const,
    }));

    const { data: inserted, error: insertError } = await supabase
      .from("reference_tracks")
      .insert(rows)
      .select("id, title, status");

    if (insertError) {
      return NextResponse.json(
        { error: "Failed to insert tracks", detail: insertError.message },
        { status: 500 },
      );
    }

    // Update catalog track_count
    const { count: totalCount } = await supabase
      .from("reference_tracks")
      .select("*", { count: "exact", head: true })
      .eq("catalog_id", catalogId);

    await supabase
      .from("enterprise_catalogs")
      .update({ track_count: totalCount ?? 0 })
      .eq("id", catalogId);

    return NextResponse.json(
      {
        queued: inserted?.length ?? 0,
        tracks: inserted ?? [],
      },
      { status: 201 },
    );
  } catch (error) {
    console.error("[POST /api/catalogs/:id/tracks]", error);
    return NextResponse.json({ error: "Internal error" }, { status: 500 });
  }
}
