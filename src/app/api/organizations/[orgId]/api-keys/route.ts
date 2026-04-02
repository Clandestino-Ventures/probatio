// @ts-nocheck
/**
 * PROBATIO — API Keys CRUD
 *
 * POST /api/organizations/[orgId]/api-keys — Create key (returns full key ONCE).
 * GET  /api/organizations/[orgId]/api-keys — List keys (prefix only, never full key).
 */

import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { generateApiKey } from "@/lib/auth/api-keys";

async function verifyAdminOrOwner(
  admin: ReturnType<typeof createAdminClient>,
  orgId: string,
  userId: string,
): Promise<boolean> {
  const { data } = await admin
    .from("organization_members")
    .select("role")
    .eq("organization_id", orgId)
    .eq("user_id", userId)
    .single() as { data: { role: string } | null };

  return data?.role === "admin" || data?.role === "owner";
}

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

    if (!(await verifyAdminOrOwner(admin, orgId, user.id))) {
      return NextResponse.json({ error: "Admin or owner required" }, { status: 403 });
    }

    const { data: keys } = await admin
      .from("api_keys")
      .select(
        "id, key_prefix, name, description, permissions, rate_limit_per_minute, rate_limit_per_day, is_active, last_used_at, total_requests, created_at, expires_at, revoked_at",
      )
      .eq("organization_id", orgId)
      .order("created_at", { ascending: false });

    return NextResponse.json({ keys: keys ?? [] });
  } catch (error) {
    console.error("[GET /api/organizations/:id/api-keys]", error);
    return NextResponse.json({ error: "Internal error" }, { status: 500 });
  }
}

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

    if (!(await verifyAdminOrOwner(admin, orgId, user.id))) {
      return NextResponse.json({ error: "Admin or owner required" }, { status: 403 });
    }

    const body = await request.json();
    const {
      name,
      description,
      permissions,
      expires_in_days,
    } = body as {
      name?: string;
      description?: string;
      permissions?: string[];
      expires_in_days?: number;
    };

    if (!name?.trim()) {
      return NextResponse.json({ error: "Key name is required" }, { status: 400 });
    }

    const validPerms = ["analyze", "catalogs", "reports", "forensic", "verify", "admin"];
    const perms = (permissions ?? ["analyze"]).filter((p) => validPerms.includes(p));

    const { fullKey, keyHash, keyPrefix } = generateApiKey();

    const expiresAt = expires_in_days
      ? new Date(Date.now() + expires_in_days * 86_400_000).toISOString()
      : null;

    const { data: key, error: insertError } = await admin
      .from("api_keys")
      .insert({
        organization_id: orgId,
        key_prefix: keyPrefix,
        key_hash: keyHash,
        name: name.trim(),
        description: description?.trim() || null,
        permissions: perms,
        created_by: user.id,
        expires_at: expiresAt,
      })
      .select("id, key_prefix, name, permissions, created_at, expires_at")
      .single();

    if (insertError) {
      return NextResponse.json({ error: "Failed to create key" }, { status: 500 });
    }

    // Record in audit log
    await admin.from("audit_log").insert({
      entity_type: "api_key",
      entity_id: key.id,
      action: "api_key_created",
      actor_id: user.id,
      metadata: { key_prefix: keyPrefix, permissions: perms, organization_id: orgId },
    });

    return NextResponse.json(
      {
        key: {
          ...key,
          // Full key returned ONCE — never stored or returned again
          full_key: fullKey,
        },
        warning: "Save this key now. It will not be shown again.",
      },
      { status: 201 },
    );
  } catch (error) {
    console.error("[POST /api/organizations/:id/api-keys]", error);
    return NextResponse.json({ error: "Internal error" }, { status: 500 });
  }
}
