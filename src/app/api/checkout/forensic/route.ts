// @ts-nocheck — Supabase query types will be auto-generated via `supabase gen types`
/**
 * PROBATIO — Forensic Case Payment Checkout API
 *
 * POST /api/checkout/forensic
 *
 * Creates a Stripe Checkout Session for a forensic case.
 * Supports two tiers: Standard ($5,000) and Expert ($15,000).
 * Uses Stripe Price IDs from env vars.
 */

import { type NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { getStripe } from "@/lib/stripe/client";
import { rateLimit } from "@/lib/rate-limit";

export async function POST(request: NextRequest) {
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
    const { success: rateLimitOk, resetIn } = rateLimit(`checkout:${user.id}`, 5, 60_000);
    if (!rateLimitOk) {
      return NextResponse.json(
        { error: 'Rate limit exceeded. Please try again later.' },
        { status: 429, headers: { 'Retry-After': String(Math.ceil(resetIn / 1000)) } }
      );
    }

    // ── Get caseId and tier from body or search params ────────────────
    let caseId: string | null = request.nextUrl.searchParams.get("caseId");
    let tier: string = request.nextUrl.searchParams.get("tier") ?? "standard";

    if (!caseId) {
      try {
        const body = await request.json();
        caseId = body.caseId ?? null;
        tier = body.tier ?? tier;
      } catch {
        // Body may not be JSON
      }
    }

    if (!caseId) {
      return NextResponse.json(
        { success: false, error: { code: "BAD_REQUEST", message: "caseId is required." } },
        { status: 400 },
      );
    }

    // ── Validate case exists and belongs to user ───────────────────────
    const { data: forensicCase, error: caseError } = await supabase
      .from("forensic_cases")
      .select("*")
      .eq("id", caseId)
      .single();

    if (caseError || !forensicCase) {
      return NextResponse.json(
        { success: false, error: { code: "NOT_FOUND", message: "Forensic case not found." } },
        { status: 404 },
      );
    }

    if (forensicCase.user_id !== user.id) {
      return NextResponse.json(
        { success: false, error: { code: "FORBIDDEN", message: "You do not own this forensic case." } },
        { status: 403 },
      );
    }

    // ── Determine price ID from tier ─────────────────────────────────
    const priceId = tier === "expert"
      ? process.env.STRIPE_PRICE_FORENSIC_EXPERT
      : process.env.STRIPE_PRICE_FORENSIC_STANDARD;

    if (!priceId) {
      console.error(`[PROBATIO] Missing STRIPE_PRICE_FORENSIC_${tier.toUpperCase()} env var`);
      return NextResponse.json(
        { success: false, error: { code: "CONFIG_ERROR", message: "Payment configuration error." } },
        { status: 500 },
      );
    }

    // ── Create Stripe Checkout Session ─────────────────────────────────
    const stripe = getStripe();
    const appUrl = process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000";

    const session = await stripe.checkout.sessions.create({
      mode: "payment",
      customer_email: user.email ?? undefined,
      line_items: [{ price: priceId, quantity: 1 }],
      payment_intent_data: {
        metadata: {
          forensicCaseId: caseId,
          userId: user.id,
          tier,
        },
      },
      success_url: `${appUrl}/dashboard/forensic/${caseId}?payment=success`,
      cancel_url: `${appUrl}/dashboard/forensic/${caseId}?payment=canceled`,
      metadata: {
        userId: user.id,
        type: "forensic",
        forensicCaseId: caseId,
        tier,
      },
    });

    return NextResponse.json({
      success: true,
      data: { url: session.url, sessionId: session.id },
    });
  } catch (error) {
    console.error("[POST /api/checkout/forensic] Unhandled error:", error);
    return NextResponse.json(
      { success: false, error: { code: "INTERNAL_ERROR", message: "An unexpected error occurred." } },
      { status: 500 },
    );
  }
}
