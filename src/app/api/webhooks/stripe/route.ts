// @ts-nocheck — Supabase query types will be auto-generated via `supabase gen types`
/**
 * PROBATIO — Stripe Webhook Handler
 *
 * POST /api/webhooks/stripe
 *
 * Receives Stripe webhook events, verifies signatures, and processes:
 *   - checkout.session.completed (subscription or forensic payment)
 *   - invoice.paid (credit refresh for billing cycle)
 *   - customer.subscription.updated (plan tier change)
 *   - customer.subscription.deleted (downgrade to free)
 *   - payment_intent.succeeded (forensic case payment)
 *
 * Uses the admin Supabase client to bypass RLS.
 */

import { NextResponse } from "next/server";
import { getStripe, getWebhookSecret } from "@/lib/stripe/client";
import { createAdminClient } from "@/lib/supabase/admin";
import { inngest } from "@/lib/inngest/client";
import { PLANS } from "@/lib/constants";
import type { PlanTier } from "@/types/database";
import type Stripe from "stripe";

export async function POST(request: Request) {
  const stripe = getStripe();
  const webhookSecret = getWebhookSecret();
  const supabase = createAdminClient();

  // ── Read raw body & verify signature ─────────────────────────────────
  let event: Stripe.Event;

  try {
    const body = await request.text();
    const signature = request.headers.get("stripe-signature");

    if (!signature) {
      return NextResponse.json(
        { error: "Missing stripe-signature header." },
        { status: 400 },
      );
    }

    event = stripe.webhooks.constructEvent(body, signature, webhookSecret);
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    console.error("[Stripe Webhook] Signature verification failed:", message);
    return NextResponse.json(
      { error: `Webhook signature verification failed: ${message}` },
      { status: 400 },
    );
  }

  // ── Event handlers ───────────────────────────────────────────────────
  try {
    switch (event.type) {
      // ── Checkout completed ─────────────────────────────────────────
      case "checkout.session.completed": {
        const session = event.data.object as Stripe.Checkout.Session;
        const metadata = session.metadata ?? {};
        const userId = metadata.userId;

        if (!userId) {
          console.warn("[Stripe Webhook] checkout.session.completed: missing userId in metadata");
          break;
        }

        if (metadata.type === "subscription") {
          // Subscription checkout completed.
          const subscriptionId =
            typeof session.subscription === "string"
              ? session.subscription
              : (session.subscription as Stripe.Subscription | null)?.id;

          const customerId =
            typeof session.customer === "string"
              ? session.customer
              : (session.customer as Stripe.Customer | null)?.id;

          const planTier = (metadata.planTier as PlanTier) ?? "starter";
          const plan = PLANS[planTier];

          if (subscriptionId && customerId) {
            // Upsert subscription record.
            await supabase.from("subscriptions").upsert(
              {
                user_id: userId,
                stripe_customer_id: customerId,
                stripe_subscription_id: subscriptionId,
                plan_tier: planTier,
                status: "active",
                current_period_start: new Date().toISOString(),
                current_period_end: new Date(
                  Date.now() + 30 * 24 * 60 * 60 * 1000,
                ).toISOString(),
                updated_at: new Date().toISOString(),
              },
              { onConflict: "user_id" },
            );

            // Update profile plan tier.
            await supabase
              .from("profiles")
              .update({ plan_tier: planTier, updated_at: new Date().toISOString() })
              .eq("id", userId);

            // Set credits to the plan's monthly allowance.
            await supabase
              .from("credits")
              .update({
                balance: plan.creditsPerMonth,
                last_replenished_at: new Date().toISOString(),
                updated_at: new Date().toISOString(),
              })
              .eq("user_id", userId);
          }
        } else if (metadata.type === "forensic") {
          // Forensic case payment completed.
          const forensicCaseId = metadata.forensicCaseId;
          if (forensicCaseId) {
            await supabase
              .from("forensic_cases")
              .update({
                status: "in_review",
                updated_at: new Date().toISOString(),
              })
              .eq("id", forensicCaseId);
          }
        }

        break;
      }

      // ── Invoice paid (recurring billing) ───────────────────────────
      case "invoice.paid": {
        const invoice = event.data.object as Stripe.Invoice;
        const customerId =
          typeof invoice.customer === "string"
            ? invoice.customer
            : (invoice.customer as Stripe.Customer | null)?.id;

        if (!customerId) break;

        // Find subscription by customer ID.
        const { data: subscription } = await supabase
          .from("subscriptions")
          .select("*")
          .eq("stripe_customer_id", customerId)
          .single();

        if (subscription) {
          const plan = PLANS[subscription.plan_tier as PlanTier];

          // Refresh credits for the new billing period.
          await supabase
            .from("credits")
            .update({
              balance: plan.creditsPerMonth,
              last_replenished_at: new Date().toISOString(),
              updated_at: new Date().toISOString(),
            })
            .eq("user_id", subscription.user_id);
        }

        break;
      }

      // ── Subscription updated ───────────────────────────────────────
      case "customer.subscription.updated": {
        const sub = event.data.object as Stripe.Subscription;
        const customerId =
          typeof sub.customer === "string"
            ? sub.customer
            : (sub.customer as Stripe.Customer | null)?.id;

        if (!customerId) break;

        // Find existing subscription record.
        const { data: existingSub } = await supabase
          .from("subscriptions")
          .select("*")
          .eq("stripe_customer_id", customerId)
          .single();

        if (existingSub) {
          // Determine new plan tier from metadata or price.
          const newTier =
            (sub.metadata?.planTier as PlanTier) ?? "starter";

          await supabase
            .from("subscriptions")
            .update({
              plan_tier: newTier,
              status: sub.status === "active" ? "active" : sub.status === "past_due" ? "past_due" : "active",
              cancel_at_period_end: sub.cancel_at_period_end,
              current_period_start: new Date(sub.current_period_start * 1000).toISOString(),
              current_period_end: new Date(sub.current_period_end * 1000).toISOString(),
              updated_at: new Date().toISOString(),
            })
            .eq("stripe_customer_id", customerId);

          // Update profile plan tier.
          await supabase
            .from("profiles")
            .update({ plan_tier: newTier, updated_at: new Date().toISOString() })
            .eq("id", existingSub.user_id);
        }

        break;
      }

      // ── Subscription deleted ───────────────────────────────────────
      case "customer.subscription.deleted": {
        const deletedSub = event.data.object as Stripe.Subscription;
        const deletedCustomerId =
          typeof deletedSub.customer === "string"
            ? deletedSub.customer
            : (deletedSub.customer as Stripe.Customer | null)?.id;

        if (!deletedCustomerId) break;

        const { data: canceledSub } = await supabase
          .from("subscriptions")
          .select("*")
          .eq("stripe_customer_id", deletedCustomerId)
          .single();

        if (canceledSub) {
          // Update subscription to canceled.
          await supabase
            .from("subscriptions")
            .update({
              status: "canceled",
              updated_at: new Date().toISOString(),
            })
            .eq("stripe_customer_id", deletedCustomerId);

          // Downgrade profile to free.
          await supabase
            .from("profiles")
            .update({ plan_tier: "free", updated_at: new Date().toISOString() })
            .eq("id", canceledSub.user_id);

          // Set credits to free tier allowance (3).
          await supabase
            .from("credits")
            .update({
              balance: PLANS.free.creditsPerMonth,
              last_replenished_at: new Date().toISOString(),
              updated_at: new Date().toISOString(),
            })
            .eq("user_id", canceledSub.user_id);
        }

        break;
      }

      // ── Payment intent succeeded (forensic case) ───────────────────
      case "payment_intent.succeeded": {
        const paymentIntent = event.data.object as Stripe.PaymentIntent;
        const piMetadata = paymentIntent.metadata ?? {};
        const forensicCaseId = piMetadata.forensicCaseId;

        if (forensicCaseId) {
          // Update case status to paid / in_review.
          await supabase
            .from("forensic_cases")
            .update({
              status: "in_review",
              updated_at: new Date().toISOString(),
            })
            .eq("id", forensicCaseId);

          // Fetch case details for Inngest event.
          const { data: forensicCase } = await supabase
            .from("forensic_cases")
            .select("*")
            .eq("id", forensicCaseId)
            .single();

          if (forensicCase) {
            // Extract track URLs from chain of custody metadata.
            const initialEntry = (
              forensicCase.chain_of_custody as Record<string, unknown>[]
            )?.[0];
            const entryMeta = (initialEntry?.metadata ?? {}) as Record<string, string>;

            await inngest.send({
              name: "forensic-analysis/requested",
              data: {
                forensicCaseId,
                analysisId: forensicCase.analysis_id,
                userId: forensicCase.user_id,
                trackAUrl: entryMeta.trackAUrl ?? "",
                trackAHashSha256: "",
                trackBUrl: entryMeta.trackBUrl ?? "",
                trackBHashSha256: "",
                paymentIntentId: paymentIntent.id,
                tier: (piMetadata.tier as "standard" | "expert") ?? "standard",
              },
            });
          }
        }

        break;
      }

      default:
        // Unhandled event type — acknowledge receipt.
        break;
    }
  } catch (error) {
    console.error(`[Stripe Webhook] Error processing ${event.type}:`, error);
    // Return 200 even on processing errors to prevent Stripe retries
    // for events we received but failed to process. Log for investigation.
  }

  return NextResponse.json({ received: true }, { status: 200 });
}
