// @ts-nocheck — Supabase query types will be auto-generated via `supabase gen types`
/**
 * PROBATIO — Auth Event Audit Logger
 *
 * Logs authentication events to the `auth_events` table for security
 * monitoring and compliance. This is separate from the forensic
 * chain_of_custody to avoid contaminating evidence hash chains.
 *
 * Server-side only — uses the service role client to bypass RLS.
 * The IP address is hashed with SHA-256 before storage (never raw).
 */

import { createAdminClient } from "@/lib/supabase/admin";
import type { AuthEventType } from "@/types/database";

// ────────────────────────────────────────────────────────────────────────────
// SHA-256 Hashing (server-side, Node.js crypto)
// ────────────────────────────────────────────────────────────────────────────

async function hashString(input: string): Promise<string> {
  const { createHash } = await import("node:crypto");
  return createHash("sha256").update(input).digest("hex");
}

// ────────────────────────────────────────────────────────────────────────────
// Public API
// ────────────────────────────────────────────────────────────────────────────

interface LogAuthEventParams {
  userId: string | null;
  event: AuthEventType;
  ip?: string | null;
  userAgent?: string | null;
  detail?: Record<string, unknown>;
}

/**
 * Log an authentication event to the `auth_events` table.
 *
 * - IP address is SHA-256 hashed before storage (privacy-first).
 * - User agent is truncated to 256 characters.
 * - Uses the service role client (bypasses RLS) because auth events
 *   are logged before the user's session is fully established.
 *
 * Failures are logged to console but never thrown — auth event
 * logging must not break the auth flow itself.
 */
export async function logAuthEvent({
  userId,
  event,
  ip,
  userAgent,
  detail = {},
}: LogAuthEventParams): Promise<void> {
  try {
    const supabase = createAdminClient();

    const ipHash = ip ? await hashString(ip) : null;
    const truncatedUserAgent = userAgent
      ? userAgent.substring(0, 256)
      : null;

    await supabase.from("auth_events").insert({
      user_id: userId,
      event,
      ip_hash: ipHash,
      user_agent: truncatedUserAgent,
      detail: {
        ...detail,
        timestamp: new Date().toISOString(),
      },
    });
  } catch (error) {
    // Auth event logging must never break the auth flow.
    // Log to console for server-side monitoring (Sentry will pick this up).
    console.error("[PROBATIO] Failed to log auth event:", event, error);
  }
}

/**
 * Extract client IP from request headers.
 * Handles Vercel's x-forwarded-for and x-real-ip headers.
 */
export function getClientIp(headers: Headers): string | null {
  return (
    headers.get("x-forwarded-for")?.split(",")[0]?.trim() ||
    headers.get("x-real-ip") ||
    null
  );
}
