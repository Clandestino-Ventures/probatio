// @ts-nocheck — Supabase query types will be auto-generated via `supabase gen types`
/**
 * PROBATIO — Forensic-Grade Analysis Upload API
 *
 * POST /api/analyze
 *
 * This endpoint is the FIRST LINK in the forensic chain of custody.
 * Every decision has a legal rationale:
 *
 * 1. Client computes SHA-256 BEFORE upload (proves original file integrity)
 * 2. Server re-computes SHA-256 and VERIFIES against client hash (tamper detection)
 * 3. Dedup check prevents wasting credits on already-analyzed files
 * 4. Atomic credit deduction prevents race conditions
 * 5. Two chain_of_custody entries recorded (file_uploaded + hash_computed)
 * 6. Inngest event triggers the durable ML pipeline
 */

import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { rateLimit } from "@/lib/rate-limit";
import { inngest } from "@/lib/inngest/client";
import {
  CREDIT_COSTS,
  MAX_FILE_SIZE,
  SUPPORTED_FORMATS,
  PIPELINE_VERSION,
} from "@/lib/constants";
import type { AnalysisMode } from "@/types/database";

// ────────────────────────────────────────────────────────────────────────────
// Helpers
// ────────────────────────────────────────────────────────────────────────────

async function hashBuffer(buffer: ArrayBuffer): Promise<string> {
  const hashBuffer = await crypto.subtle.digest("SHA-256", buffer);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map((b) => b.toString(16).padStart(2, "0")).join("");
}

function isValidSha256(hash: string): boolean {
  return /^[0-9a-f]{64}$/i.test(hash);
}

async function recordCustody(
  adminClient: ReturnType<typeof createAdminClient>,
  entityId: string,
  action: string,
  actorId: string,
  detail: Record<string, unknown>,
  artifactHash?: string,
  artifactType?: string,
) {
  await adminClient.from("chain_of_custody").insert({
    entity_type: "analysis",
    entity_id: entityId,
    action,
    actor_id: actorId,
    artifact_hash: artifactHash ?? null,
    artifact_type: artifactType ?? null,
    detail,
    recorded_at: new Date().toISOString(),
  });
}

// ────────────────────────────────────────────────────────────────────────────
// POST /api/analyze
// ────────────────────────────────────────────────────────────────────────────

