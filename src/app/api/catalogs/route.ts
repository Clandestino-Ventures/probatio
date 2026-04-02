// @ts-nocheck — Supabase query types will be auto-generated via `supabase gen types`
/**
 * PROBATIO — Catalogs API
 *
 * GET  /api/catalogs — List catalogs accessible to the current user.
 * POST /api/catalogs — Create a new catalog (Enterprise plan required).
 */

import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { requireEnterprisePlan, getUserOrganizationId } from "@/lib/auth/plan-check";

export async function GET() {
  try {
    const supabase = await createClient();
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json(
        { error: "Authentication required.", code: "UNAUTHORIZED" },
        { status: 401 }
      );
    }

    // Get user's organization
    const { data: profile } = await supabase
      .from("profiles")
      .select("organization_id")
      .eq("id", user.id)
      .single();

    const orgId = profile?.organization_id;

    // Fetch catalogs: user's org catalogs + any public reference catalogs
    let query = supabase
      .from("enterprise_catalogs")
      .select("id, name, description, track_count, tracks_with_embeddings, status, created_at")
      .eq("status", "completed")
      .order("name");

    if (orgId) {
      query = query.eq("organization_id", orgId);
    } else {
      // Users without an org see no enterprise catalogs
      // They can still use the platform-wide reference library
      query = query.eq("organization_id", "00000000-0000-0000-0000-000000000000");
    }

    const { data: catalogs, error } = await query;

    if (error) {
      return NextResponse.json(
        { error: "Failed to fetch catalogs.", code: "DB_ERROR" },
        { status: 500 }
      );
    }

    // Also provide platform library stats
    const { count: platformTrackCount } = await supabase
      .from("reference_tracks")
      .select("id", { count: "exact", head: true })
      .not("embedding", "is", null);

    return NextResponse.json({
      catalogs: catalogs ?? [],
      platformLibrary: {
        available: true,
        trackCount: platformTrackCount ?? 0,
        label: "Platform Reference Library",
      },
    });
  } catch (error) {
    console.error("[GET /api/catalogs] Unhandled error:", error);
    return NextResponse.json(
      { error: "An unexpected error occurred.", code: "INTERNAL_ERROR" },
      { status: 500 }
    );
  }
}

export async function POST(request: Request) {
  try {
    const supabase = await createClient();
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json(
        { error: "Authentication required.", code: "UNAUTHORIZED" },
        { status: 401 }
      );
    }

    // Enterprise plan required
    try {
      await requireEnterprisePlan(user.id);
    } catch {
      return NextResponse.json(
        {
          error: "Catalog management requires an Enterprise plan.",
          code: "PLAN_REQUIRED",
          requiredPlan: "enterprise",
        },
        { status: 403 }
      );
    }

    const organizationId = await getUserOrganizationId(user.id);
    if (!organizationId) {
      return NextResponse.json(
        { error: "You must belong to an organization to manage catalogs.", code: "NO_ORG" },
        { status: 403 }
      );
    }

    const body = await request.json();
    const { name, description } = body as { name?: string; description?: string };

    if (!name || name.trim().length === 0) {
      return NextResponse.json(
        { error: "Catalog name is required.", code: "VALIDATION_ERROR" },
        { status: 400 }
      );
    }

    const { data: catalog, error } = await supabase
      .from("enterprise_catalogs")
      .insert({
        organization_id: organizationId,
        name: name.trim(),
        description: description?.trim() || null,
        status: "pending",
        track_count: 0,
        tracks_with_embeddings: 0,
        ingestion_progress: {},
      })
      .select("id, name, status, created_at")
      .single();

    if (error) {
      return NextResponse.json(
        { error: "Failed to create catalog.", code: "DB_ERROR" },
        { status: 500 }
      );
    }

    return NextResponse.json({ catalog }, { status: 201 });
  } catch (error) {
    console.error("[POST /api/catalogs] Unhandled error:", error);
    return NextResponse.json(
      { error: "An unexpected error occurred.", code: "INTERNAL_ERROR" },
      { status: 500 }
    );
  }
}
