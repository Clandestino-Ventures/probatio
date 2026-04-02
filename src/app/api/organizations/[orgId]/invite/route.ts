// @ts-nocheck
/**
 * PROBATIO — Invite Member API
 *
 * POST /api/organizations/[orgId]/invite — Invite a user by email.
 * Auth: Admin or Owner. Cannot invite as owner.
 */

import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";

export async function POST(
  request: Request,
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

    // Verify admin/owner
    const { data: membership } = await admin
      .from("organization_members")
      .select("role")
      .eq("organization_id", orgId)
      .eq("user_id", user.id)
      .single() as { data: { role: string } | null };

    if (!membership || (membership.role !== "admin" && membership.role !== "owner")) {
      return NextResponse.json(
        { error: "Only admins and owners can invite members." },
        { status: 403 },
      );
    }

    const body = await request.json();
    const { email, role } = body as { email?: string; role?: string };

    if (!email?.trim()) {
      return NextResponse.json({ error: "Email is required." }, { status: 400 });
    }

    if (role === "owner") {
      return NextResponse.json(
        { error: "Cannot invite as owner. Use transfer ownership instead." },
        { status: 400 },
      );
    }

    const memberRole = role === "admin" ? "admin" : "member";

    // Look up user by email
    const { data: inviteeProfile } = await admin
      .from("profiles")
      .select("id, organization_id")
      .eq("email", email.trim().toLowerCase())
      .single() as { data: { id: string; organization_id: string | null } | null };

    if (!inviteeProfile) {
      return NextResponse.json(
        { error: "No Probatio user found with this email. They must sign up first." },
        { status: 404 },
      );
    }

    if (inviteeProfile.organization_id) {
      return NextResponse.json(
        { error: "This user already belongs to an organization." },
        { status: 409 },
      );
    }

    // Check not already a member
    const { data: existing } = await admin
      .from("organization_members")
      .select("id")
      .eq("organization_id", orgId)
      .eq("user_id", inviteeProfile.id)
      .single();

    if (existing) {
      return NextResponse.json(
        { error: "This user is already a member." },
        { status: 409 },
      );
    }

    // Add member
    await admin.from("organization_members").insert({
      organization_id: orgId,
      user_id: inviteeProfile.id,
      role: memberRole,
      invited_by: user.id,
    });

    // Update invitee's profile
    await admin
      .from("profiles")
      .update({ organization_id: orgId })
      .eq("id", inviteeProfile.id);

    return NextResponse.json(
      { success: true, user_id: inviteeProfile.id, role: memberRole },
      { status: 201 },
    );
  } catch (error) {
    console.error("[POST /api/organizations/:id/invite]", error);
    return NextResponse.json({ error: "Internal error" }, { status: 500 });
  }
}
