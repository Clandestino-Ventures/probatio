// @ts-nocheck
/**
 * PROBATIO — Revoke API Key
 *
 * DELETE /api/organizations/[orgId]/api-keys/[keyId] — Revoke a key.
 * Keeps the record for audit trail, sets revoked_at + is_active=false.
 */

import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";

export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ orgId: string; keyId: string }> },
) {
  try {
    const { orgId, keyId } = await params;
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
      return NextResponse.json({ error: "Admin or owner required" }, { status: 403 });
    }

    // Revoke (don't delete — keep for audit trail)
    const { error } = await admin
      .from("api_keys")
      .update({
        is_active: false,
        revoked_at: new Date().toISOString(),
        revoked_by: user.id,
      })
      .eq("id", keyId)
      .eq("organization_id", orgId);

    if (error) {
      return NextResponse.json({ error: "Failed to revoke key" }, { status: 500 });
    }

    await admin.from("audit_log").insert({
      entity_type: "api_key",
      entity_id: keyId,
      action: "api_key_revoked",
      actor_id: user.id,
      metadata: { organization_id: orgId },
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("[DELETE /api/organizations/:id/api-keys/:keyId]", error);
    return NextResponse.json({ error: "Internal error" }, { status: 500 });
  }
}
