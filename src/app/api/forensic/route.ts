// @ts-nocheck — Supabase query types will be auto-generated via `supabase gen types`
/**
 * PROBATIO — Forensic Case Creation API
 *
 * POST /api/forensic
 *
 * Accepts multipart form data with case metadata and two audio tracks
 * (Track A and Track B). Creates a forensic case record in "pending_payment"
 * status and returns a checkout URL for payment.
 */

import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { MAX_FILE_SIZE, SUPPORTED_FORMATS } from "@/lib/constants";
import { rateLimit } from "@/lib/rate-limit";
import { getStripe } from "@/lib/stripe/client";

function validateAudioFile(
  file: File | null,
  label: string,
): { valid: true } | { valid: false; error: string } {
  if (!file || !(file instanceof File)) {
    return { valid: false, error: `${label} is required.` };
  }

  const extension = file.name.split(".").pop()?.toLowerCase() ?? "";
  if (!SUPPORTED_FORMATS.includes(extension as (typeof SUPPORTED_FORMATS)[number])) {
    return {
      valid: false,
      error: `${label} has unsupported format "${extension}". Supported: ${SUPPORTED_FORMATS.join(", ")}`,
    };
  }

  if (file.size > MAX_FILE_SIZE) {
    return {
      valid: false,
      error: `${label} exceeds maximum size of ${MAX_FILE_SIZE / (1024 * 1024)} MB.`,
    };
  }

  return { valid: true };
}

