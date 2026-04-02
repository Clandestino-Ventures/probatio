// @ts-nocheck
/**
 * PROBATIO — Admin Users API
 *
 * GET /api/admin/users — Paginated user list.
 * Auth: Platform admin only.
 */

import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { requireAdmin } from "@/lib/auth/require-admin";

export async function GET(request: Request) {
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
      await requireAdmin(user.id);
    } catch {
      return NextResponse.json({ error: "Admin access required" }, { status: 403 });
    }

    const url = new URL(request.url);
    const page = parseInt(url.searchParams.get("page") ?? "0", 10);
    const limit = Math.min(parseInt(url.searchParams.get("limit") ?? "25", 10), 100);
    const search = url.searchParams.get("search");
    const planFilter = url.searchParams.get("plan");

    let query = admin
      .from("profiles")
      .select("id, email, display_name, avatar_url, role, plan_tier, organization_id, created_at", {
        count: "exact",
      })
      .order("created_at", { ascending: false })
      .range(page * limit, (page + 1) * limit - 1);

    if (search) {
      query = query.or(`email.ilike.%${search}%,display_name.ilike.%${search}%`);
    }
    if (planFilter && planFilter !== "all") {
      query = query.eq("plan_tier", planFilter);
    }

    const { data: users, count } = await query;

    return NextResponse.json({
      users: users ?? [],
      total: count ?? 0,
      page,
      limit,
    });
  } catch (error) {
    console.error("[GET /api/admin/users]", error);
    return NextResponse.json({ error: "Internal error" }, { status: 500 });
  }
}
