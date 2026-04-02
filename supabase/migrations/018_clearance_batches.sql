-- ============================================================================
-- PROBATIO — Migration 018: Clearance Batches
-- ============================================================================
-- Adds batch clearance support: upload multiple tracks, scan all against
-- the same catalog, get a consolidated report.
-- ============================================================================

-- Clearance batches: group multiple clearance analyses together
CREATE TABLE IF NOT EXISTS public.clearance_batches (
    id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id             UUID NOT NULL,
    name                TEXT NOT NULL,
    catalog_ids         UUID[] NOT NULL,
    status              TEXT NOT NULL DEFAULT 'pending'
        CHECK (status IN ('pending', 'processing', 'completed', 'partial', 'failed')),
    track_count         INTEGER NOT NULL DEFAULT 0,
    tracks_completed    INTEGER NOT NULL DEFAULT 0,
    tracks_cleared      INTEGER NOT NULL DEFAULT 0,
    tracks_conditional  INTEGER NOT NULL DEFAULT 0,
    tracks_blocked      INTEGER NOT NULL DEFAULT 0,
    overall_verdict     TEXT
        CHECK (overall_verdict IN ('cleared', 'conditional', 'blocked')),
    credits_used        INTEGER NOT NULL DEFAULT 0,
    created_at          TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at          TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_clearance_batches_user
    ON public.clearance_batches(user_id);

ALTER TABLE public.clearance_batches ENABLE ROW LEVEL SECURITY;

CREATE POLICY batches_select ON public.clearance_batches FOR SELECT
    USING (user_id = (SELECT auth.uid()));
CREATE POLICY batches_insert ON public.clearance_batches FOR INSERT
    WITH CHECK (user_id = (SELECT auth.uid()));
CREATE POLICY batches_update ON public.clearance_batches FOR UPDATE
    USING (user_id = (SELECT auth.uid()));

-- Add batch_id to analyses table for grouping
ALTER TABLE public.analyses
    ADD COLUMN IF NOT EXISTS batch_id UUID;

CREATE INDEX IF NOT EXISTS idx_analyses_batch
    ON public.analyses(batch_id);
