/**
 * PROBATIO — Stripe Product & Price Configuration
 *
 * Maps internal plan tiers to Stripe price IDs and defines
 * billing parameters for subscriptions and one-time forensic purchases.
 *
 * Price IDs are read from environment variables so they can differ
 * between development (test mode) and production (live mode).
 */

// ────────────────────────────────────────────────────────────────────────────
// Subscription Plans
// ────────────────────────────────────────────────────────────────────────────

export interface SubscriptionPlan {
  /** Internal plan identifier. */
  tier: "starter" | "professional" | "enterprise";
  /** Display name. */
  name: string;
  /** Monthly price in USD. */
  priceMonthly: number;
  /** Number of analyses included per month. */
  analysesPerMonth: number | null;
  /** Stripe Price ID for monthly billing (from env). */
  stripePriceIdMonthly: string;
  /** Stripe Price ID for annual billing (from env, if available). */
  stripePriceIdAnnual: string | null;
  /** Feature highlights for display. */
  features: readonly string[];
}

function envOrThrow(name: string): string {
  const value = process.env[name];
  if (!value) {
    throw new Error(`Missing environment variable: ${name}`);
  }
  return value;
}

function envOrNull(name: string): string | null {
  return process.env[name] ?? null;
}

/**
 * Subscription plan definitions.
 *
 * - **Starter**:       $149/mo, 50 analyses
 * - **Professional**:  $499/mo, 200 analyses
 * - **Enterprise**:    $1,499/mo, unlimited analyses
 */
export function getSubscriptionPlans(): readonly SubscriptionPlan[] {
  return [
    {
      tier: "starter",
      name: "Starter",
      priceMonthly: 149,
      analysesPerMonth: 50,
      stripePriceIdMonthly: envOrThrow("STRIPE_PRICE_STARTER_MONTHLY"),
      stripePriceIdAnnual: envOrNull("STRIPE_PRICE_STARTER_ANNUAL"),
      features: [
        "50 analyses per month",
        "Standard & deep analysis modes",
        "Email support",
        "API access",
        "CSV/PDF export",
      ],
    },
    {
      tier: "professional",
      name: "Professional",
      priceMonthly: 499,
      analysesPerMonth: 200,
      stripePriceIdMonthly: envOrThrow("STRIPE_PRICE_PROFESSIONAL_MONTHLY"),
      stripePriceIdAnnual: envOrNull("STRIPE_PRICE_PROFESSIONAL_ANNUAL"),
      features: [
        "200 analyses per month",
        "All analysis modes including forensic",
        "Priority processing queue",
        "Dedicated support",
        "API access with higher rate limits",
        "Team collaboration (up to 5 seats)",
        "Custom report branding",
      ],
    },
    {
      tier: "enterprise",
      name: "Enterprise",
      priceMonthly: 1499,
      analysesPerMonth: null, // unlimited
      stripePriceIdMonthly: envOrThrow("STRIPE_PRICE_ENTERPRISE_MONTHLY"),
      stripePriceIdAnnual: envOrNull("STRIPE_PRICE_ENTERPRISE_ANNUAL"),
      features: [
        "Unlimited analyses",
        "All analysis modes",
        "Dedicated GPU allocation",
        "24/7 priority support & SLA",
        "Custom API integration",
        "Unlimited team seats",
        "Custom model training",
        "White-label available",
        "On-premise deployment option",
      ],
    },
  ] as const;
}

// ────────────────────────────────────────────────────────────────────────────
// Forensic Products (One-Time Purchase)
// ────────────────────────────────────────────────────────────────────────────

export interface ForensicProduct {
  /** Internal tier identifier. */
  tier: "standard" | "expert";
  /** Display name. */
  name: string;
  /** Price in USD. */
  price: number;
  /** Price in cents (for Stripe). */
  priceCents: number;
  /** Stripe Price ID (from env). */
  stripePriceId: string;
  /** What is included in this tier. */
  includes: readonly string[];
}

/**
 * Forensic analysis product tiers.
 *
 * - **Forensic Standard**: $5,000 — Automated forensic comparison + report
 * - **Forensic Expert**:   $15,000 — Full expert review + court-ready package
 */
export function getForensicProducts(): readonly ForensicProduct[] {
  return [
    {
      tier: "standard",
      name: "Forensic Standard",
      price: 5_000,
      priceCents: 500_000,
      stripePriceId: envOrThrow("STRIPE_PRICE_FORENSIC_STANDARD"),
      includes: [
        "Automated 1v1 forensic comparison",
        "DTW analysis across all dimensions",
        "Statistical significance testing",
        "PDF forensic report",
        "Chain of custody documentation",
        "Evidence package (digital)",
      ],
    },
    {
      tier: "expert",
      name: "Forensic Expert",
      price: 15_000,
      priceCents: 1_500_000,
      stripePriceId: envOrThrow("STRIPE_PRICE_FORENSIC_EXPERT"),
      includes: [
        "Everything in Forensic Standard",
        "Assigned expert musicologist review",
        "Expert annotations and opinion",
        "Court-ready evidence package",
        "Expert witness availability",
        "Deposition preparation support",
        "Physical evidence binder (shipped)",
      ],
    },
  ] as const;
}

// ────────────────────────────────────────────────────────────────────────────
// Lookup Helpers
// ────────────────────────────────────────────────────────────────────────────

/**
 * Find a subscription plan by its Stripe Price ID.
 *
 * @param priceId  The Stripe Price ID to look up.
 * @returns The matching plan, or `undefined` if not found.
 */
export function findPlanByPriceId(priceId: string): SubscriptionPlan | undefined {
  return getSubscriptionPlans().find(
    (plan) =>
      plan.stripePriceIdMonthly === priceId ||
      plan.stripePriceIdAnnual === priceId,
  );
}

/**
 * Find a forensic product by its Stripe Price ID.
 *
 * @param priceId  The Stripe Price ID to look up.
 * @returns The matching forensic product, or `undefined` if not found.
 */
export function findForensicProductByPriceId(priceId: string): ForensicProduct | undefined {
  return getForensicProducts().find((product) => product.stripePriceId === priceId);
}
