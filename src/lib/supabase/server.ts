/**
 * PROBATIO — Server Supabase Client
 *
 * Creates a Supabase client for use in Server Components and API routes.
 * Uses `createServerClient` from @supabase/ssr with Next.js cookie handling.
 *
 * NEVER import this file from Client Components.
 * Use `@/lib/supabase/client` for browser usage.
 */

import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
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

function getSupabaseAnonKey(): string {
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!key) {
    throw new Error(
      "Missing NEXT_PUBLIC_SUPABASE_ANON_KEY environment variable.",
    );
  }
  return key;
}

// ────────────────────────────────────────────────────────────────────────────
// Server Client Factory
// ────────────────────────────────────────────────────────────────────────────

/**
 * Create a typed Supabase client for server-side usage.
 *
 * This client reads and writes auth cookies via Next.js `cookies()`.
 * It uses the anon key and respects Row-Level Security (RLS).
 *
 * Must be called within a Server Component render or a route handler —
 * the `cookies()` API requires a request context.
 *
 * @returns A typed `SupabaseClient<Database>` for server use.
 */
export async function createClient() {
  const cookieStore = await cookies();

  return createServerClient<Database>(
    getSupabaseUrl(),
    getSupabaseAnonKey(),
    {
      cookies: {
        getAll() {
          return cookieStore.getAll();
        },
        setAll(cookiesToSet) {
          try {
            for (const { name, value, options } of cookiesToSet) {
              cookieStore.set(name, value, options);
            }
          } catch {
            // `setAll` can throw when called from a Server Component
            // (as opposed to a Route Handler or Server Action).
            // This is safe to ignore — the session will be refreshed
            // on the next request via middleware.
          }
        },
      },
    },
  );
}
