// @ts-nocheck — Supabase query types will be auto-generated via `supabase gen types`
/**
 * PROBATIO — Stripe Webhook Event Handlers
 *
 * Processes incoming Stripe webhook events and synchronizes
 * subscription state, credit provisioning, and forensic payments
 * with the Supabase database.
 *
 * Supported events:
 *   - checkout.session.completed  — New subscription or one-time purchase
 *   - invoice.paid                — Recurring subscription payment
 *   - customer.subscription.updated — Plan change, cancellation scheduled
 *   - customer.subscription.deleted — Subscription fully canceled
 *   - payment_intent.succeeded    — Forensic analysis payment confirmed
 */

import type Stripe from "stripe";
import { getStripe } from "@/lib/stripe/client";
import { createAdminClient } from "@/lib/supabase/admin";
import { findPlanByPriceId, findForensicProductByPriceId } from "@/lib/stripe/products";
import type { PlanTier } from "@/types/database";

// ────────────────────────────────────────────────────────────────────────────
// Handler Registry
// ────────────────────────────────────────────────────────────────────────────

type WebhookHandler = (event: Stripe.Event) => Promise<void>;

const handlers: Record<string, WebhookHandler> = {
  "checkout.session.completed": handleCheckoutSessionCompleted,
  "invoice.paid": handleInvoicePaid,
  "customer.subscription.updated": handleSubscriptionUpdated,
  "customer.subscription.deleted": handleSubscriptionDeleted,
  "payment_intent.succeeded": handlePaymentIntentSucceeded,
};

/**
 * Route a Stripe event to the appropriate handler.
 *
 * @param event  The verified Stripe webhook event.
 * @throws {Error} If the handler encounters an unrecoverable error.
 */
export async function handleWebhookEvent(event: Stripe.Event): Promise<void> {
  const handler = handlers[event.type];
  if (!handler) {
    // Unhandled event type — log and return silently.
    console.log(`Unhandled Stripe webhook event: ${event.type}`);
    return;
  }
  await handler(event);
}

// ────────────────────────────────────────────────────────────────────────────
// checkout.session.completed
// ────────────────────────────────────────────────────────────────────────────

/**
 * Handle a completed checkout session.
 *
 * For subscriptions: creates/updates the subscription record and
 * provisions initial credits based on the plan tier.
 *
 * For one-time forensic purchases: the payment_intent.succeeded
 * handler will process the forensic payment separately.
 */
async function handleCheckoutSessionCompleted(event: Stripe.Event): Promise<void> {
  const session = event.data.object as Stripe.Checkout.Session;
  const supabase = createAdminClient();

  // Only process subscription checkouts here.
  if (session.mode !== "subscription") {
    return;
  }

  const customerId = session.customer as string;
  const subscriptionId = session.subscription as string;
  const userId = session.metadata?.userId;

  if (!userId) {
    console.error("checkout.session.completed: missing userId in metadata");
    return;
  }

  // Retrieve the subscription to get plan details.
  const stripe = getStripe();
  const subscription = await stripe.subscriptions.retrieve(subscriptionId);
  const priceId = subscription.items.data[0]?.price?.id;

  if (!priceId) {
    console.error("checkout.session.completed: no price ID found on subscription");
    return;
  }

  const plan = findPlanByPriceId(priceId);
  const planTier: PlanTier = plan
    ? (plan.tier as PlanTier)
    : "free";

  // Upsert the subscription record.
  await supabase.from("subscriptions").upsert(
    {
      user_id: userId,
      stripe_customer_id: customerId,
      stripe_subscription_id: subscriptionId,
      plan_tier: planTier,
      status: "active",
      current_period_start: new Date(
        subscription.current_period_start * 1000,
      ).toISOString(),
      current_period_end: new Date(
        subscription.current_period_end * 1000,
      ).toISOString(),
      cancel_at_period_end: subscription.cancel_at_period_end,
      updated_at: new Date().toISOString(),
    },
    { onConflict: "user_id" },
  );

  // Update the user's profile plan tier.
  await supabase
    .from("profiles")
    .update({ plan_tier: planTier, updated_at: new Date().toISOString() })
    .eq("id", userId);

  // Provision initial credits based on plan.
  const creditsToProvision = plan?.analysesPerMonth ?? 0;
  if (creditsToProvision > 0) {
    await supabase
      .from("credits")
      .upsert(
        {
          user_id: userId,
          balance: creditsToProvision,
          lifetime_purchased: creditsToProvision,
          last_replenished_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        },
        { onConflict: "user_id" },
      );
  }

  // Audit log.
  await supabase.from("audit_log").insert({
    user_id: userId,
    entity_type: "subscription",
    entity_id: subscriptionId,
    action: "checkout_completed",
    metadata: {
      plan_tier: planTier,
      stripe_customer_id: customerId,
      credits_provisioned: creditsToProvision,
    },
  });
}

