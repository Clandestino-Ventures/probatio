// @ts-nocheck — Supabase query types will be auto-generated via `supabase gen types`
/**
 * PROBATIO — Subscription Checkout API
 *
 * POST /api/checkout
 *
 * Creates a Stripe Checkout Session in subscription mode
 * for the given priceId. Returns the checkout URL.
 */

import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { getStripe } from "@/lib/stripe/client";
import { rateLimit } from "@/lib/rate-limit";

export async function POST(request: Request) {
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

    // ── Parse body ─────────────────────────────────────────────────────
    const body = await request.json();
    const { priceId, successUrl, cancelUrl, planTier } = body as {
      priceId?: string;
      successUrl?: string;
      cancelUrl?: string;
      planTier?: string;
    };

    if (!priceId) {
      return NextResponse.json(
        { success: false, error: { code: "BAD_REQUEST", message: "priceId is required." } },
        { status: 400 },
      );
    }

    const stripe = getStripe();

    // ── Find or create Stripe customer ─────────────────────────────────
    let stripeCustomerId: string | undefined;

    // Check if user already has a subscription with a Stripe customer.
    const { data: existingSub } = await supabase
      .from("subscriptions")
      .select("*")
      .eq("user_id", user.id)
      .single();

    if (existingSub?.stripe_customer_id) {
      stripeCustomerId = existingSub.stripe_customer_id;
    } else {
      // Create a new Stripe customer.
      const customer = await stripe.customers.create({
        email: user.email,
        metadata: {
          userId: user.id,
        },
      });
      stripeCustomerId = customer.id;
    }

    // ── Create Checkout Session ────────────────────────────────────────
    const origin = request.headers.get("origin") ?? process.env.NEXT_PUBLIC_APP_URL ?? "";

    const session = await stripe.checkout.sessions.create({
      customer: stripeCustomerId,
      mode: "subscription",
      line_items: [
        {
          price: priceId,
          quantity: 1,
        },
      ],
      success_url: successUrl ?? `${origin}/dashboard?checkout=success`,
      cancel_url: cancelUrl ?? `${origin}/pricing?checkout=canceled`,
      metadata: {
        userId: user.id,
        type: "subscription",
        planTier: planTier ?? "",
      },
    });

    return NextResponse.json(
      {
        success: true,
        data: {
          url: session.url,
          sessionId: session.id,
        },
      },
      { status: 200 },
    );
  } catch (error) {
    console.error("[POST /api/checkout] Unhandled error:", error);
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