export async function POST(request: Request) {
  const startTime = Date.now();

  try {
    // ── STEP 1: AUTH + IDENTITY ──────────────────────────────────────────
    const supabase = await createClient();
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json(
        { error: "Authentication required.", code: "UNAUTHORIZED" },
        { status: 401 }
      );
    }

    // Rate limit: 10 uploads per minute per user
    const { success: rateLimitOk, resetIn } = rateLimit(
      `analyze:${user.id}`,
      10,
      60_000
    );
    if (!rateLimitOk) {
      return NextResponse.json(
        { error: "Rate limit exceeded.", code: "RATE_LIMITED" },
        {
          status: 429,
          headers: { "Retry-After": String(Math.ceil(resetIn / 1000)) },
        }
      );
    }

    // Fetch profile for role/plan verification
    const { data: profile } = await supabase
      .from("profiles")
      .select("*")
      .eq("id", user.id)
      .single();

    // ── STEP 2: PARSE + VALIDATE REQUEST ─────────────────────────────────
    const formData = await request.formData();
    const file = formData.get("file") as File | null;
    const clientHash = ((formData.get("client_hash") as string) ??
      (formData.get("fileHash") as string) ??
      "").toLowerCase();
    const mode = ((formData.get("mode") as string) ?? "screening") as AnalysisMode;
    const title = (formData.get("title") as string) ?? "";
    const catalogIdsRaw = formData.get("catalog_ids") as string | null;
    const catalogIds: string[] = catalogIdsRaw ? JSON.parse(catalogIdsRaw) : [];

    // Validate file exists
    if (!file || !(file instanceof File)) {
      return NextResponse.json(
        { error: "No audio file provided.", code: "BAD_REQUEST" },
        { status: 400 }
      );
    }

    // Validate file size
    if (file.size > MAX_FILE_SIZE) {
      return NextResponse.json(
        {
          error: `File exceeds maximum size of ${Math.round(MAX_FILE_SIZE / (1024 * 1024))}MB.`,
          code: "FILE_TOO_LARGE",
        },
        { status: 413 }
      );
    }

    // Validate file format
    const extension = file.name.split(".").pop()?.toLowerCase() ?? "";
    if (
      !SUPPORTED_FORMATS.includes(
        extension as (typeof SUPPORTED_FORMATS)[number]
      )
    ) {
      return NextResponse.json(
        {
          error: `Unsupported format "${extension}". Accepted: ${SUPPORTED_FORMATS.join(", ")}`,
          code: "UNSUPPORTED_FORMAT",
        },
        { status: 415 }
      );
    }

    // Validate client hash format (if provided)
    if (clientHash && !isValidSha256(clientHash)) {
      return NextResponse.json(
        {
          error: "Invalid client hash. Must be a 64-character hex SHA-256 string.",
          code: "INVALID_HASH",
        },
        { status: 400 }
      );
    }

    // Validate mode access
    if (mode === "forensic") {
      const tier = profile?.plan_tier ?? "free";
      const role = profile?.role ?? "user";
      const hasAccess =
        tier === "professional" ||
        tier === "enterprise" ||
        role === "analyst" ||
        role === "admin";
      if (!hasAccess) {
        return NextResponse.json(
          {
            error: "Forensic analysis requires Professional plan or higher.",
            code: "FORBIDDEN",
          },
          { status: 403 }
        );
      }
    }

    // ── STEP 3: SERVER-SIDE HASH VERIFICATION ────────────────────────────
    // This is the forensic innovation: compute SHA-256 of the received file
    // and VERIFY it matches the client-provided hash.
    // Proves the file was not altered in transit.
    const fileBuffer = await file.arrayBuffer();
    const serverHash = await hashBuffer(fileBuffer);

    if (clientHash && serverHash !== clientHash) {
      return NextResponse.json(
        {
          error:
            "File integrity check failed. The server-computed hash does not match the client-provided hash. The file may have been altered in transit.",
          code: "HASH_MISMATCH",
          detail: {
            clientHash,
            serverHash,
          },
        },
        { status: 400 }
      );
    }

    // Use server hash as the canonical hash (even if client didn't provide one)
    const fileHash = serverHash;

    // ── STEP 4: DEDUP CHECK ──────────────────────────────────────────────
    // Check if this exact file has already been analyzed by this user
    const { data: existingCompleted } = await supabase
      .from("analyses")
      .select("id, status, created_at, overall_risk")
      .eq("user_id", user.id)
      .eq("file_hash", fileHash)
      .eq("status", "completed")
      .limit(1)
      .single();

    if (existingCompleted) {
      return NextResponse.json({
        existing: true,
        analysisId: existingCompleted.id,
        status: existingCompleted.status,
        overallRisk: existingCompleted.overall_risk,
        createdAt: existingCompleted.created_at,
        message: "This file has already been analyzed.",
      });
    }

    // Check for in-progress analysis of same file
    const { data: existingInProgress } = await supabase
      .from("analyses")
      .select("id, status")
      .eq("user_id", user.id)
      .eq("file_hash", fileHash)
      .not("status", "in", '("completed","failed")')
      .limit(1)
      .single();

    if (existingInProgress) {
      return NextResponse.json({
        inProgress: true,
        analysisId: existingInProgress.id,
        status: existingInProgress.status,
        message: "This file is currently being analyzed.",
      });
    }

    // ── STEP 5: CREDIT CHECK + ATOMIC DEDUCTION ─────────────────────────
    const creditCost = CREDIT_COSTS[mode] ?? CREDIT_COSTS.screening;

    const { data: credits } = await supabase
      .from("credits")
      .select("*")
      .eq("user_id", user.id)
      .single();

    if (!credits || credits.balance < creditCost) {
      return NextResponse.json(
        {
          error: `Insufficient credits. Required: ${creditCost}, available: ${credits?.balance ?? 0}.`,
          code: "INSUFFICIENT_CREDITS",
          upgradeUrl: "/pricing",
        },
        { status: 402 }
      );
    }

    // Atomic deduction: WHERE balance >= creditCost prevents race conditions
    const adminClient = createAdminClient();
    const { data: deductResult, error: deductError } = await adminClient.rpc(
      "deduct_credit_atomic",
      { p_user_id: user.id, p_amount: creditCost }
    );

    // Fallback if RPC doesn't exist: direct update with balance check
    if (deductError) {
      const { count } = await adminClient
        .from("credits")
        .update({
          balance: credits.balance - creditCost,
          lifetime_used: credits.lifetime_used + creditCost,
        })
        .eq("user_id", user.id)
        .gte("balance", creditCost);

      if (count === 0) {
        return NextResponse.json(
          {
            error: "Credit deduction failed. Credits may have been consumed by a concurrent request.",
            code: "CREDIT_RACE",
          },
          { status: 402 }
        );
      }
    }

    // Record credit usage
    await adminClient.from("credit_usage").insert({
      user_id: user.id,
      action: "analysis_debit",
      amount: -creditCost,
      balance_after: credits.balance - creditCost,
      reference_id: null, // Will be updated with analysis_id
      description: `${mode} analysis: ${title || file.name}`,
    });

    // ── STEP 6: GET ACTIVE PIPELINE VERSION ──────────────────────────────
    const { data: pipelineVersion } = await adminClient
      .from("pipeline_versions")
      .select("*")
      .eq("is_active", true)
      .single();

    const pipelineVersionId = pipelineVersion?.id ?? null;
    const pipelineVersionTag = pipelineVersion?.version_tag ?? PIPELINE_VERSION;

    // ── STEP 7: UPLOAD TO SUPABASE STORAGE ───────────────────────────────
    const analysisId = crypto.randomUUID();
    const storagePath = `${user.id}/${analysisId}/original/${file.name}`;

    const { error: uploadError } = await adminClient.storage
      .from("probatio-audio")
      .upload(storagePath, fileBuffer, {
        contentType: file.type || "audio/mpeg",
        upsert: false,
      });

    if (uploadError) {
      // Refund credit on upload failure
      await adminClient
        .from("credits")
        .update({ balance: credits.balance })
        .eq("user_id", user.id);

      return NextResponse.json(
        { error: "File upload failed.", code: "UPLOAD_FAILED", detail: uploadError.message },
        { status: 500 }
      );
    }

    const {
      data: { publicUrl },
    } = adminClient.storage.from("probatio-audio").getPublicUrl(storagePath);

    // ── STEP 8: CREATE ANALYSIS ROW ──────────────────────────────────────
    const { error: insertError } = await adminClient.from("analyses").insert({
      id: analysisId,
      user_id: user.id,
      pipeline_version: pipelineVersionTag,
      mode: mode,
      status: "queued",
      file_name: title || file.name,
      file_hash: fileHash,
      file_size_bytes: file.size,
      audio_url: publicUrl,
      ...(mode === "clearance" ? { catalog_ids: catalogIds } : {}),
    });

    if (insertError) {
      // Refund credit on DB failure
      await adminClient
        .from("credits")
        .update({ balance: credits.balance })
        .eq("user_id", user.id);

      return NextResponse.json(
        { error: "Failed to create analysis record.", code: "DB_ERROR" },
        { status: 500 }
      );
    }

    // ── STEP 9: CHAIN OF CUSTODY — FIRST TWO ENTRIES ─────────────────────
    // Entry 1: file_uploaded
    await recordCustody(adminClient, analysisId, "file_uploaded", user.id, {
      file_name: file.name,
      file_size_bytes: file.size,
      mime_type: file.type,
      storage_path: storagePath,
      client_hash_provided: !!clientHash,
    }, fileHash, "audio_file");

    // Entry 2: hash_computed — proves server verified the client's hash
    await recordCustody(adminClient, analysisId, "hash_computed", user.id, {
      algorithm: "SHA-256",
      client_hash: clientHash || null,
      server_hash: serverHash,
      hashes_match: !clientHash || clientHash === serverHash,
      verified_at: new Date().toISOString(),
    }, serverHash);

    // ── STEP 10: EMIT INNGEST EVENT ──────────────────────────────────────
    if (mode === "clearance") {
      await inngest.send({
        name: "clearance/requested",
        data: {
          analysisId,
          userId: user.id,
          fileUrl: publicUrl,
          fileHashSha256: fileHash,
          catalogIds,
          organizationId: profile?.organization_id ?? null,
        },
      });
    } else {
      await inngest.send({
        name: "analysis/requested",
        data: {
          analysisId,
          userId: user.id,
          fileUrl: publicUrl,
          fileHashSha256: fileHash,
          mode: mode,
          pipelineVersionId,
        },
      });
    }

    // ── RESPONSE ─────────────────────────────────────────────────────────
    const elapsed = Date.now() - startTime;

    return NextResponse.json(
      {
        analysisId,
        status: "queued",
        mode,
        fileHash,
        pipelineVersion: pipelineVersionTag,
        creditsUsed: creditCost,
        creditsRemaining: credits.balance - creditCost,
        processingTimeMs: elapsed,
        createdAt: new Date().toISOString(),
      },
      { status: 201 }
    );
  } catch (error) {
    console.error("[POST /api/analyze] Unhandled error:", error);
    return NextResponse.json(
      { error: "An unexpected error occurred.", code: "INTERNAL_ERROR" },
      { status: 500 }
    );
  }
}
