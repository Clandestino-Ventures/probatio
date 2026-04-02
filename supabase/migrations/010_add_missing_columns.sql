-- ============================================================================
-- PROBATIO — Migration 010: Add Missing Columns
-- ============================================================================
-- Adds columns that the application code writes to but don't exist in the
-- schema yet. These were discovered during the column name audit.
-- ============================================================================

-- analyses: overall_score (float) — pipeline writes the highest match score here
ALTER TABLE public.analyses
    ADD COLUMN IF NOT EXISTS overall_score FLOAT;

-- analyses: progress_pct (integer) — pipeline updates progress percentage
ALTER TABLE public.analyses
    ADD COLUMN IF NOT EXISTS progress_pct INTEGER DEFAULT 0;

-- analysis_matches: score columns that the pipeline writes
-- The pipeline writes score_melody, score_harmony, etc. but the table
-- only has similarity_score (JSONB) and overall_similarity (float).
-- Add the individual score columns the pipeline expects.
ALTER TABLE public.analysis_matches
    ADD COLUMN IF NOT EXISTS score_overall FLOAT,
    ADD COLUMN IF NOT EXISTS score_melody FLOAT,
    ADD COLUMN IF NOT EXISTS score_harmony FLOAT,
    ADD COLUMN IF NOT EXISTS score_rhythm FLOAT,
    ADD COLUMN IF NOT EXISTS score_timbre FLOAT,
    ADD COLUMN IF NOT EXISTS compared_analysis_id UUID;
