-- ============================================================================
-- PROBATIO — Migration 004: Match Evidence
-- ============================================================================
-- Segment-to-segment evidence points for each analysis match.
-- "At 1:23 in Track A, the vocal melody matches Track B at 0:45
-- with 0.94 similarity, transposed +2 semitones."
-- This is what makes Probatio evidence court-admissible.
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.match_evidence (
    id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    match_id            UUID NOT NULL REFERENCES public.analysis_matches(id) ON DELETE CASCADE,
    source_start_sec    REAL NOT NULL,
    source_end_sec      REAL NOT NULL,
    source_segment_id   UUID REFERENCES public.analysis_segments(id),
    target_start_sec    REAL NOT NULL,
    target_end_sec      REAL NOT NULL,
    dimension           match_dimension NOT NULL,
    stem_type           stem_type,
    similarity_score    REAL NOT NULL CHECK (similarity_score BETWEEN 0 AND 1),
    detail              JSONB DEFAULT '{}',
    description         TEXT,
    created_at          TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_evidence_match
    ON public.match_evidence(match_id);

CREATE INDEX IF NOT EXISTS idx_evidence_dimension
    ON public.match_evidence(dimension);

-- RLS
ALTER TABLE public.match_evidence ENABLE ROW LEVEL SECURITY;

CREATE POLICY evidence_select ON public.match_evidence FOR SELECT
    USING (EXISTS (
        SELECT 1 FROM public.analysis_matches am
        JOIN public.analyses a ON a.id = am.analysis_id
        WHERE am.id = match_evidence.match_id
        AND a.user_id = auth.uid()
    ));

CREATE POLICY evidence_insert_service ON public.match_evidence FOR INSERT
    WITH CHECK (true);

CREATE POLICY evidence_delete_service ON public.match_evidence FOR DELETE
    USING (true);
