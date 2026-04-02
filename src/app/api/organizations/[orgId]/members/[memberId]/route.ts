// @ts-nocheck
/**
 * PROBATIO — Organization Member Management API
 *
 * PATCH /api/organizations/[orgId]/members/[memberId] — Change role (Owner only).
 * DELETE /api/organizations/[orgId]/members/[memberId] — Remove member (Admin/Owner).
 */

import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ orgId: string; memberId: string }> },
) {
  try {
    const { orgId, memberId } = await params;
    const supabase = await createClient();
    const admin = createAdminClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Only owner can change roles
    const { data: callerMembership } = await admin
      .from("organization_members")
      .select("role")
      .eq("organization_id", orgId)
      .eq("user_id", user.id)
      .single() as { data: { role: string } | null };

    if (!callerMembership || callerMembership.role !== "owner") {
      return NextResponse.json(
        { error: "Only the organization owner can change roles." },
        { status: 403 },
      );
    }

    // Fetch target member
    const { data: targetMember } = await admin
      .from("organization_members")
      .select("id, user_id, role")
      .eq("id", memberId)
      .eq("organization_id", orgId)
      .single() as { data: { id: string; user_id: string; role: string } | null };

    if (!targetMember) {
      return NextResponse.json({ error: "Member not found" }, { status: 404 });
    }

    // Cannot change own role
    if (targetMember.user_id === user.id) {
      return NextResponse.json(
        { error: "Cannot change your own role. Use transfer ownership." },
        { status: 400 },
      );
    }

    const body = await request.json();
    const { role } = body as { role?: string };

    if (role === "owner") {
      return NextResponse.json(
        { error: "Cannot set role to owner. Use transfer ownership." },
        { status: 400 },
      );
    }

    if (role !== "member" && role !== "admin") {
      return NextResponse.json(
        { error: "Role must be 'member' or 'admin'." },
        { status: 400 },
      );
    }

    await admin
      .from("organization_members")
      .update({ role })
      .eq("id", memberId);

    return NextResponse.json({ success: true, role });
  } catch (error) {
    console.error("[PATCH /api/organizations/:id/members/:memberId]", error);
    return NextResponse.json({ error: "Internal error" }, { status: 500 });
  }
}

export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ orgId: string; memberId: string }> },
) {
  try {
    const { orgId, memberId } = await params;
    const supabase = await createClient();
    const admin = createAdminClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Admin or owner can remove members
    const { data: callerMembership } = await admin
      .from("organization_members")
      .select("role")
      .eq("organization_id", orgId)
      .eq("user_id", user.id)
      .single() as { data: { role: string } | null };

    if (!callerMembership || (callerMembership.role !== "admin" && callerMembership.role !== "owner")) {
      return NextResponse.json({ error: "Insufficient permissions." }, { status: 403 });
    }

    // Fetch target member
    const { data: targetMember } = await admin
      .from("organization_members")
      .select("id, user_id, role")
      .eq("id", memberId)
      .eq("organization_id", orgId)
      .single() as { data: { id: string; user_id: string; role: string } | null };

    if (!targetMember) {
      return NextResponse.json({ error: "Member not found" }, { status: 404 });
    }

    // Cannot remove owner
    if (targetMember.role === "owner") {
      return NextResponse.json(
        { error: "Cannot remove the organization owner." },
        { status: 400 },
      );
    }

    // Remove member
    await admin
      .from("organization_members")
      .delete()
      .eq("id", memberId);

    // Clear their profile org
    await admin
      .from("profiles")
      .update({ organization_id: null })
      .eq("id", targetMember.user_id);

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("[DELETE /api/organizations/:id/members/:memberId]", error);
    return NextResponse.json({ error: "Internal error" }, { status: 500 });
  }
}