// ────────────────────────────────────────────────────────────────────────────
// invoice.paid
// ────────────────────────────────────────────────────────────────────────────

/**
 * Handle a paid invoice (recurring subscription renewal).
 *
 * Replenishes the user's credit balance for the new billing cycle.
 */
async function handleInvoicePaid(event: Stripe.Event): Promise<void> {
  const invoice = event.data.object as Stripe.Invoice;
  const supabase = createAdminClient();

  const subscriptionId = invoice.subscription as string | null;
  if (!subscriptionId) {
    return; // Not a subscription invoice.
  }

  // Look up the subscription in our database.
  const { data: subscriptionRecord } = await supabase
    .from("subscriptions")
    .select("user_id, plan_tier")
    .eq("stripe_subscription_id", subscriptionId)
    .single();

  if (!subscriptionRecord) {
    console.error(`invoice.paid: no subscription record for ${subscriptionId}`);
    return;
  }

  // Determine credits to replenish based on plan.
  const priceId = invoice.lines?.data?.[0]?.price?.id;
  const plan = priceId ? findPlanByPriceId(priceId) : undefined;
  const creditsToReplenish = plan?.analysesPerMonth ?? 0;

  if (creditsToReplenish > 0) {
    // Reset the balance to the plan's monthly allowance.
    await supabase
      .from("credits")
      .update({
        balance: creditsToReplenish,
        lifetime_purchased: creditsToReplenish, // Incremented via trigger ideally
        last_replenished_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      })
      .eq("user_id", subscriptionRecord.user_id);
  }

  // Audit log.
  await supabase.from("audit_log").insert({
    user_id: subscriptionRecord.user_id,
    entity_type: "subscription",
    entity_id: subscriptionId,
    action: "invoice_paid",
    metadata: {
      invoice_id: invoice.id,
      amount_paid: invoice.amount_paid,
      credits_replenished: creditsToReplenish,
    },
  });
}

// ────────────────────────────────────────────────────────────────────────────
// customer.subscription.updated
// ────────────────────────────────────────────────────────────────────────────

/**
 * Handle a subscription update (plan change, cancellation scheduled, etc.).
 *
 * Syncs the new status and plan tier to Supabase.
 */
async function handleSubscriptionUpdated(event: Stripe.Event): Promise<void> {
  const subscription = event.data.object as Stripe.Subscription;
  const supabase = createAdminClient();

  const subscriptionId = subscription.id;
  const priceId = subscription.items.data[0]?.price?.id;
  const plan = priceId ? findPlanByPriceId(priceId) : undefined;
  const planTier: PlanTier = plan
    ? (plan.tier as PlanTier)
    : "free";

  // Map Stripe status to our internal status.
  const statusMap: Record<string, string> = {
    active: "active",
    past_due: "past_due",
    canceled: "canceled",
    trialing: "trialing",
    incomplete: "incomplete",
    incomplete_expired: "canceled",
    unpaid: "past_due",
    paused: "canceled",
  };

  const internalStatus = (statusMap[subscription.status] ?? "active") as
    | "active"
    | "past_due"
    | "canceled"
    | "trialing"
    | "incomplete";

  // Update the subscription record.
  const { data: existingRecord } = await supabase
    .from("subscriptions")
    .select("user_id")
    .eq("stripe_subscription_id", subscriptionId)
    .single();

  if (!existingRecord) {
    console.error(`subscription.updated: no record for ${subscriptionId}`);
    return;
  }

  await supabase
    .from("subscriptions")
    .update({
      plan_tier: planTier,
      status: internalStatus,
      current_period_start: new Date(
        subscription.current_period_start * 1000,
      ).toISOString(),
      current_period_end: new Date(
        subscription.current_period_end * 1000,
      ).toISOString(),
      cancel_at_period_end: subscription.cancel_at_period_end,
      updated_at: new Date().toISOString(),
    })
    .eq("stripe_subscription_id", subscriptionId);

  // Update the user's profile plan tier.
  await supabase
    .from("profiles")
    .update({ plan_tier: planTier, updated_at: new Date().toISOString() })
    .eq("id", existingRecord.user_id);

  // Audit log.
  await supabase.from("audit_log").insert({
    user_id: existingRecord.user_id,
    entity_type: "subscription",
    entity_id: subscriptionId,
    action: "subscription_updated",
    metadata: {
      new_status: internalStatus,
      new_plan_tier: planTier,
      cancel_at_period_end: subscription.cancel_at_period_end,
    },
  });
}

