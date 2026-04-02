-- ============================================================================
-- PROBATIO — Migration 020: Reproduction Results
-- ============================================================================
-- Tracks deterministic replay of analyses for Daubert compliance.
-- When an analysis is reproduced, each pipeline step's output hash
-- is compared against the original chain of custody hashes.
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.reproduction_results (
    id                      UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    original_analysis_id    UUID NOT NULL,
    reproduced_analysis_id  UUID,
    status                  TEXT NOT NULL DEFAULT 'pending'
        CHECK (status IN ('pending', 'running', 'match', 'mismatch', 'failed')),
    comparisons             JSONB NOT NULL DEFAULT '[]',
    total_steps             INTEGER,
    matching_steps          INTEGER,
    mismatched_steps        INTEGER,
    mismatch_details        JSONB,
    requested_by            UUID NOT NULL,
    requested_at            TIMESTAMPTZ NOT NULL DEFAULT now(),
    completed_at            TIMESTAMPTZ,
    pipeline_version        TEXT
);

CREATE INDEX IF NOT EXISTS idx_reproduction_original
    ON public.reproduction_results(original_analysis_id);

ALTER TABLE public.reproduction_results ENABLE ROW LEVEL SECURITY;

CREATE POLICY repro_select ON public.reproduction_results FOR SELECT
    USING (requested_by = (SELECT auth.uid()));
CREATE POLICY repro_insert ON public.reproduction_results FOR INSERT
    WITH CHECK (requested_by = (SELECT auth.uid()));
CREATE POLICY repro_update ON public.reproduction_results FOR UPDATE
    USING (requested_by = (SELECT auth.uid()));
