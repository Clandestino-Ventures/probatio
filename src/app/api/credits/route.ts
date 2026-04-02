// @ts-nocheck — Supabase query types will be auto-generated via `supabase gen types`
/**
 * PROBATIO — Credits Balance API
 *
 * GET /api/credits
 *
 * Returns the authenticated user's current credit balance,
 * plan tier, monthly allowance, and lifetime usage.
 */

import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { PLANS } from "@/lib/constants";
import { rateLimit } from "@/lib/rate-limit";
import type { PlanTier } from "@/types/database";

export async function GET() {
  try {
    // ── Auth ────────────────────────────────────────────────────────────
    const supabase = await createClient();
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json(
        { success: false, error: { code: "UNAUTHORIZED", message: "Authentication required." } },
        { status: 401 },
      );
    }

    // ── Rate limit ──────────────────────────────────────────────────────
    const { success: rateLimitOk, resetIn } = rateLimit(`credits:${user.id}`, 30, 60_000);
    if (!rateLimitOk) {
      return NextResponse.json(
        { error: 'Rate limit exceeded. Please try again later.' },
        { status: 429, headers: { 'Retry-After': String(Math.ceil(resetIn / 1000)) } }
      );
    }

    // ── Query credits ──────────────────────────────────────────────────
    const { data: credits, error: creditsError } = await supabase
      .from("credits")
      .select("*")
      .eq("user_id", user.id)
      .single();

    if (creditsError || !credits) {
      return NextResponse.json(
        { success: false, error: { code: "NOT_FOUND", message: "Credit record not found." } },
        { status: 404 },
      );
    }

    // ── Query profile for plan tier ────────────────────────────────────
    const { data: profile } = await supabase
      .from("profiles")
      .select("*")
      .eq("id", user.id)
      .single();

    const planTier = (profile?.plan_tier as PlanTier) ?? "free";
    const plan = PLANS[planTier];

    return NextResponse.json(
      {
        success: true,
        data: {
          balance: credits.balance,
          planTier,
          monthlyAllowance: plan.creditsPerMonth,
          lifetimeUsed: credits.lifetime_used,
          lifetimePurchased: credits.lifetime_purchased,
          lastReplenishedAt: credits.last_replenished_at,
        },
      },
      { status: 200 },
    );
  } catch (error) {
    console.error("[GET /api/credits] Unhandled error:", error);
    return NextResponse.json(
      {
        success: false,
        error: {
          code: "INTERNAL_ERROR",
          message: "An unexpected error occurred.",
        },
      },
      { status: 500 },
    );
  }
}
