// @ts-nocheck — Supabase query types will be auto-generated via `supabase gen types`
/**
 * PROBATIO — Alert Detail API
 *
 * PATCH /api/alerts/[alertId] — Mark alert as read/dismissed.
 */

import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ alertId: string }> },
) {
  try {
    const { alertId } = await params;
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await request.json();
    const { read } = body as { read?: boolean };

    const { error } = await supabase
      .from("clearance_alerts")
      .update({ read: read ?? true })
      .eq("id", alertId)
      .eq("user_id", user.id);

    if (error) {
      return NextResponse.json(
        { error: "Failed to update alert" },
        { status: 500 },
      );
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("[PATCH /api/alerts/:id]", error);
    return NextResponse.json({ error: "Internal error" }, { status: 500 });
  }
}
