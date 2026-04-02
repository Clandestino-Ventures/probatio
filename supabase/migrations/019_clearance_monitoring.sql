-- ============================================================================
-- PROBATIO — Migration 019: Clearance Monitoring
-- ============================================================================
-- Adds continuous monitoring support:
--   - monitoring columns on analyses for weekly re-scan
--   - clearance_alerts table for new match notifications
-- ============================================================================

-- Monitoring columns on analyses
ALTER TABLE public.analyses
    ADD COLUMN IF NOT EXISTS monitoring_enabled BOOLEAN DEFAULT false,
    ADD COLUMN IF NOT EXISTS last_monitored_at TIMESTAMPTZ,
    ADD COLUMN IF NOT EXISTS monitoring_catalog_ids UUID[];

CREATE INDEX IF NOT EXISTS idx_analyses_monitoring
    ON public.analyses(monitoring_enabled, mode)
    WHERE monitoring_enabled = true;

-- Clearance alerts table
CREATE TABLE IF NOT EXISTS public.clearance_alerts (
    id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    analysis_id         UUID NOT NULL,
    user_id             UUID NOT NULL,
    match_id            UUID,
    reference_track_id  UUID,
    alert_type          TEXT NOT NULL
        CHECK (alert_type IN ('new_match', 'score_increase', 'status_change')),
    severity            TEXT NOT NULL
        CHECK (severity IN ('info', 'warning', 'critical')),
    message             TEXT NOT NULL,
    details             JSONB DEFAULT '{}',
    read                BOOLEAN DEFAULT false,
    created_at          TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_clearance_alerts_user
    ON public.clearance_alerts(user_id, read, created_at DESC);

ALTER TABLE public.clearance_alerts ENABLE ROW LEVEL SECURITY;

CREATE POLICY alerts_select ON public.clearance_alerts FOR SELECT
    USING (user_id = (SELECT auth.uid()));
CREATE POLICY alerts_update ON public.clearance_alerts FOR UPDATE
    USING (user_id = (SELECT auth.uid()));