export async function POST(request: Request) {
  try {
    // ── Auth ────────────────────────────────────────────────────────────
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

    const { success: rateLimitOk, resetIn } = rateLimit(`forensic:${user.id}`, 3, 60_000);
    if (!rateLimitOk) {
      return NextResponse.json(
        { error: "Rate limit exceeded. Try again later." },
        { status: 429, headers: { "Retry-After": String(Math.ceil(resetIn / 1000)) } }
      );
    }

    // ── Parse form data ────────────────────────────────────────────────
    const formData = await request.formData();
    const caseName = (formData.get("caseName") as string) ?? "";
    const caseDescription = (formData.get("caseDescription") as string) ?? "";
    const partiesInvolved = (formData.get("partiesInvolved") as string) ?? "";
    const forensicTier = (formData.get("forensicTier") as string) ?? "standard";
    const trackA = formData.get("trackA") as File | null;
    const trackB = formData.get("trackB") as File | null;

    if (!caseName.trim()) {
      return NextResponse.json(
        { success: false, error: { code: "BAD_REQUEST", message: "Case name is required." } },
        { status: 400 },
      );
    }

    // ── Validate both files ────────────────────────────────────────────
    const trackAValidation = validateAudioFile(trackA, "Track A");
    if (!trackAValidation.valid) {
      return NextResponse.json(
        { success: false, error: { code: "BAD_REQUEST", message: trackAValidation.error } },
        { status: 400 },
      );
    }

    const trackBValidation = validateAudioFile(trackB, "Track B");
    if (!trackBValidation.valid) {
      return NextResponse.json(
        { success: false, error: { code: "BAD_REQUEST", message: trackBValidation.error } },
        { status: 400 },
      );
    }

    // TypeScript narrowing (files are guaranteed non-null after validation).
    const fileA = trackA as File;
    const fileB = trackB as File;

    // ── Generate IDs ───────────────────────────────────────────────────
    const caseId = crypto.randomUUID();
    const analysisId = crypto.randomUUID();
    const caseNumber = `FC-${Date.now().toString(36).toUpperCase()}`;

    // Use admin client for DB/storage operations (RLS blocks user INSERT)
    const adminClient = createAdminClient();

    // ── Upload Track A ─────────────────────────────────────────────────
    const pathA = `${user.id}/forensic/${caseId}/track-a/${fileA.name}`;
    const bufferA = await fileA.arrayBuffer();

    const { error: uploadAError } = await adminClient.storage
      .from("forensic-evidence")
      .upload(pathA, bufferA, {
        contentType: fileA.type || "audio/mpeg",
        upsert: false,
      });

    if (uploadAError) {
      return NextResponse.json(
        { success: false, error: { code: "UPLOAD_FAILED", message: `Track A upload failed: ${uploadAError.message}` } },
        { status: 500 },
      );
    }

    // ── Upload Track B ─────────────────────────────────────────────────
    const pathB = `${user.id}/forensic/${caseId}/track-b/${fileB.name}`;
    const bufferB = await fileB.arrayBuffer();

    const { error: uploadBError } = await adminClient.storage
      .from("forensic-evidence")
      .upload(pathB, bufferB, {
        contentType: fileB.type || "audio/mpeg",
        upsert: false,
      });

    if (uploadBError) {
      return NextResponse.json(
        { success: false, error: { code: "UPLOAD_FAILED", message: `Track B upload failed: ${uploadBError.message}` } },
        { status: 500 },
      );
    }

    // ── Build public URLs ──────────────────────────────────────────────
    const {
      data: { publicUrl: trackAUrl },
    } = adminClient.storage.from("forensic-evidence").getPublicUrl(pathA);

    const {
      data: { publicUrl: trackBUrl },
    } = adminClient.storage.from("forensic-evidence").getPublicUrl(pathB);

    // ── Create analysis record (placeholder for the forensic analysis) ─
    const { error: analysisInsertError } = await adminClient.from("analyses").insert({
      id: analysisId,
      user_id: user.id,
      file_name: caseName,
      mode: "forensic",
      status: "queued",
      audio_url: trackAUrl,
      file_hash: "",
      file_size_bytes: fileA.size + fileB.size,
      pipeline_version: "v1.0.0-alpha",
    });

    if (analysisInsertError) {
      return NextResponse.json(
        { success: false, error: { code: "DB_ERROR", message: analysisInsertError.message } },
        { status: 500 },
      );
    }

    // ── Create forensic case record ────────────────────────────────────
    const { error: caseInsertError } = await adminClient.from("forensic_cases").insert({
      id: caseId,
      user_id: user.id,
      case_name: caseName,
      case_description: caseDescription || null,
      parties_involved: partiesInvolved || null,
      track_a_analysis_id: analysisId,
      status: "pending_payment",
      chain_of_custody: [
        {
          sequence: 0,
          timestamp: new Date().toISOString(),
          actor: `user:${user.id}`,
          action: "Case created with Track A and Track B uploads",
          hashAfter: null,
          hashBefore: null,
          metadata: {
            caseNumber,
            trackAName: fileA.name,
            trackBName: fileB.name,
            trackAUrl,
            trackBUrl,
          },
        },
      ],
    });

    if (caseInsertError) {
      return NextResponse.json(
        { success: false, error: { code: "DB_ERROR", message: caseInsertError.message } },
        { status: 500 },
      );
    }

    // ── Create Stripe Checkout Session ─────────────────────────────────
    const priceId = forensicTier === "expert"
      ? process.env.STRIPE_PRICE_FORENSIC_EXPERT
      : process.env.STRIPE_PRICE_FORENSIC_STANDARD;

    let checkoutUrl: string | null = null;

    if (priceId) {
      try {
        const stripe = getStripe();
        const appUrl = process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000";
        const session = await stripe.checkout.sessions.create({
          mode: "payment",
          customer_email: user.email ?? undefined,
          line_items: [{ price: priceId, quantity: 1 }],
          payment_intent_data: {
            metadata: {
              probatio_forensic_case_id: caseId,
              probatio_user_id: user.id,
              tier: forensicTier,
            },
          },
          success_url: `${appUrl}/dashboard/forensic/${caseId}?payment=success`,
          cancel_url: `${appUrl}/dashboard/forensic/${caseId}?payment=canceled`,
          metadata: {
            userId: user.id,
            type: "forensic",
            forensicCaseId: caseId,
            tier: forensicTier,
          },
        });
        checkoutUrl = session.url;
      } catch (stripeError) {
        console.error("[PROBATIO] Stripe checkout creation failed:", stripeError);
      }
    }

    // ── Response ───────────────────────────────────────────────────────
    return NextResponse.json(
      {
        success: true,
        data: {
          caseId,
          caseNumber,
          status: "pending_payment",
          checkoutUrl,
        },
      },
      { status: 201 },
    );
  } catch (error) {
    console.error("[POST /api/forensic] Unhandled error:", error);
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
