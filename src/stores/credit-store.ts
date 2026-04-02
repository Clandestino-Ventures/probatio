// @ts-nocheck — Supabase query types will be auto-generated via `supabase gen types`
/**
 * PROBATIO — Credit Store (Zustand)
 *
 * Manages credit balance, plan tier, and credit-related actions.
 * Uses the Supabase browser client from `@/lib/supabase/client`.
 *
 * This store is intended for Client Components only.
 */

import { create } from "zustand";
import { createClient } from "@/lib/supabase/client";
import type { CreditRow, PlanTier } from "@/types/database";
import { CREDIT_COSTS, PLANS } from "@/lib/constants";
import type { AnalysisMode } from "@/types/database";

// ────────────────────────────────────────────────────────────────────────────
// State & Actions
// ────────────────────────────────────────────────────────────────────────────

export interface CreditState {
  /** Current credit balance. */
  balance: number;
  /** Lifetime credits purchased. */
  lifetimePurchased: number;
  /** Lifetime credits used. */
  lifetimeUsed: number;
  /** Current plan tier. */
  planTier: PlanTier;
  /** Monthly credit allowance for the current plan (null = unlimited or pay-as-you-go). */
  monthlyAllowance: number | null;
  /** When credits were last replenished. */
  lastReplenishedAt: string | null;
  /** Whether a credit fetch is in progress. */
  loading: boolean;
  /** Whether the credit data has been loaded at least once. */
  initialized: boolean;
  /** The most recent error message, or null. */
  error: string | null;
}

export interface CreditActions {
  /**
   * Fetch the current user's credit balance and plan information.
   */
  fetchCredits: () => Promise<void>;

  /**
   * Check whether the user has enough credits for a given analysis mode.
   *
   * @param mode  The analysis mode to check against.
   * @returns `true` if the balance is sufficient, `false` otherwise.
   */
  checkBalance: (mode: AnalysisMode) => boolean;

  /**
   * Get the credit cost for a given analysis mode.
   *
   * @param mode  The analysis mode.
   * @returns The number of credits required.
   */
  getCost: (mode: AnalysisMode) => number;

  /**
   * Optimistically deduct credits after an analysis is started.
   * The server is the source of truth; this provides immediate UI feedback.
   *
   * @param mode  The analysis mode that was started.
   */
  deductCredits: (mode: AnalysisMode) => void;

  /**
   * Clear any stored error.
   */
  clearError: () => void;

  /**
   * Reset the store to its initial state.
   */
  reset: () => void;
}

export type CreditStore = CreditState & CreditActions;

// ────────────────────────────────────────────────────────────────────────────
// Store Implementation
// ────────────────────────────────────────────────────────────────────────────

const initialState: CreditState = {
  balance: 0,
  lifetimePurchased: 0,
  lifetimeUsed: 0,
  planTier: "free",
  monthlyAllowance: null,
  lastReplenishedAt: null,
  loading: false,
  initialized: false,
  error: null,
};

export const useCreditStore = create<CreditStore>()((set, get) => {
  const supabase = createClient();

  return {
    ...initialState,

    // ── Fetch Credits ───────────────────────────────────────────────────
    fetchCredits: async () => {
      set({ loading: true, error: null });

      try {
        // Get current user.
        const {
          data: { user },
          error: authError,
        } = await supabase.auth.getUser();

        if (authError || !user) {
          set({
            error: authError?.message ?? "Not authenticated",
            loading: false,
          });
          return;
        }

        // Fetch credit balance.
        const { data: creditData, error: creditError } = await supabase
          .from("credits")
          .select("*")
          .eq("user_id", user.id)
          .single();

        if (creditError) {
          // Credit row might not exist yet for new users.
          if (creditError.code === "PGRST116") {
            set({
              balance: 0,
              lifetimePurchased: 0,
              lifetimeUsed: 0,
              loading: false,
              initialized: true,
            });
            return;
          }
          set({ error: creditError.message, loading: false });
          return;
        }

        const credit = creditData as CreditRow;

        // Fetch plan tier from profile.
        const { data: profileData, error: profileError } = await supabase
          .from("profiles")
          .select("plan_tier")
          .eq("id", user.id)
          .single();

        const planTier: PlanTier =
          profileError || !profileData
            ? "free"
            : (profileData.plan_tier as PlanTier);

        const plan = PLANS[planTier];
        const monthlyAllowance =
          plan.creditsPerMonth > 0 ? plan.creditsPerMonth : null;

        set({
          balance: credit.balance,
          lifetimePurchased: credit.lifetime_purchased,
          lifetimeUsed: credit.lifetime_used,
          lastReplenishedAt: credit.last_replenished_at,
          planTier,
          monthlyAllowance,
          loading: false,
          initialized: true,
        });
      } catch (err) {
        set({
          error: err instanceof Error ? err.message : "Failed to fetch credits",
          loading: false,
        });
      }
    },

    // ── Check Balance ───────────────────────────────────────────────────
    checkBalance: (mode) => {
      const { balance } = get();
      const cost = CREDIT_COSTS[mode];
      return balance >= cost;
    },

    // ── Get Cost ────────────────────────────────────────────────────────
    getCost: (mode) => {
      return CREDIT_COSTS[mode];
    },

    // ── Deduct Credits (Optimistic) ─────────────────────────────────────
    deductCredits: (mode) => {
      const cost = CREDIT_COSTS[mode];
      set((state) => ({
        balance: Math.max(0, state.balance - cost),
        lifetimeUsed: state.lifetimeUsed + cost,
      }));
    },

    // ── Clear Error ─────────────────────────────────────────────────────
    clearError: () => {
      set({ error: null });
    },

    // ── Reset ───────────────────────────────────────────────────────────
    reset: () => {
      set(initialState);
    },
  };
});
