/**
 * PROBATIO — Browser Supabase Client
 *
 * Creates a Supabase client for use in browser (Client Components).
 * Uses `createBrowserClient` from @supabase/ssr for cookie-based auth.
 *
 * NEVER import this file from Server Components or API routes.
 * Use `@/lib/supabase/server` or `@/lib/supabase/admin` instead.
 */

import { createBrowserClient } from "@supabase/ssr";
import type { Database } from "@/types/database";

// ────────────────────────────────────────────────────────────────────────────
// Environment Validation
// ────────────────────────────────────────────────────────────────────────────

function getSupabaseUrl(): string {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  if (!url) {
    throw new Error(
      "Missing NEXT_PUBLIC_SUPABASE_URL environment variable. " +
        "Add it to your .env.local file.",
    );
  }
  return url;
}

function getSupabaseAnonKey(): string {
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!key) {
    throw new Error(
      "Missing NEXT_PUBLIC_SUPABASE_ANON_KEY environment variable. " +
        "Add it to your .env.local file.",
    );
  }
  return key;
}

// ────────────────────────────────────────────────────────────────────────────
// Client Factory
// ────────────────────────────────────────────────────────────────────────────

/**
 * Create a typed Supabase client for browser usage.
 *
 * This client uses the anon key and relies on Row-Level Security (RLS)
 * to scope data access. Auth state is persisted in cookies via
 * `@supabase/ssr`.
 *
 * @returns A typed `SupabaseClient<Database>` for browser use.
 */
export function createClient() {
  return createBrowserClient<Database>(
    getSupabaseUrl(),
    getSupabaseAnonKey(),
  );
}
