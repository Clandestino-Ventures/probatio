// @ts-nocheck
/**
 * PROBATIO — Organization Detail API
 *
 * GET /api/organizations/[orgId] — Org detail with members + stats.
 */

import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ orgId: string }> },
) {
  try {
    const { orgId } = await params;
    const supabase = await createClient();
    const admin = createAdminClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Verify membership
    const { data: membership } = await admin
      .from("organization_members")
      .select("role")
      .eq("organization_id", orgId)
      .eq("user_id", user.id)
      .single() as { data: { role: string } | null };

    if (!membership) {
      return NextResponse.json({ error: "Not a member of this organization" }, { status: 403 });
    }

    // Fetch org
    const { data: org } = await admin
      .from("organizations")
      .select("*")
      .eq("id", orgId)
      .single();

    if (!org) {
      return NextResponse.json({ error: "Organization not found" }, { status: 404 });
    }

    // Fetch members with profile info
    const { data: members } = await admin
      .from("organization_members")
      .select("id, user_id, role, joined_at, invited_by")
      .eq("organization_id", orgId)
      .order("joined_at");

    // Enrich members with profile data
    const enrichedMembers = [];
    for (const m of members ?? []) {
      const { data: profile } = await admin
        .from("profiles")
        .select("email, display_name, avatar_url")
        .eq("id", m.user_id)
        .single() as { data: { email: string; display_name: string | null; avatar_url: string | null } | null };

      enrichedMembers.push({
        ...m,
        email: profile?.email ?? "",
        display_name: profile?.display_name ?? null,
        avatar_url: profile?.avatar_url ?? null,
      });
    }

    // Stats
    const { count: analysesCount } = await admin
      .from("analyses")
      .select("*", { count: "exact", head: true })
      .eq("user_id", user.id);

    const { count: catalogsCount } = await admin
      .from("enterprise_catalogs")
      .select("*", { count: "exact", head: true })
      .eq("organization_id", orgId);

    return NextResponse.json({
      organization: org,
      members: enrichedMembers,
      userRole: membership.role,
      stats: {
        analyses: analysesCount ?? 0,
        catalogs: catalogsCount ?? 0,
        members: enrichedMembers.length,
      },
    });
  } catch (error) {
    console.error("[GET /api/organizations/:id]", error);
    return NextResponse.json({ error: "Internal error" }, { status: 500 });
  }
}
