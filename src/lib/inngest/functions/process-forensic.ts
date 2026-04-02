// @ts-nocheck — Supabase query types will be auto-generated via `supabase gen types`
/**
 * PROBATIO — Forensic Analysis Pipeline (Inngest Function)
 *
 * Triggered by "forensic-analysis/requested". Orchestrates a court-ready
 * 1v1 forensic comparison between two audio tracks (Track A vs Track B).
 *
 * Pipeline Steps:
 *   1. validate-payment  — Confirm Stripe payment intent succeeded
 *   2. process-track-a   — Full pipeline on Track A (normalize, separate, extract)
 *   3. process-track-b   — Full pipeline on Track B (normalize, separate, extract)
 *   4. compare           — Direct 1v1 comparison (DTW, chroma, onset, structure)
 *   5. generate-report   — Generate forensic report with statistical analysis
 *   6. assemble-evidence — Build sealed evidence package with chain of custody
 *
 * Every step logs to audit_log for forensic chain of custody.
 */

import { inngest } from "@/lib/inngest/client";
import { createAdminClient } from "@/lib/supabase/admin";
import { callModalEndpoint } from "@/lib/modal/client";
import { MODAL_ENDPOINTS } from "@/lib/modal/endpoints";
import { PIPELINE_VERSION } from "@/lib/constants";
import { runForensicComparison } from "@/lib/forensic/comparison";
import { assembleEvidencePackage } from "@/lib/forensic/evidence-package";
import type { ForensicStatus } from "@/types/database";
import type { AnalysisFeatures, StemUrls } from "@/types/analysis";
import type { ForensicComparison } from "@/types/forensic";
import type {
  NormalizeResponse,
  SeparateResponse,
  ExtractFeaturesResponse,
} from "@/lib/modal/endpoints";

// ────────────────────────────────────────────────────────────────────────────
// Constants
// ────────────────────────────────────────────────────────────────────────────

const MAX_RETRIES = 3;

// ────────────────────────────────────────────────────────────────────────────
// Helpers
// ────────────────────────────────────────────────────────────────────────────

async function updateCaseStatus(
  forensicCaseId: string,
  status: ForensicStatus,
  extra?: Record<string, unknown>,
): Promise<void> {
  const supabase = createAdminClient();
  const { error } = await supabase
    .from("forensic_cases")
    .update({ status, updated_at: new Date().toISOString(), ...extra })
    .eq("id", forensicCaseId);

  if (error) {
    throw new Error(`Failed to update forensic case status: ${error.message}`);
  }
}

async function logAudit(params: {
  userId: string;
  entityId: string;
  entityType: "forensic_case" | "analysis";
  action: string;
  hash: string;
  metadata?: Record<string, unknown>;
}): Promise<void> {
  const supabase = createAdminClient();
  const { error } = await supabase.from("audit_log").insert({
    user_id: params.userId,
    entity_type: params.entityType,
    entity_id: params.entityId,
    action: params.action,
    metadata: {
      hash: params.hash,
      pipeline_version: PIPELINE_VERSION,
      ...params.metadata,
    },
  });

  if (error) {
    console.error(`Forensic audit log insert failed: ${error.message}`);
  }
}

async function appendChainOfCustody(
  forensicCaseId: string,
  entry: {
    actor: string;
    action: string;
    hashAfter: string;
    hashBefore: string | null;
  },
): Promise<void> {
  const supabase = createAdminClient();

  // Fetch current chain.
  const { data: caseRecord } = await supabase
    .from("forensic_cases")
    .select("chain_of_custody")
    .eq("id", forensicCaseId)
    .single();

  const existingChain = (caseRecord?.chain_of_custody ?? []) as Record<string, unknown>[];
  const newEntry = {
    sequence: existingChain.length,
    timestamp: new Date().toISOString(),
    actor: entry.actor,
    action: entry.action,
    hashAfter: entry.hashAfter,
    hashBefore: entry.hashBefore,
    ipAddress: null,
    metadata: null,
  };

  await supabase
    .from("forensic_cases")
    .update({
      chain_of_custody: [...existingChain, newEntry],
      updated_at: new Date().toISOString(),
    })
    .eq("id", forensicCaseId);
}