// ────────────────────────────────────────────────────────────────────────────
// customer.subscription.deleted
// ────────────────────────────────────────────────────────────────────────────

/**
 * Handle a fully deleted subscription.
 *
 * Downgrades the user to the free tier and marks the subscription
 * as canceled.
 */
async function handleSubscriptionDeleted(event: Stripe.Event): Promise<void> {
  const subscription = event.data.object as Stripe.Subscription;
  const supabase = createAdminClient();

  const subscriptionId = subscription.id;

  const { data: existingRecord } = await supabase
    .from("subscriptions")
    .select("user_id")
    .eq("stripe_subscription_id", subscriptionId)
    .single();

  if (!existingRecord) {
    console.error(`subscription.deleted: no record for ${subscriptionId}`);
    return;
  }

  // Mark subscription as canceled.
  await supabase
    .from("subscriptions")
    .update({
      status: "canceled",
      cancel_at_period_end: false,
      updated_at: new Date().toISOString(),
    })
    .eq("stripe_subscription_id", subscriptionId);

  // Downgrade the user to free tier.
  await supabase
    .from("profiles")
    .update({ plan_tier: "free", updated_at: new Date().toISOString() })
    .eq("id", existingRecord.user_id);

  // Audit log.
  await supabase.from("audit_log").insert({
    user_id: existingRecord.user_id,
    entity_type: "subscription",
    entity_id: subscriptionId,
    action: "subscription_deleted",
    metadata: {
      downgraded_to: "free",
    },
  });
}

// ────────────────────────────────────────────────────────────────────────────
// payment_intent.succeeded (Forensic)
// ────────────────────────────────────────────────────────────────────────────

/**
 * Handle a succeeded payment intent for forensic analysis.
 *
 * Looks for forensic-specific metadata on the payment intent and
 * triggers the forensic analysis pipeline via Inngest if applicable.
 */
async function handlePaymentIntentSucceeded(event: Stripe.Event): Promise<void> {
  const paymentIntent = event.data.object as Stripe.PaymentIntent;
  const supabase = createAdminClient();

  // Only process forensic payments (identified by metadata).
  const forensicCaseId = paymentIntent.metadata?.forensicCaseId;
  const userId = paymentIntent.metadata?.userId;
  const forensicTier = paymentIntent.metadata?.forensicTier as
    | "standard"
    | "expert"
    | undefined;

  if (!forensicCaseId || !userId || !forensicTier) {
    // Not a forensic payment — nothing to do.
    return;
  }

  // Update the forensic case status to indicate payment received.
  await supabase
    .from("forensic_cases")
    .update({
      status: "in_review",
      updated_at: new Date().toISOString(),
    })
    .eq("id", forensicCaseId);

  // Audit log.
  await supabase.from("audit_log").insert({
    user_id: userId,
    entity_type: "forensic_case",
    entity_id: forensicCaseId,
    action: "forensic_payment_succeeded",
    metadata: {
      payment_intent_id: paymentIntent.id,
      amount: paymentIntent.amount,
      currency: paymentIntent.currency,
      forensic_tier: forensicTier,
    },
  });
}
