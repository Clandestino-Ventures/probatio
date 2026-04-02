// @ts-nocheck — Supabase query types will be auto-generated via `supabase gen types`
/**
 * PROBATIO — Auth Store (Zustand)
 *
 * Manages user session state, profile data, and authentication actions.
 * Uses Supabase Auth via the browser client from `@/lib/supabase/client`.
 *
 * This store is intended for Client Components only.
 */

import { create } from "zustand";
import { createClient } from "@/lib/supabase/client";
import type { User, Session, AuthError } from "@supabase/supabase-js";
import type { ProfileRow, PlanTier } from "@/types/database";

// ────────────────────────────────────────────────────────────────────────────
// State & Actions
// ────────────────────────────────────────────────────────────────────────────

export interface AuthState {
  user: User | null;
  session: Session | null;
  profile: ProfileRow | null;
  creditBalance: number;
  planTier: PlanTier;
  loading: boolean;
  initialized: boolean;
  error: string | null;
}

export interface AuthActions {
  initialize: () => Promise<void>;
  signIn: (email: string, password: string) => Promise<{ error: AuthError | null }>;
  signUp: (
    email: string,
    password: string,
    metadata?: { fullName?: string; organization?: string; preferredLang?: string },
  ) => Promise<{ error: AuthError | null }>;
  signInWithOAuth: (provider: "google" | "github") => Promise<{ error: AuthError | null }>;
  signOut: () => Promise<void>;
  refreshSession: () => Promise<void>;
  fetchProfile: () => Promise<void>;
  clearError: () => void;
}

export type AuthStore = AuthState & AuthActions;

// ────────────────────────────────────────────────────────────────────────────
// Store Implementation
// ────────────────────────────────────────────────────────────────────────────

const initialState: AuthState = {
  user: null,
  session: null,
  profile: null,
  creditBalance: 0,
  planTier: "free",
  loading: false,
  initialized: false,
  error: null,
};

