/**
 * PROBATIO — Catalog Ingestion Cost Estimation
 *
 * Computes estimated GPU cost and processing time for catalog ingestion.
 * Costs are based on measured Modal GPU pricing (T4/A10G) for each
 * pipeline step, averaged across real production workloads.
 */

export interface CatalogCostEstimate {
  track_count: number;
  estimated_cost_usd: number;
  estimated_time_minutes: number;
  breakdown: {
    normalize: number;
    demucs: number;
    features: number;
    clap: number;
    whisper: number;
    fingerprint: number;
    storage: number;
  };
  is_within_plan: boolean;
}

// Per-track cost in USD (measured from Modal GPU billing)
const COST_BREAKDOWN_USD = {
  normalize: 0.005,   // T4, ~5s, normalize audio
  demucs: 0.035,      // A10G, ~25s, source separation
  features: 0.020,    // T4, ~15s, CREPE + librosa
  clap: 0.025,        // A10G, ~12s, 2 track-level embeddings
  whisper: 0.030,     // T4, ~20s, Whisper large-v3
  fingerprint: 0.010, // CPU, ~5s, Chromaprint
  storage: 0.002,     // Supabase Storage for stems
} as const;

const COST_PER_TRACK_USD = Object.values(COST_BREAKDOWN_USD).reduce(
  (sum, v) => sum + v,
  0,
);

// Throughput with concurrency limit of 25
const TRACKS_PER_MINUTE = 25; // 25 parallel × ~60s each = ~25/min

// Enterprise plan includes 10,000 tracks/month
const ENTERPRISE_INCLUDED_TRACKS = 10_000;

export function estimateCatalogCost(trackCount: number): CatalogCostEstimate {
  const estimatedCost = trackCount * COST_PER_TRACK_USD;
  const estimatedMinutes = Math.ceil(trackCount / TRACKS_PER_MINUTE);

  return {
    track_count: trackCount,
    estimated_cost_usd: Math.round(estimatedCost * 100) / 100,
    estimated_time_minutes: estimatedMinutes,
    breakdown: {
      normalize: Math.round(trackCount * COST_BREAKDOWN_USD.normalize * 100) / 100,
      demucs: Math.round(trackCount * COST_BREAKDOWN_USD.demucs * 100) / 100,
      features: Math.round(trackCount * COST_BREAKDOWN_USD.features * 100) / 100,
      clap: Math.round(trackCount * COST_BREAKDOWN_USD.clap * 100) / 100,
      whisper: Math.round(trackCount * COST_BREAKDOWN_USD.whisper * 100) / 100,
      fingerprint: Math.round(trackCount * COST_BREAKDOWN_USD.fingerprint * 100) / 100,
      storage: Math.round(trackCount * COST_BREAKDOWN_USD.storage * 100) / 100,
    },
    is_within_plan: trackCount <= ENTERPRISE_INCLUDED_TRACKS,
  };
}

export { COST_PER_TRACK_USD, ENTERPRISE_INCLUDED_TRACKS };
