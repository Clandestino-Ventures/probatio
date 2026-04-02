// @ts-nocheck
/**
 * PROBATIO — Batch Hash Verification
 * POST /api/verify/batch
 * Public — no auth required. Max 50 hashes per request.
 */

import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { rateLimit } from "@/lib/rate-limit";

export async function POST(request: NextRequest) {
  const ip = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "unknown";

  const { success: rateLimitOk, resetIn } = rateLimit(`verify-batch:${ip}`, 10, 60_000);
  if (!rateLimitOk) {
    return NextResponse.json(
      { error: "Rate limit exceeded. Maximum 10 batch verifications per minute." },
      { status: 429, headers: { "Retry-After": String(Math.ceil(resetIn / 1000)) } }
    );
  }

  const body = await request.json();
  const hashes: string[] = body.hashes;

  if (!Array.isArray(hashes) || hashes.length === 0) {
    return NextResponse.json({ error: "hashes array required" }, { status: 400 });
  }

  if (hashes.length > 50) {
    return NextResponse.json({ error: "Maximum 50 hashes per batch" }, { status: 400 });
  }

  const supabase = createAdminClient();
  const results: Array<{ hash: string; valid: boolean; hashType?: string; action?: string }> = [];

  for (const hash of hashes) {
    const normalized = hash.toLowerCase().trim();

    if (!/^[0-9a-f]{64}$/.test(normalized)) {
      results.push({ hash: normalized, valid: false });
      continue;
    }

    // Check audit_log entry_hash
    const { data: entry } = await supabase
      .from("audit_log")
      .select("action, entry_hash")
      .eq("entry_hash", normalized)
      .limit(1)
      .maybeSingle();

    if (entry) {
      results.push({ hash: normalized, valid: true, hashType: "chain_entry", action: entry.action });
      continue;
    }

    // Check hash_after
    const { data: artifact } = await supabase
      .from("audit_log")
      .select("action")
      .eq("hash_after", normalized)
      .limit(1)
      .maybeSingle();

    if (artifact) {
      results.push({ hash: normalized, valid: true, hashType: "artifact", action: artifact.action });
      continue;
    }

    // Check analyses
    const { data: analysis } = await supabase
      .from("analyses")
      .select("id")
      .or(`output_hash.eq.${normalized},file_hash.eq.${normalized}`)
      .limit(1)
      .maybeSingle();

    if (analysis) {
      results.push({ hash: normalized, valid: true, hashType: "analysis" });
      continue;
    }

    results.push({ hash: normalized, valid: false });
  }

  const validCount = results.filter((r) => r.valid).length;

  return NextResponse.json({
    results,
    summary: {
      total: results.length,
      valid: validCount,
      invalid: results.length - validCount,
    },
  }, {
    headers: { "Access-Control-Allow-Origin": "*" },
  });
}
