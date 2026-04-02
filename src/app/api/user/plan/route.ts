/**
 * PROBATIO — User Plan Tier API
 *
 * GET /api/user/plan — Returns the current user's subscription plan tier.
 */

import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { getUserPlanTier } from "@/lib/auth/plan-check";

export async function GET() {
  try {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ tier: "free" });
    }

    const tier = await getUserPlanTier(user.id);
    return NextResponse.json({ tier });
  } catch {
    return NextResponse.json({ tier: "free" });
  }
}
