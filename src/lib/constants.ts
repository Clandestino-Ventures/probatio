/**
 * PROBATIO — Application-Wide Constants
 *
 * Single source of truth for pipeline versions, file constraints,
 * plan limits, pricing, and rate limits.
 */

import type { PlanTier, AnalysisMode } from "@/types/database";

// ────────────────────────────────────────────────────────────────────────────
// Pipeline
// ────────────────────────────────────────────────────────────────────────────

/** Semantic version of the analysis pipeline. */
export const PIPELINE_VERSION = "1.0.0" as const;

/** Ordered list of pipeline step names. */
export const PIPELINE_STEPS = [
  "upload",
  "normalize",
  "separate",
  "extract",
  "match",
  "classify",
] as const;

export type PipelineStepName = (typeof PIPELINE_STEPS)[number];

// ────────────────────────────────────────────────────────────────────────────
// File Constraints
// ────────────────────────────────────────────────────────────────────────────

/** Supported audio file extensions (lowercase, without leading dot). */
export const SUPPORTED_FORMATS = [
  "wav",
  "mp3",
  "flac",
  "aac",
  "ogg",
  "m4a",
  "aiff",
  "wma",
] as const;

export type SupportedFormat = (typeof SUPPORTED_FORMATS)[number];

/** Maximum upload file size in bytes (250 MB). */
export const MAX_FILE_SIZE = 250 * 1024 * 1024;

/** Maximum audio duration in seconds (15 minutes). */
export const MAX_DURATION_SECONDS = 15 * 60;

/** Minimum audio duration in seconds (5 seconds). */
export const MIN_DURATION_SECONDS = 5;

// ────────────────────────────────────────────────────────────────────────────
// Plan Definitions
// ────────────────────────────────────────────────────────────────────────────

export interface PlanDefinition {
  tier: PlanTier;
  name: string;
  /** Monthly price in cents (USD). 0 = free. */
  priceCentsMonthly: number;
  /** Annual price in cents (USD). 0 = free. */
  priceCentsAnnual: number;
  /** Credits included per billing cycle. */
  creditsPerMonth: number;
  /** Maximum analyses per month (null = unlimited). */
  maxAnalysesPerMonth: number | null;
  /** Allowed analysis modes. */
  allowedModes: readonly AnalysisMode[];
  /** Maximum file size override in bytes (null = use global default). */
  maxFileSize: number | null;
  /** Whether the plan includes forensic case features. */
  forensicAccess: boolean;
  /** Whether the plan includes priority queue processing. */
  priorityQueue: boolean;
  /** Maximum concurrent analyses. */
  maxConcurrent: number;
}

export const PLANS: Record<PlanTier, PlanDefinition> = {
  free: {
    tier: "free",
    name: "Free",
    priceCentsMonthly: 0,
    priceCentsAnnual: 0,
    creditsPerMonth: 3,
    maxAnalysesPerMonth: 3,
    allowedModes: ["screening"],
    maxFileSize: 50 * 1024 * 1024, // 50 MB
    forensicAccess: false,
    priorityQueue: false,
    maxConcurrent: 1,
  },
  starter: {
    tier: "starter",
    name: "Starter",
    priceCentsMonthly: 14900, // $149/mo
    priceCentsAnnual: 149000, // $1,490/yr
    creditsPerMonth: 50,
    maxAnalysesPerMonth: 50,
    allowedModes: ["screening", "clearance"],
    maxFileSize: 150 * 1024 * 1024, // 150 MB
    forensicAccess: false,
    priorityQueue: false,
    maxConcurrent: 2,
  },
  professional: {
    tier: "professional",
    name: "Professional",
    priceCentsMonthly: 49900, // $499/mo
    priceCentsAnnual: 499000, // $4,990/yr
    creditsPerMonth: 200,
    maxAnalysesPerMonth: 200,
    allowedModes: ["screening", "forensic", "clearance"],
    maxFileSize: null, // global default
    forensicAccess: true,
    priorityQueue: true,
    maxConcurrent: 5,
  },
  enterprise: {
    tier: "enterprise",
    name: "Enterprise",
    priceCentsMonthly: 149900, // $1,499/mo
    priceCentsAnnual: 1499000, // $14,990/yr
    creditsPerMonth: 9999, // effectively unlimited
    maxAnalysesPerMonth: null,
    allowedModes: ["screening", "forensic", "clearance"],
    maxFileSize: null,
    forensicAccess: true,
    priorityQueue: true,
    maxConcurrent: 20,
  },
} as const;

// ────────────────────────────────────────────────────────────────────────────
// Credit Costs
// ────────────────────────────────────────────────────────────────────────────

/** Number of credits consumed per analysis mode. */
export const CREDIT_COSTS: Record<AnalysisMode, number> = {
  screening: 1,
  forensic: 5,
  clearance: 2,
} as const;

/** Price per additional credit in cents (USD). */
export const CREDIT_PRICE_CENTS = 100 as const; // $1.00

// ────────────────────────────────────────────────────────────────────────────
// API Rate Limits
// ────────────────────────────────────────────────────────────────────────────

export interface RateLimitConfig {
  /** Maximum requests within the window. */
  maxRequests: number;
  /** Window duration in seconds. */
  windowSeconds: number;
}

/** Rate limits per plan tier. */
export const RATE_LIMITS: Record<PlanTier, RateLimitConfig> = {
  free: { maxRequests: 10, windowSeconds: 60 },
  starter: { maxRequests: 30, windowSeconds: 60 },
  professional: { maxRequests: 100, windowSeconds: 60 },
  enterprise: { maxRequests: 500, windowSeconds: 60 },
} as const;

/** Global rate limit applied before plan-specific limits. */
export const GLOBAL_RATE_LIMIT: RateLimitConfig = {
  maxRequests: 1000,
  windowSeconds: 60,
} as const;

// ────────────────────────────────────────────────────────────────────────────
// Timeouts
// ────────────────────────────────────────────────────────────────────────────

/** Pipeline timeout per analysis mode in milliseconds. */
export const PIPELINE_TIMEOUTS: Record<AnalysisMode, number> = {
  screening: 5 * 60 * 1000, // 5 min
  forensic: 30 * 60 * 1000, // 30 min
  clearance: 10 * 60 * 1000, // 10 min — scanning against catalog
} as const;

// ────────────────────────────────────────────────────────────────────────────
// Miscellaneous
// ────────────────────────────────────────────────────────────────────────────

/** Application name used in metadata and headers. */
export const APP_NAME = "PROBATIO" as const;

/** Contact email shown in forensic reports and legal documents. */
export const SUPPORT_EMAIL = "support@probatio.audio" as const;
