-- ============================================================================
-- PROBATIO — Migration 006: Forensic Audio Normalization
-- ============================================================================
-- Adds normalization metadata columns to analyses table and updates
-- pipeline_version params with EBU R128 normalization configuration.
-- Without normalization, a defense attorney can argue: "results are unreliable
-- because you compared a demo at -18 LUFS against a master at -8 LUFS."
-- ============================================================================

-- ────────────────────────────────────────────────────────────────────────────
-- 1. analyses: Add normalization tracking columns
-- ────────────────────────────────────────────────────────────────────────────

ALTER TABLE public.analyses
  ADD COLUMN IF NOT EXISTS normalized_audio_url TEXT,
  ADD COLUMN IF NOT EXISTS normalized_hash VARCHAR(64),
  ADD COLUMN IF NOT EXISTS normalization_metrics JSONB;

-- normalization_metrics stores:
-- {
--   "pre": { "sample_rate": 44100, "channels": 2, "integrated_lufs": -18.3, ... },
--   "post": { "sample_rate": 44100, "channels": 1, "integrated_lufs": -14.0, "gain_applied_db": 4.3, ... },
--   "params": { "target_lufs": -14.0, "standard": "EBU R128", ... }
-- }

-- ────────────────────────────────────────────────────────────────────────────
-- 2. Update pipeline_versions params with normalization config
-- ────────────────────────────────────────────────────────────────────────────

UPDATE public.pipeline_versions
SET params = COALESCE(params, '{}'::jsonb) || '{
  "normalization": {
    "target_lufs": -14.0,
    "target_sample_rate": 44100,
    "target_channels": 1,
    "target_bit_depth": 24,
    "peak_ceiling_db": -1.0,
    "standard": "EBU R128"
  }
}'::jsonb
WHERE is_active = true;
