// @ts-nocheck
/**
 * PROBATIO — Organizations API
 *
 * POST /api/organizations — Create a new organization (Enterprise only).
 */

import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { requireEnterprisePlan } from "@/lib/auth/plan-check";

export async function POST(request: Request) {
  try {
    const supabase = await createClient();
    const admin = createAdminClient();
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
        { error: "Enterprise plan required to create an organization.", code: "PLAN_REQUIRED" },
        { status: 403 },
      );
    }

    // Check if user already has an org
    const { data: profile } = await admin
      .from("profiles")
      .select("organization_id")
      .eq("id", user.id)
      .single() as { data: { organization_id: string | null } | null };

    if (profile?.organization_id) {
      return NextResponse.json(
        { error: "You already belong to an organization." },
        { status: 409 },
      );
    }

    const body = await request.json();
    const { name, slug } = body as { name?: string; slug?: string };

    if (!name?.trim()) {
      return NextResponse.json(
        { error: "Organization name is required." },
        { status: 400 },
      );
    }

    const orgSlug =
      slug?.trim().toLowerCase().replace(/[^a-z0-9-]/g, "-") ||
      name.trim().toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");

    // Create org
    const { data: org, error: orgError } = await admin
      .from("organizations")
      .insert({
        name: name.trim(),
        slug: orgSlug,
        plan_tier: "enterprise",
        created_by: user.id,
      })
      .select("id, name, slug")
      .single();

    if (orgError) {
      if (orgError.code === "23505") {
        return NextResponse.json(
          { error: "An organization with this slug already exists." },
          { status: 409 },
        );
      }
      return NextResponse.json({ error: "Failed to create organization." }, { status: 500 });
    }

    // Add user as owner
    await admin.from("organization_members").insert({
      organization_id: org.id,
      user_id: user.id,
      role: "owner",
      invited_by: null,
    });

    // Update user's profile
    await admin
      .from("profiles")
      .update({ organization_id: org.id })
      .eq("id", user.id);

    return NextResponse.json({ organization: org }, { status: 201 });
  } catch (error) {
    console.error("[POST /api/organizations]", error);
    return NextResponse.json({ error: "Internal error" }, { status: 500 });
  }
}
