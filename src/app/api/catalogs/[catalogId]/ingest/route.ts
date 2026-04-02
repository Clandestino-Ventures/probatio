// @ts-nocheck — Supabase query types will be auto-generated via `supabase gen types`
/**
 * PROBATIO — Catalog Ingest Trigger API
 *
 * POST /api/catalogs/[catalogId]/ingest — Start processing all unprocessed tracks.
 * Emits Inngest event 'catalog/ingest' which orchestrates the batch.
 */

import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { requireEnterprisePlan, getUserOrganizationId } from "@/lib/auth/plan-check";
import { inngest } from "@/lib/inngest/client";
import { estimateCatalogCost } from "@/lib/catalog/cost-estimate";

export async function POST(
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
        { error: "Organization required" },
        { status: 403 },
      );
    }

    // Verify catalog ownership
    const { data: catalog } = await supabase
      .from("enterprise_catalogs")
      .select("id, organization_id, status")
      .eq("id", catalogId)
      .eq("organization_id", organizationId)
      .single();

    if (!catalog) {
      return NextResponse.json(
        { error: "Catalog not found or access denied" },
        { status: 404 },
      );
    }

    if (catalog.status === "ingesting") {
      return NextResponse.json(
        { error: "Catalog is already being ingested" },
        { status: 409 },
      );
    }

    // Count unprocessed tracks
    const { count: pendingCount } = await supabase
      .from("reference_tracks")
      .select("*", { count: "exact", head: true })
      .eq("catalog_id", catalogId)
      .eq("fingerprinted", false)
      .not("audio_url", "is", null);

    if (!pendingCount || pendingCount === 0) {
      return NextResponse.json(
        { error: "No unprocessed tracks to ingest" },
        { status: 400 },
      );
    }

    const estimate = estimateCatalogCost(pendingCount);

    // Emit Inngest event
    await inngest.send({
      name: "catalog/ingest",
      data: {
        catalog_id: catalogId,
        organization_id: organizationId,
      },
    });

    return NextResponse.json({
      status: "ingesting",
      estimated_tracks: pendingCount,
      estimated_cost_usd: estimate.estimated_cost_usd,
      estimated_minutes: estimate.estimated_time_minutes,
      is_within_plan: estimate.is_within_plan,
    });
  } catch (error) {
    console.error("[POST /api/catalogs/:id/ingest]", error);
    return NextResponse.json({ error: "Internal error" }, { status: 500 });
  }
}