export const useAuthStore = create<AuthStore>()((set, get) => {
  const supabase = createClient();

  // Listen for auth state changes and keep store in sync.
  supabase.auth.onAuthStateChange((_event, session) => {
    set({
      user: session?.user ?? null,
      session,
    });

    // Auto-fetch profile when session becomes available.
    if (session?.user && !get().profile) {
      get().fetchProfile();
    }

    // Clear profile on sign-out.
    if (!session) {
      set({ profile: null, creditBalance: 0, planTier: "free" });
    }
  });

  return {
    ...initialState,

    // ── Initialize ──────────────────────────────────────────────────────
    initialize: async () => {
      if (get().initialized) return;

      set({ loading: true, error: null });

      try {
        // Use getUser() — validates JWT server-side, refreshes if expired.
        // getSession() only reads from cache and can return stale tokens.
        const {
          data: { user },
          error,
        } = await supabase.auth.getUser();

        if (error || !user) {
          set({ user: null, session: null, loading: false, initialized: true });
          return;
        }

        // Get the session too (for session object)
        const { data: { session } } = await supabase.auth.getSession();

        set({
          user,
          session,
          loading: false,
          initialized: true,
        });

        // Fetch profile + credits in parallel
        await get().fetchProfile();
      } catch (err) {
        console.error("[PROBATIO] Auth initialize failed:", err);
        set({
          error: err instanceof Error ? err.message : "Failed to initialize session",
          loading: false,
          initialized: true,
        });
      }
    },

    // ── Sign In ─────────────────────────────────────────────────────────
    signIn: async (email, password) => {
      set({ loading: true, error: null });

      const { data, error } = await supabase.auth.signInWithPassword({
        email,
        password,
      });

      if (error) {
        set({ error: error.message, loading: false });
        return { error };
      }

      set({
        user: data.user,
        session: data.session,
        loading: false,
      });

      await get().fetchProfile();
      return { error: null };
    },

    // ── Sign Up ─────────────────────────────────────────────────────────
    signUp: async (email, password, metadata) => {
      set({ loading: true, error: null });

      const { data, error } = await supabase.auth.signUp({
        email,
        password,
        options: {
          data: {
            display_name: metadata?.fullName ?? null,
            organization: metadata?.organization ?? null,
          },
        },
      });

      if (error) {
        set({ error: error.message, loading: false });
        return { error };
      }

      set({
        user: data.user,
        session: data.session,
        loading: false,
      });

      return { error: null };
    },

    // ── OAuth Sign In ───────────────────────────────────────────────────
    signInWithOAuth: async (provider) => {
      set({ loading: true, error: null });

      const { error } = await supabase.auth.signInWithOAuth({
        provider,
        options: {
          redirectTo: `${window.location.origin}/auth/callback`,
        },
      });

      if (error) {
        set({ error: error.message, loading: false });
        return { error };
      }

      return { error: null };
    },

    // ── Sign Out ────────────────────────────────────────────────────────
    signOut: async () => {
      set({ loading: true, error: null });

      const { error } = await supabase.auth.signOut();

      if (error) {
        set({ error: error.message, loading: false });
        return;
      }

      set({
        ...initialState,
        initialized: true, // Don't re-initialize after signout
      });
    },

    // ── Refresh Session ─────────────────────────────────────────────────
    refreshSession: async () => {
      const {
        data: { session },
        error,
      } = await supabase.auth.refreshSession();

      if (error) {
        set({ error: error.message });
        return;
      }

      set({
        user: session?.user ?? null,
        session,
      });
    },

    // ── Fetch Profile + Credits ─────────────────────────────────────────
    fetchProfile: async () => {
      const user = get().user;
      if (!user) return;

      try {
        // Fetch profile and credits in parallel
        const [profileResult, creditsResult] = await Promise.all([
          supabase
            .from("profiles")
            .select("*")
            .eq("id", user.id)
            .single(),
          supabase
            .from("credits")
            .select("*")
            .eq("user_id", user.id)
            .single(),
        ]);

        // Handle profile result
        if (profileResult.error) {
          // PGRST116 = row not found (new user, trigger hasn't fired yet)
          if (profileResult.error.code !== "PGRST116") {
            console.error("[PROBATIO] fetchProfile failed:", profileResult.error.message);
          }
        } else {
          set({ profile: profileResult.data as ProfileRow });
        }

        // Handle credits result — read plan_tier from BOTH tables, use most permissive
        const TIER_ORDER: PlanTier[] = ["free", "starter", "professional", "enterprise"];
        let resolvedPlanTier: PlanTier = "free";

        const profilePlanTier = (profileResult.data?.plan_tier as PlanTier) || "free";
        resolvedPlanTier = profilePlanTier;

        if (!creditsResult.error && creditsResult.data) {
          const credit = creditsResult.data;
          const creditPlanTier = (credit.plan_tier as PlanTier) || "free";
          // Use whichever tier is higher
          if (TIER_ORDER.indexOf(creditPlanTier) > TIER_ORDER.indexOf(resolvedPlanTier)) {
            resolvedPlanTier = creditPlanTier;
          }
          set({
            creditBalance: credit.balance ?? 0,
            planTier: resolvedPlanTier,
          });
        } else {
          if (creditsResult.error && creditsResult.error.code !== "PGRST116") {
            console.error("[PROBATIO] fetchCredits failed:", creditsResult.error?.message);
          }
          set({ planTier: resolvedPlanTier });
        }
      } catch (err) {
        console.error("[PROBATIO] fetchProfile/credits error:", err);
      }
    },

    // ── Clear Error ─────────────────────────────────────────────────────
    clearError: () => {
      set({ error: null });
    },
  };
});

// ────────────────────────────────────────────────────────────────────────────
// Derived Selectors (reactive — recompute on every state change)
// ────────────────────────────────────────────────────────────────────────────

/** Hook: get first name from display_name. */
export function useFirstName(): string | null {
  return useAuthStore((s) => {
    const name = s.profile?.display_name;
    return name ? name.split(" ")[0] : null;
  });
}

/** Hook: can the user access forensic features? */
export function useCanAccessForensic(): boolean {
  return useAuthStore((s) => {
    const tier = s.planTier;
    const role = s.profile?.role;
    return tier === "professional" || tier === "enterprise" || role === "admin";
  });
}

/** Hook: is the user an admin? */
export function useIsAdmin(): boolean {
  return useAuthStore((s) => s.profile?.role === "admin");
}