interface TrackProcessingResult {
  normalizedUrl: string;
  normalizedHash: string;
  stemUrls: StemUrls;
  features: AnalysisFeatures;
  featuresHash: string;
}

async function processTrack(params: {
  trackLabel: string;
  fileUrl: string;
  fileHash: string;
  forensicCaseId: string;
  userId: string;
}): Promise<TrackProcessingResult> {
  const { trackLabel, fileUrl, fileHash, forensicCaseId, userId } = params;

  // Normalize
  const normalizeResult = await callModalEndpoint<
    { fileUrl: string; fileHash: string },
    NormalizeResponse
  >(MODAL_ENDPOINTS.normalize, { fileUrl, fileHash });

  await logAudit({
    userId,
    entityId: forensicCaseId,
    entityType: "forensic_case",
    action: `${trackLabel}:normalized`,
    hash: normalizeResult.normalizedHash,
    metadata: { sampleRate: normalizeResult.sampleRate },
  });

  await appendChainOfCustody(forensicCaseId, {
    actor: "system:pipeline",
    action: `Normalized ${trackLabel}`,
    hashAfter: normalizeResult.normalizedHash,
    hashBefore: fileHash,
  });

  // Separate stems
  const separateResult = await callModalEndpoint<
    { fileUrl: string; analysisId: string },
    SeparateResponse
  >(MODAL_ENDPOINTS.separate, {
    fileUrl: normalizeResult.normalizedUrl,
    analysisId: `${forensicCaseId}:${trackLabel}`,
  });

  const stemUrls: StemUrls = {
    vocals: separateResult.stems.vocals,
    drums: separateResult.stems.drums,
    bass: separateResult.stems.bass,
    other: separateResult.stems.other,
    original: normalizeResult.normalizedUrl,
  };

  await logAudit({
    userId,
    entityId: forensicCaseId,
    entityType: "forensic_case",
    action: `${trackLabel}:separated`,
    hash: separateResult.stemHash,
  });

  await appendChainOfCustody(forensicCaseId, {
    actor: "system:pipeline",
    action: `Separated stems for ${trackLabel}`,
    hashAfter: separateResult.stemHash,
    hashBefore: normalizeResult.normalizedHash,
  });

  // Extract features
  const featuresResult = await callModalEndpoint<
    { stemUrls: StemUrls; analysisId: string; mode: string },
    ExtractFeaturesResponse
  >(MODAL_ENDPOINTS.extractFeatures, {
    stemUrls,
    analysisId: `${forensicCaseId}:${trackLabel}`,
    mode: "forensic",
  });

  await logAudit({
    userId,
    entityId: forensicCaseId,
    entityType: "forensic_case",
    action: `${trackLabel}:features_extracted`,
    hash: featuresResult.featuresHash,
    metadata: {
      tempo: featuresResult.features.tempo,
      key: featuresResult.features.key,
    },
  });

  await appendChainOfCustody(forensicCaseId, {
    actor: "system:pipeline",
    action: `Extracted features for ${trackLabel}`,
    hashAfter: featuresResult.featuresHash,
    hashBefore: separateResult.stemHash,
  });

  return {
    normalizedUrl: normalizeResult.normalizedUrl,
    normalizedHash: normalizeResult.normalizedHash,
    stemUrls,
    features: featuresResult.features,
    featuresHash: featuresResult.featuresHash,
  };
}

// ────────────────────────────────────────────────────────────────────────────
// Inngest Function
// ────────────────────────────────────────────────────────────────────────────

