/**
 * PROBATIO — Plan Tier Enforcement
 *
 * Utilities for checking whether a user's subscription plan permits
 * access to gated features (catalogs, forensic, etc.).
 */

import { createAdminClient } from "@/lib/supabase/admin";
import type { PlanTier } from "@/types/database";

export class PlanRequiredError extends Error {
  readonly requiredPlan: PlanTier;

  constructor(requiredPlan: PlanTier, message: string) {
    super(message);
    this.name = "PlanRequiredError";
    this.requiredPlan = requiredPlan;
  }
}

/**
 * Get the user's current plan tier. Returns 'free' if no subscription found.
 */
export async function getUserPlanTier(userId: string): Promise<PlanTier> {
  const supabase = createAdminClient();
  const { data } = await supabase
    .from("profiles")
    .select("plan_tier")
    .eq("id", userId)
    .single() as { data: { plan_tier: string } | null };

  return (data?.plan_tier as PlanTier) ?? "free";
}

/**
 * Throws PlanRequiredError if the user does not have an Enterprise plan.
 */
export async function requireEnterprisePlan(userId: string): Promise<void> {
  const tier = await getUserPlanTier(userId);
  if (tier !== "enterprise") {
    throw new PlanRequiredError(
      "enterprise",
      "Catalog management requires an Enterprise plan.",
    );
  }
}

/**
 * Get the user's organization_id from their profile.
 */
export async function getUserOrganizationId(
  userId: string,
): Promise<string | null> {
  const supabase = createAdminClient();
  const { data } = await supabase
    .from("profiles")
    .select("organization_id")
    .eq("id", userId)
    .single() as { data: { organization_id: string | null } | null };

  return data?.organization_id ?? null;
}
