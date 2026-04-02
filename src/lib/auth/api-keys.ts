/**
 * PROBATIO — API Key Generation + Authentication Middleware
 *
 * Key format: pk_live_ + 40 random hex chars (total 48 chars)
 * Storage: SHA-256 hash only — plaintext NEVER stored
 * Prefix: first 12 chars (pk_live_a7f3) stored for display
 *
 * Auth flow:
 *   1. Extract Bearer token from Authorization header
 *   2. SHA-256 hash the token
 *   3. Look up hash in api_keys table
 *   4. Validate: active, not expired, not revoked
 *   5. Update last_used_at + total_requests
 *   6. Return org context + permissions
 */

import { createHash, randomBytes } from "crypto";
import { createAdminClient } from "@/lib/supabase/admin";
import { rateLimit } from "@/lib/rate-limit";
import type { ApiKeyPermission } from "@/types/database";

// ────────────────────────────────────────────────────────────────
// Types
// ────────────────────────────────────────────────────────────────

export interface ApiKeyContext {
  organizationId: string;
  keyId: string;
  keyName: string;
  permissions: ApiKeyPermission[];
  rateLimitPerMinute: number;
  rateLimitPerDay: number;
}

export type AuthResult =
  | { type: "session"; userId: string }
  | { type: "api_key"; apiKey: ApiKeyContext };

// ────────────────────────────────────────────────────────────────
// Key Generation
// ────────────────────────────────────────────────────────────────

const KEY_PREFIX = "pk_live_";

/**
 * Generate a new API key. Returns both the full plaintext key
 * (shown to user ONCE) and the hash + prefix for storage.
 */
export function generateApiKey(): {
  fullKey: string;
  keyHash: string;
  keyPrefix: string;
} {
  const randomPart = randomBytes(20).toString("hex"); // 40 hex chars
  const fullKey = KEY_PREFIX + randomPart;
  const keyHash = hashApiKey(fullKey);
  const keyPrefix = fullKey.slice(0, 12); // pk_live_a7f3

  return { fullKey, keyHash, keyPrefix };
}

/**
 * SHA-256 hash an API key for storage/lookup.
 */
export function hashApiKey(key: string): string {
  return createHash("sha256").update(key).digest("hex");
}

// ────────────────────────────────────────────────────────────────
// Authentication
// ────────────────────────────────────────────────────────────────

/**
 * Authenticate an API key from a request's Authorization header.
 * Returns null if no valid API key is present (not an error — the
 * caller should fall back to session auth).
 *
 * Returns ApiKeyContext if valid.
 * Throws Error with message if key is present but invalid/revoked/expired.
 */
export async function authenticateApiKey(
  request: Request,
): Promise<ApiKeyContext | null> {
  const authHeader = request.headers.get("authorization");
  if (!authHeader) return null;

  const match = authHeader.match(/^Bearer\s+(pk_live_[a-f0-9]{40})$/i);
  if (!match) return null;

  const token = match[1];
  const tokenHash = hashApiKey(token);

  const supabase = createAdminClient();

  // Look up by hash
  const { data: key } = await supabase
    .from("api_keys")
    .select("*")
    .eq("key_hash", tokenHash)
    .single() as { data: {
      id: string;
      organization_id: string;
      name: string;
      permissions: string[];
      rate_limit_per_minute: number;
      rate_limit_per_day: number;
      is_active: boolean;
      expires_at: string | null;
      revoked_at: string | null;
      total_requests: number;
    } | null };

  if (!key) {
    throw new Error("Invalid API key.");
  }

  if (!key.is_active) {
    throw new Error("API key is deactivated.");
  }

  if (key.revoked_at) {
    throw new Error("API key has been revoked.");
  }

  if (key.expires_at && new Date(key.expires_at) < new Date()) {
    throw new Error("API key has expired.");
  }

  // Rate limiting per key
  const { success: minuteOk } = rateLimit(
    `apikey:min:${key.id}`,
    key.rate_limit_per_minute,
    60_000,
  );
  if (!minuteOk) {
    throw new Error("API key rate limit exceeded (per-minute).");
  }

  const { success: dayOk } = rateLimit(
    `apikey:day:${key.id}`,
    key.rate_limit_per_day,
    86_400_000,
  );
  if (!dayOk) {
    throw new Error("API key rate limit exceeded (per-day).");
  }

  // Update usage stats (fire-and-forget)
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  (supabase.from("api_keys") as any)
    .update({
      last_used_at: new Date().toISOString(),
      total_requests: key.total_requests + 1,
    })
    .eq("id", key.id)
    .then(() => {});

  return {
    organizationId: key.organization_id,
    keyId: key.id,
    keyName: key.name,
    permissions: key.permissions as ApiKeyPermission[],
    rateLimitPerMinute: key.rate_limit_per_minute,
    rateLimitPerDay: key.rate_limit_per_day,
  };
}

/**
 * Dual auth: try API key first, then session.
 * Returns the auth context or null if neither works.
 */
export async function authenticateDual(
  request: Request,
): Promise<AuthResult | null> {
  // Try API key first
  try {
    const apiKeyCtx = await authenticateApiKey(request);
    if (apiKeyCtx) {
      return { type: "api_key", apiKey: apiKeyCtx };
    }
  } catch (err) {
    // API key was present but invalid — don't fall back to session
    throw err;
  }

  // Fall back to session auth
  const { createClient } = await import("@/lib/supabase/server");
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (user) {
    return { type: "session", userId: user.id };
  }

  return null;
}

/**
 * Check if an API key has a specific permission.
 */
export function hasPermission(
  ctx: ApiKeyContext,
  permission: ApiKeyPermission,
): boolean {
  return ctx.permissions.includes(permission) || ctx.permissions.includes("admin");
}
