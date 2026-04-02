// @ts-nocheck — Supabase query types will be auto-generated
/**
 * PROBATIO — Public Hash Verification
 * GET /api/verify/hash/[hash]
 *
 * Public endpoint — no authentication required.
 * Verifies if a SHA-256 hash exists in any Probatio chain of custody.
 */

import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { rateLimit } from "@/lib/rate-limit";

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ hash: string }> }
) {
  const { hash } = await params;
  const ip = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "unknown";

  // Rate limit: 30 per minute per IP
  const { success: rateLimitOk, resetIn } = rateLimit(`verify:${ip}`, 30, 60_000);
  if (!rateLimitOk) {
    return NextResponse.json(
      { error: "Rate limit exceeded. Maximum 30 verifications per minute." },
      { status: 429, headers: { "Retry-After": String(Math.ceil(resetIn / 1000)) } }
    );
  }

  // Validate hash format
  if (!hash || !/^[0-9a-f]{64}$/i.test(hash.toLowerCase())) {
    return NextResponse.json(
      { valid: false, error: "Invalid hash format. Expected 64-character hex SHA-256." },
      { status: 400 }
    );
  }

  const normalizedHash = hash.toLowerCase();

  // Anti-enumeration: normalize timing
  const startTime = Date.now();

  const supabase = createAdminClient();

  // Check audit_log entry_hash
  const { data: entryByHash } = await supabase
    .from("audit_log")
    .select("entity_type, entity_id, action, entry_hash, previous_log_hash, hash_before, hash_after, created_at")
    .eq("entry_hash", normalizedHash)
    .limit(1)
    .maybeSingle();

  // Check audit_log hash_after (artifact hash)
  const { data: entryByArtifact } = !entryByHash
    ? await supabase
        .from("audit_log")
        .select("entity_type, entity_id, action, entry_hash, hash_after, created_at")
        .eq("hash_after", normalizedHash)
        .limit(1)
        .maybeSingle()
    : { data: null };

  // Check analyses.final_hash
  let analysisMatch = null;
  if (!entryByHash && !entryByArtifact) {
    const { data } = await supabase
      .from("analyses")
      .select("id, status, pipeline_version, created_at, completed_at")
      .eq("output_hash", normalizedHash)
      .limit(1)
      .maybeSingle();
    analysisMatch = data;
  }

  // Also check file_hash
  if (!entryByHash && !entryByArtifact && !analysisMatch) {
    const { data } = await supabase
      .from("analyses")
      .select("id, status, pipeline_version, created_at, completed_at")
      .eq("file_hash", normalizedHash)
      .limit(1)
      .maybeSingle();
    analysisMatch = data;
  }

  // Normalize timing to prevent side-channel
  const elapsed = Date.now() - startTime;
  if (elapsed < 100) {
    await new Promise((r) => setTimeout(r, 100 - elapsed + Math.random() * 50));
  }

  const entry = entryByHash || entryByArtifact;
  const hashType = entryByHash ? "chain_entry" : entryByArtifact ? "artifact" : analysisMatch ? "analysis" : null;

  // Not found
  if (!entry && !analysisMatch) {
    return NextResponse.json({
      valid: false,
      hash: normalizedHash,
      message: "This hash was not found in any Probatio chain of custody.",
    }, {
      headers: {
        "Cache-Control": "public, max-age=60",
        "Access-Control-Allow-Origin": "*",
      },
    });
  }

  // Found in audit_log
  if (entry) {
    // Count total entries in this entity's chain
    const { count: totalEntries } = await supabase
      .from("audit_log")
      .select("*", { count: "exact", head: true })
      .eq("entity_type", entry.entity_type)
      .eq("entity_id", entry.entity_id);

    return NextResponse.json({
      valid: true,
      hash: normalizedHash,
      hashType,
      entity: {
        type: entry.entity_type,
        idPrefix: entry.entity_id.substring(0, 8),
      },
      chainEntry: {
        action: entry.action,
        recordedAt: entry.created_at,
        hasArtifact: !!entry.hash_after,
      },
      chainIntegrity: {
        totalEntries: totalEntries ?? 0,
      },
      probatioVerification: {
        verifiedAt: new Date().toISOString(),
        verificationUrl: `${process.env.NEXT_PUBLIC_APP_URL || "https://probatio.audio"}/verify?hash=${normalizedHash}`,
      },
    }, {
      headers: {
        "Cache-Control": "public, max-age=3600",
        "Access-Control-Allow-Origin": "*",
      },
    });
  }

  // Found as analysis hash
  if (analysisMatch) {
    return NextResponse.json({
      valid: true,
      hash: normalizedHash,
      hashType: "analysis",
      entity: {
        type: "analysis",
        idPrefix: analysisMatch.id.substring(0, 8),
      },
      analysis: {
        status: analysisMatch.status,
        pipelineVersion: analysisMatch.pipeline_version,
        completedAt: analysisMatch.completed_at,
      },
      probatioVerification: {
        verifiedAt: new Date().toISOString(),
        verificationUrl: `${process.env.NEXT_PUBLIC_APP_URL || "https://probatio.audio"}/verify?hash=${normalizedHash}`,
      },
    }, {
      headers: {
        "Cache-Control": "public, max-age=3600",
        "Access-Control-Allow-Origin": "*",
      },
    });
  }
}
