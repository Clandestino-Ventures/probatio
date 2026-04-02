// @ts-nocheck — Supabase query types will be auto-generated via `supabase gen types`
/**
 * PROBATIO — Dedup Pre-Check Endpoint
 *
 * GET /api/analyze/check?hash=abc123...
 *
 * Used by the upload component BEFORE uploading the file — only sends
 * the SHA-256 hash, no file transfer. Returns whether this user has
 * already analyzed a file with the same hash and, if so, the analysis
 * ID and its current status.
 *
 * Returns: { exists: boolean, analysisId?: string, status?: string, createdAt?: string, inProgress?: boolean }
 */

import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { rateLimit } from "@/lib/rate-limit";

/** Regex for a valid 64-character lowercase hex string (SHA-256). */
const SHA256_RE = /^[0-9a-f]{64}$/;

export async function GET(request: NextRequest) {
  try {
    // ── Auth ──────────────────────────────────────────────────────────────
    const supabase = await createClient();
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json(
        { success: false, error: { code: "UNAUTHORIZED", message: "Authentication required." } },
        { status: 401 },
      );
    }

    const { success: rateLimitOk, resetIn } = rateLimit(`analyze-check:${user.id}`, 30, 60_000);
    if (!rateLimitOk) {
      return NextResponse.json(
        { error: "Rate limit exceeded. Try again later." },
        { status: 429, headers: { "Retry-After": String(Math.ceil(resetIn / 1000)) } }
      );
    }

    // ── Parse & validate hash ────────────────────────────────────────────
    const hash = request.nextUrl.searchParams.get("hash");

    if (!hash) {
      return NextResponse.json(
        { success: false, error: { code: "BAD_REQUEST", message: "Missing required query parameter: hash." } },
        { status: 400 },
      );
    }

    const normalizedHash = hash.toLowerCase();

    if (!SHA256_RE.test(normalizedHash)) {
      return NextResponse.json(
        {
          success: false,
          error: {
            code: "BAD_REQUEST",
            message: "Invalid hash format. Expected a 64-character lowercase hex string (SHA-256).",
          },
        },
        { status: 400 },
      );
    }

    // ── Check for completed analysis first ───────────────────────────────
    const { data: completed, error: completedError } = await supabase
      .from("analyses")
      .select("id, status, created_at")
      .eq("user_id", user.id)
      .eq("file_hash", normalizedHash)
      .eq("status", "completed")
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    if (completedError) {
      console.error("[GET /api/analyze/check] DB error (completed):", completedError.message);
      return NextResponse.json(
        { success: false, error: { code: "DB_ERROR", message: "Failed to query analyses." } },
        { status: 500 },
      );
    }

    if (completed) {
      return NextResponse.json({
        success: true,
        data: {
          exists: true,
          analysisId: completed.id,
          status: completed.status,
          createdAt: completed.created_at,
          inProgress: false,
        },
      });
    }

    // ── Check for in-progress analysis ───────────────────────────────────
    const IN_PROGRESS_STATUSES = [
      "pending",
      "uploading",
      "normalizing",
      "separating",
      "extracting",
      "matching",
      "classifying",
    ];

    const { data: inProgress, error: inProgressError } = await supabase
      .from("analyses")
      .select("id, status, created_at")
      .eq("user_id", user.id)
      .eq("file_hash", normalizedHash)
      .in("status", IN_PROGRESS_STATUSES)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    if (inProgressError) {
      console.error("[GET /api/analyze/check] DB error (in-progress):", inProgressError.message);
      return NextResponse.json(
        { success: false, error: { code: "DB_ERROR", message: "Failed to query analyses." } },
        { status: 500 },
      );
    }

    if (inProgress) {
      return NextResponse.json({
        success: true,
        data: {
          exists: true,
          analysisId: inProgress.id,
          status: inProgress.status,
          createdAt: inProgress.created_at,
          inProgress: true,
        },
      });
    }

    // ── No existing analysis found ───────────────────────────────────────
    return NextResponse.json({
      success: true,
      data: {
        exists: false,
      },
    });
  } catch (error) {
    console.error("[GET /api/analyze/check] Unhandled error:", error);
    return NextResponse.json(
      {
        success: false,
        error: {
          code: "INTERNAL_ERROR",
          message: "An unexpected error occurred.",
        },
      },
      { status: 500 },
    );
  }
}
