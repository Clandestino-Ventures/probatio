// @ts-nocheck — Supabase query types will be auto-generated via `supabase gen types`
/**
 * PROBATIO — Clearance Alerts API
 *
 * GET /api/alerts — List alerts for the current user (paginated, filterable).
 */

import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export async function GET(request: Request) {
  try {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const url = new URL(request.url);
    const unreadOnly = url.searchParams.get("unread") === "true";
    const page = parseInt(url.searchParams.get("page") ?? "0", 10);
    const limit = Math.min(
      parseInt(url.searchParams.get("limit") ?? "20", 10),
      50,
    );

    let query = supabase
      .from("clearance_alerts")
      .select("*", { count: "exact" })
      .eq("user_id", user.id)
      .order("created_at", { ascending: false })
      .range(page * limit, (page + 1) * limit - 1);

    if (unreadOnly) {
      query = query.eq("read", false);
    }

    const { data: alerts, count, error } = await query;

    if (error) {
      return NextResponse.json(
        { error: "Failed to fetch alerts" },
        { status: 500 },
      );
    }

    // Also get unread count
    const { count: unreadCount } = await supabase
      .from("clearance_alerts")
      .select("*", { count: "exact", head: true })
      .eq("user_id", user.id)
      .eq("read", false);

    return NextResponse.json({
      alerts: alerts ?? [],
      total: count ?? 0,
      unread_count: unreadCount ?? 0,
      page,
      limit,
    });
  } catch (error) {
    console.error("[GET /api/alerts]", error);
    return NextResponse.json({ error: "Internal error" }, { status: 500 });
  }
}
