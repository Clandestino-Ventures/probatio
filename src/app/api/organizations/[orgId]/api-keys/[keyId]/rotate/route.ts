// @ts-nocheck
/**
 * PROBATIO — Rotate API Key
 *
 * POST /api/organizations/[orgId]/api-keys/[keyId]/rotate
 * Revokes old key + creates new one with same config. Returns new full key ONCE.
 */

import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { generateApiKey } from "@/lib/auth/api-keys";

export async function POST(
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

    const { data: membership } = await admin
      .from("organization_members")
      .select("role")
      .eq("organization_id", orgId)
      .eq("user_id", user.id)
      .single() as { data: { role: string } | null };

    if (!membership || (membership.role !== "admin" && membership.role !== "owner")) {
      return NextResponse.json({ error: "Admin or owner required" }, { status: 403 });
    }

    // Fetch old key config
    const { data: oldKey } = await admin
      .from("api_keys")
      .select("name, description, permissions, rate_limit_per_minute, rate_limit_per_day, expires_at")
      .eq("id", keyId)
      .eq("organization_id", orgId)
      .single() as { data: { name: string; description: string | null; permissions: string[]; rate_limit_per_minute: number; rate_limit_per_day: number; expires_at: string | null } | null };

    if (!oldKey) {
      return NextResponse.json({ error: "Key not found" }, { status: 404 });
    }

    // Revoke old key
    await admin
      .from("api_keys")
      .update({
        is_active: false,
        revoked_at: new Date().toISOString(),
        revoked_by: user.id,
      })
      .eq("id", keyId);

    // Create new key with same config
    const { fullKey, keyHash, keyPrefix } = generateApiKey();

    const { data: newKey } = await admin
      .from("api_keys")
      .insert({
        organization_id: orgId,
        key_prefix: keyPrefix,
        key_hash: keyHash,
        name: oldKey.name,
        description: oldKey.description,
        permissions: oldKey.permissions,
        rate_limit_per_minute: oldKey.rate_limit_per_minute,
        rate_limit_per_day: oldKey.rate_limit_per_day,
        created_by: user.id,
        expires_at: oldKey.expires_at,
      })
      .select("id, key_prefix, name, permissions, created_at")
      .single();

    await admin.from("audit_log").insert({
      entity_type: "api_key",
      entity_id: newKey?.id ?? keyId,
      action: "api_key_rotated",
      actor_id: user.id,
      metadata: { old_key_id: keyId, organization_id: orgId },
    });

    return NextResponse.json(
      {
        key: { ...newKey, full_key: fullKey },
        old_key_revoked: keyId,
        warning: "Save this key now. It will not be shown again.",
      },
      { status: 201 },
    );
  } catch (error) {
    console.error("[POST /api/organizations/:id/api-keys/:keyId/rotate]", error);
    return NextResponse.json({ error: "Internal error" }, { status: 500 });
  }
}
