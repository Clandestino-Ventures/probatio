/**
 * PROBATIO — Stripe Client
 *
 * Shared Stripe instance for server-side usage.
 * Used by checkout handlers, webhook processors, and billing APIs.
 *
 * NEVER import this file in client code — the secret key must
 * remain server-side only.
 */

import Stripe from "stripe";

// ────────────────────────────────────────────────────────────────────────────
// Environment Validation
// ────────────────────────────────────────────────────────────────────────────

function getStripeSecretKey(): string {
  const key = process.env.STRIPE_SECRET_KEY;
  if (!key) {
    throw new Error(
      "Missing STRIPE_SECRET_KEY environment variable. " +
        "Add it to your .env.local file.",
    );
  }
  return key;
}

// ────────────────────────────────────────────────────────────────────────────
// Stripe Instance
// ────────────────────────────────────────────────────────────────────────────

/**
 * Lazily-initialized Stripe instance.
 *
 * We use a getter so the environment variable is only read when first
 * accessed, which avoids build-time errors when the env var is absent
 * (e.g. during `next build` in CI without secrets).
 */
let stripeInstance: Stripe | null = null;

export function getStripe(): Stripe {
  if (!stripeInstance) {
    stripeInstance = new Stripe(getStripeSecretKey(), {
      apiVersion: "2026-02-25.clover",
      typescript: true,
    });
  }
  return stripeInstance;
}

/**
 * Get the Stripe webhook signing secret for verifying webhook payloads.
 *
 * @returns The webhook signing secret string.
 * @throws {Error} If STRIPE_WEBHOOK_SECRET is not set.
 */
export function getWebhookSecret(): string {
  const secret = process.env.STRIPE_WEBHOOK_SECRET;
  if (!secret) {
    throw new Error(
      "Missing STRIPE_WEBHOOK_SECRET environment variable. " +
        "Add it to your .env.local file.",
    );
  }
  return secret;
}
