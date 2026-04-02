-- ============================================================================
-- PROBATIO — Migration 016: Multi-Resolution Segments
-- ============================================================================
-- Adds resolution column to analysis_segments and match_evidence.
-- Existing rows default to 'phrase' (backward compatible with 4s windows).
--
-- Three resolution levels:
--   bar   — 2.0s window, 1.0s hop — catches short melodic hooks, riffs
--   phrase — 8.0s window, 4.0s hop — catches verse/chorus phrase copying
--   song  — full track              — overall structural similarity
-- ============================================================================

-- analysis_segments: resolution level for each segment
ALTER TABLE public.analysis_segments
    ADD COLUMN IF NOT EXISTS resolution VARCHAR(10) DEFAULT 'phrase';

-- match_evidence: resolution level for each evidence point
ALTER TABLE public.match_evidence
    ADD COLUMN IF NOT EXISTS resolution VARCHAR(10) DEFAULT 'phrase';

-- Performance indexes for filtering by resolution
CREATE INDEX IF NOT EXISTS idx_analysis_segments_resolution
    ON public.analysis_segments(analysis_id, resolution);

CREATE INDEX IF NOT EXISTS idx_match_evidence_resolution
    ON public.match_evidence(match_id, resolution);