export const processForensicAnalysis = inngest.createFunction(
  {
    id: "process-forensic-analysis",
    name: "Process Forensic Analysis",
    retries: 0,
    onFailure: async ({ event }) => {
      const { forensicCaseId, userId } = event.data.event.data as {
        forensicCaseId: string;
        userId: string;
      };

      try {
        await updateCaseStatus(forensicCaseId, "closed", {
          notes: "Pipeline failed. Manual review required.",
          closed_at: new Date().toISOString(),
        });
        await logAudit({
          userId,
          entityId: forensicCaseId,
          entityType: "forensic_case",
          action: "pipeline_failed",
          hash: "",
          metadata: { error: "Forensic pipeline failed after exhausting retries" },
        });
      } catch (cleanupError) {
        console.error("Error during forensic failure cleanup:", cleanupError);
      }
    },
  },
  { event: "forensic-analysis/requested" },
  async ({ event, step }) => {
    const {
      forensicCaseId,
      analysisId,
      userId,
      trackAUrl,
      trackAHashSha256,
      trackBUrl,
      trackBHashSha256,
      paymentIntentId,
      tier,
    } = event.data;

    // ── Step 1: Validate Payment ───────────────────────────────────────
    await step.run(
      "validate-payment",
      { retries: MAX_RETRIES },
      async () => {
        await logAudit({
          userId,
          entityId: forensicCaseId,
          entityType: "forensic_case",
          action: "step_started:validate_payment",
          hash: "",
          metadata: { paymentIntentId, tier },
        });

        // Verify the payment intent is in a succeeded state via Stripe.
        const { default: Stripe } = await import("stripe");
        const stripe = new Stripe(process.env.STRIPE_SECRET_KEY ?? "", {
          apiVersion: "2026-02-25.clover",
        });

        const paymentIntent = await stripe.paymentIntents.retrieve(paymentIntentId);
        if (paymentIntent.status !== "succeeded") {
          throw new Error(
            `Payment intent ${paymentIntentId} has status "${paymentIntent.status}", ` +
              `expected "succeeded". Cannot proceed with forensic analysis.`,
          );
        }

        await updateCaseStatus(forensicCaseId, "in_review");

        await logAudit({
          userId,
          entityId: forensicCaseId,
          entityType: "forensic_case",
          action: "step_completed:validate_payment",
          hash: "",
          metadata: {
            paymentIntentId,
            amount: paymentIntent.amount,
            currency: paymentIntent.currency,
          },
        });

        await appendChainOfCustody(forensicCaseId, {
          actor: "system:pipeline",
          action: "Payment validated",
          hashAfter: paymentIntentId,
          hashBefore: null,
        });
      },
    );

    // ── Step 2: Process Track A ────────────────────────────────────────
    const trackAResult = await step.run(
      "process-track-a",
      { retries: MAX_RETRIES },
      async () => {
        await logAudit({
          userId,
          entityId: forensicCaseId,
          entityType: "forensic_case",
          action: "step_started:process_track_a",
          hash: trackAHashSha256,
        });

        const result = await processTrack({
          trackLabel: "track-a",
          fileUrl: trackAUrl,
          fileHash: trackAHashSha256,
          forensicCaseId,
          userId,
        });

        await logAudit({
          userId,
          entityId: forensicCaseId,
          entityType: "forensic_case",
          action: "step_completed:process_track_a",
          hash: result.featuresHash,
        });

        return result;
      },
    );

    // ── Step 3: Process Track B ────────────────────────────────────────
    const trackBResult = await step.run(
      "process-track-b",
      { retries: MAX_RETRIES },
      async () => {
        await logAudit({
          userId,
          entityId: forensicCaseId,
          entityType: "forensic_case",
          action: "step_started:process_track_b",
          hash: trackBHashSha256,
        });

        const result = await processTrack({
          trackLabel: "track-b",
          fileUrl: trackBUrl,
          fileHash: trackBHashSha256,
          forensicCaseId,
          userId,
        });

        await logAudit({
          userId,
          entityId: forensicCaseId,
          entityType: "forensic_case",
          action: "step_completed:process_track_b",
          hash: result.featuresHash,
        });

        return result;
      },
    );

    // ── Step 4: 1v1 Comparison ─────────────────────────────────────────
    const comparisonResult = await step.run(
      "compare",
      { retries: MAX_RETRIES },
      async () => {
        await logAudit({
          userId,
          entityId: forensicCaseId,
          entityType: "forensic_case",
          action: "step_started:compare",
          hash: `${trackAResult.featuresHash}:${trackBResult.featuresHash}`,
        });

        const comparison = await runForensicComparison({
          forensicCaseId,
          trackA: {
            features: trackAResult.features,
            stemUrls: trackAResult.stemUrls,
            hash: trackAResult.featuresHash,
          },
          trackB: {
            features: trackBResult.features,
            stemUrls: trackBResult.stemUrls,
            hash: trackBResult.featuresHash,
          },
        });

        await appendChainOfCustody(forensicCaseId, {
          actor: "system:pipeline",
          action: "1v1 forensic comparison completed",
          hashAfter: `comparison:${comparison.id}`,
          hashBefore: `${trackAResult.featuresHash}:${trackBResult.featuresHash}`,
        });

        await logAudit({
          userId,
          entityId: forensicCaseId,
          entityType: "forensic_case",
          action: "step_completed:compare",
          hash: comparison.id,
          metadata: {
            overall_score: comparison.scores.overall,
            risk_level: comparison.riskLevel,
          },
        });

        return comparison;
      },
    );

    // ── Step 5: Generate Forensic Report ───────────────────────────────
    const forensicReport = await step.run(
      "generate-report",
      { retries: MAX_RETRIES },
      async () => {
        await updateCaseStatus(forensicCaseId, "analysis_complete");

        await logAudit({
          userId,
          entityId: forensicCaseId,
          entityType: "forensic_case",
          action: "step_started:generate_report",
          hash: comparisonResult.id,
        });

        // Persist the comparison results.
        const supabase = createAdminClient();
        await supabase
          .from("analyses")
          .update({
            overall_risk: comparisonResult.riskLevel,
            features: comparisonResult as unknown as Record<string, unknown>,
            pipeline_version: PIPELINE_VERSION,
            completed_at: new Date().toISOString(),
            status: "completed",
            updated_at: new Date().toISOString(),
          })
          .eq("id", analysisId);

        await updateCaseStatus(forensicCaseId, "report_generated");

        await logAudit({
          userId,
          entityId: forensicCaseId,
          entityType: "forensic_case",
          action: "step_completed:generate_report",
          hash: comparisonResult.id,
          metadata: {
            risk_level: comparisonResult.riskLevel,
            dimension_count: comparisonResult.dimensionAnalysis.length,
            matched_segments: comparisonResult.matchedSegments.length,
          },
        });

        return comparisonResult;
      },
    );

    // ── Step 6: Assemble Evidence Package ──────────────────────────────
    const evidencePackage = await step.run(
      "assemble-evidence",
      { retries: MAX_RETRIES },
      async () => {
        await logAudit({
          userId,
          entityId: forensicCaseId,
          entityType: "forensic_case",
          action: "step_started:assemble_evidence",
          hash: forensicReport.id,
        });

        // Fetch the case record for metadata.
        const supabase = createAdminClient();
        const { data: caseRecord } = await supabase
          .from("forensic_cases")
          .select("case_number, chain_of_custody")
          .eq("id", forensicCaseId)
          .single();

        if (!caseRecord) {
          throw new Error(`Forensic case ${forensicCaseId} not found`);
        }

        const evidence = await assembleEvidencePackage({
          forensicCaseId,
          caseNumber: caseRecord.case_number,
          comparison: forensicReport as ForensicComparison,
          trackA: {
            normalizedUrl: trackAResult.normalizedUrl,
            stemUrls: trackAResult.stemUrls,
            hash: trackAResult.normalizedHash,
          },
          trackB: {
            normalizedUrl: trackBResult.normalizedUrl,
            stemUrls: trackBResult.stemUrls,
            hash: trackBResult.normalizedHash,
          },
          chainOfCustody: caseRecord.chain_of_custody as Record<string, unknown>[],
        });

        // Store the evidence package URL on the case.
        await supabase
          .from("forensic_cases")
          .update({
            evidence_package_url: evidence.downloadUrl,
            updated_at: new Date().toISOString(),
          })
          .eq("id", forensicCaseId);

        await appendChainOfCustody(forensicCaseId, {
          actor: "system:pipeline",
          action: "Evidence package sealed",
          hashAfter: evidence.packageHash,
          hashBefore: forensicReport.id,
        });

        await logAudit({
          userId,
          entityId: forensicCaseId,
          entityType: "forensic_case",
          action: "step_completed:assemble_evidence",
          hash: evidence.packageHash,
          metadata: {
            item_count: evidence.items.length,
            download_url: evidence.downloadUrl,
          },
        });

        return {
          forensicCaseId,
          caseNumber: caseRecord.case_number,
          evidencePackageUrl: evidence.downloadUrl,
          packageHash: evidence.packageHash,
          riskLevel: forensicReport.riskLevel,
          overallScore: forensicReport.scores.overall,
          completedAt: new Date().toISOString(),
        };
      },
    );

    return evidencePackage;
  },
);
