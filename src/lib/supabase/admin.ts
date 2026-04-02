/**
 * PROBATIO — Service Role Supabase Client
 *
 * Creates a Supabase client with the service_role key that bypasses
 * Row-Level Security. Used exclusively in server-side contexts:
 *   - Webhook handlers (Stripe, Inngest)
 *   - Pipeline functions
 *   - Admin operations
 *
 * WARNING: NEVER import this file in client code or expose the
 * service_role key to the browser. Doing so would give full
 * database access to any user.
 */

import { createClient as createSupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/types/database";

// ────────────────────────────────────────────────────────────────────────────
// Environment Validation
// ────────────────────────────────────────────────────────────────────────────

function getSupabaseUrl(): string {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  if (!url) {
    throw new Error(
      "Missing NEXT_PUBLIC_SUPABASE_URL environment variable.",
    );
  }
  return url;
}

function getServiceRoleKey(): string {
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!key) {
    throw new Error(
      "Missing SUPABASE_SERVICE_ROLE_KEY environment variable. " +
        "This key is required for admin operations and must NEVER " +
        "be exposed to the client.",
    );
  }
  return key;
}

// ────────────────────────────────────────────────────────────────────────────
// Admin Client Factory
// ────────────────────────────────────────────────────────────────────────────

/**
 * Create a Supabase admin client that bypasses Row-Level Security.
 *
 * This client authenticates with the service_role key and has
 * unrestricted access to all tables. Use it only in trusted
 * server-side contexts (webhooks, pipeline functions, admin APIs).
 *
 * @returns A typed `SupabaseClient<Database>` with service_role privileges.
 */
export function createAdminClient() {
  return createSupabaseClient<Database>(
    getSupabaseUrl(),
    getServiceRoleKey(),
    {
      auth: {
        autoRefreshToken: false,
        persistSession: false,
      },
    },
  );
}
