/**
 * PROBATIO — API Request / Response Types
 *
 * Typed contracts for every public API endpoint.
 * All responses follow a consistent envelope structure.
 */

import type { AnalysisMode, RiskLevel, PlanTier } from "./database";
import type { AnalysisResult, MatchResult, SimilarityScore } from "./analysis";
import type {
  ForensicComparison,
  EvidencePackage,
  ChainOfCustodyEntry,
} from "./forensic";

// ────────────────────────────────────────────────────────────────────────────
// Generic Response Envelope
// ────────────────────────────────────────────────────────────────────────────

export interface ApiSuccess<T> {
  success: true;
  data: T;
  meta?: ApiMeta;
}

export interface ApiError {
  success: false;
  error: {
    code: string;
    message: string;
    details?: Record<string, unknown>;
  };
}

export type ApiResponse<T> = ApiSuccess<T> | ApiError;

export interface ApiMeta {
  /** Current page (1-based). */
  page?: number;
  /** Items per page. */
  perPage?: number;
  /** Total items available. */
  total?: number;
  /** ISO 8601 timestamp of the response. */
  timestamp: string;
}

// ────────────────────────────────────────────────────────────────────────────
// Analysis Endpoints
// ────────────────────────────────────────────────────────────────────────────

/** POST /api/analyze — Start a new analysis. */
export interface AnalyzeRequest {
  /** Title for the analysis (user-supplied). */
  title: string;
  /** Signed upload URL or pre-existing storage path. */
  fileUrl: string;
  /** SHA-256 hash of the uploaded file (hex-encoded). */
  fileHashSha256: string;
  /** Byte size of the uploaded file. */
  fileSizeBytes: number;
  /** Original file format (e.g. "wav", "mp3", "flac"). */
  fileFormat: string;
  /** Analysis mode. Defaults to "standard". */
  mode?: AnalysisMode;
}

/** POST /api/analyze — Response. */
export interface AnalyzeResponse {
  analysisId: string;
  status: string;
  /** Estimated time to completion in seconds (null if unknown). */
  estimatedSeconds: number | null;
  /** Number of credits consumed. */
  creditsUsed: number;
}

/** GET /api/analyze/:id — Full analysis result. */
export type AnalysisDetailResponse = AnalysisResult;

/** GET /api/analyze — Paginated list of user analyses. */
export interface AnalysisListItem {
  id: string;
  title: string;
  mode: AnalysisMode;
  status: string;
  overallRisk: RiskLevel | null;
  matchCount: number;
  createdAt: string;
  completedAt: string | null;
}

// ────────────────────────────────────────────────────────────────────────────
// Forensic Endpoints
// ────────────────────────────────────────────────────────────────────────────

/** POST /api/forensic — Open a forensic case. */
export interface ForensicRequest {
  analysisId: string;
  plaintiffName?: string | null;
  defendantName?: string | null;
  courtJurisdiction?: string | null;
  filingDeadline?: string | null;
  notes?: string | null;
}

/** POST /api/forensic — Response. */
export interface ForensicResponse {
  caseId: string;
  caseNumber: string;
  status: string;
  createdAt: string;
}

/** GET /api/forensic/:id/comparison — Full comparison report. */
export type ForensicComparisonResponse = ForensicComparison;

/** GET /api/forensic/:id/evidence — Evidence package metadata. */
export type ForensicEvidenceResponse = EvidencePackage;

/** GET /api/forensic/:id/custody — Chain of custody log. */
export type ForensicCustodyResponse = ChainOfCustodyEntry[];

// ────────────────────────────────────────────────────────────────────────────
// Verification Endpoints
// ────────────────────────────────────────────────────────────────────────────

/** POST /api/verify — Verify file / evidence integrity. */
export interface VerifyRequest {
  /** Entity type to verify ("analysis" | "evidence_package"). */
  entityType: "analysis" | "evidence_package";
  /** ID of the entity. */
  entityId: string;
  /** SHA-256 hash to compare against. */
  expectedHash: string;
}

/** POST /api/verify — Response. */
export interface VerifyResponse {
  valid: boolean;
  entityType: string;
  entityId: string;
  expectedHash: string;
  actualHash: string;
  /** If the chain of custody was also verified. */
  chainValid: boolean | null;
  verifiedAt: string;
}

// ────────────────────────────────────────────────────────────────────────────
// Credits & Billing Endpoints
// ────────────────────────────────────────────────────────────────────────────

/** GET /api/credits — Current credit balance & usage. */
export interface CreditResponse {
  balance: number;
  lifetimePurchased: number;
  lifetimeUsed: number;
  planTier: PlanTier;
  /** Monthly credit allowance for the current plan (null = pay-as-you-go). */
  monthlyAllowance: number | null;
  /** Credits remaining in the current billing cycle. */
  cycleRemaining: number | null;
}

/** POST /api/checkout — Start a Stripe checkout session. */
export interface CheckoutRequest {
  /** Plan to subscribe to, or "credits" for one-time purchase. */
  planTier: PlanTier | "credits";
  /** Number of credits to purchase (required when planTier is "credits"). */
  creditAmount?: number;
  /** URL to redirect to after successful checkout. */
  successUrl: string;
  /** URL to redirect to if the user cancels. */
  cancelUrl: string;
}

/** POST /api/checkout — Response. */
export interface CheckoutResponse {
  /** Stripe Checkout session URL to redirect the user to. */
  checkoutUrl: string;
  sessionId: string;
}

// ────────────────────────────────────────────────────────────────────────────
// Webhook Types (internal, used by route handlers)
// ────────────────────────────────────────────────────────────────────────────

/** Stripe webhook event payload subset used by PROBATIO. */
export interface StripeWebhookPayload {
  type: string;
  data: {
    object: Record<string, unknown>;
  };
}

/** Inngest event payload for pipeline orchestration. */
export interface PipelineEvent {
  name: string;
  data: {
    analysisId: string;
    userId: string;
    mode: AnalysisMode;
    fileUrl: string;
    fileHashSha256: string;
  };
}
