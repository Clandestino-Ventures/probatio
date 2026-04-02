// @ts-nocheck
/**
 * PROBATIO — Transfer Ownership API
 *
 * POST /api/organizations/[orgId]/transfer — Transfer org ownership.
 * Auth: Owner only. Old owner becomes admin, target becomes owner.
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

    // Verify current owner
    const { data: callerMembership } = await admin
      .from("organization_members")
      .select("id, role")
      .eq("organization_id", orgId)
      .eq("user_id", user.id)
      .single() as { data: { id: string; role: string } | null };

    if (!callerMembership || callerMembership.role !== "owner") {
      return NextResponse.json(
        { error: "Only the current owner can transfer ownership." },
        { status: 403 },
      );
    }

    const body = await request.json();
    const { new_owner_user_id } = body as { new_owner_user_id?: string };

    if (!new_owner_user_id) {
      return NextResponse.json(
        { error: "new_owner_user_id is required." },
        { status: 400 },
      );
    }

    if (new_owner_user_id === user.id) {
      return NextResponse.json(
        { error: "You are already the owner." },
        { status: 400 },
      );
    }

    // Verify target is a member
    const { data: targetMembership } = await admin
      .from("organization_members")
      .select("id, role")
      .eq("organization_id", orgId)
      .eq("user_id", new_owner_user_id)
      .single() as { data: { id: string; role: string } | null };

    if (!targetMembership) {
      return NextResponse.json(
        { error: "Target user is not a member of this organization." },
        { status: 404 },
      );
    }

    // Transfer: old owner → admin, new owner → owner
    await admin
      .from("organization_members")
      .update({ role: "admin" })
      .eq("id", callerMembership.id);

    await admin
      .from("organization_members")
      .update({ role: "owner" })
      .eq("id", targetMembership.id);

    return NextResponse.json({ success: true, new_owner: new_owner_user_id });
  } catch (error) {
    console.error("[POST /api/organizations/:id/transfer]", error);
    return NextResponse.json({ error: "Internal error" }, { status: 500 });
  }
}
