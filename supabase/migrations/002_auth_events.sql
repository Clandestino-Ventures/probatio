-- ============================================================================
-- PROBATIO — Migration 002: Auth Events
-- ============================================================================
-- Separate table for authentication audit trail.
-- Kept distinct from chain_of_custody to avoid contaminating the forensic
-- evidence chain with unrelated auth events. In litigation, opposing counsel
-- can't argue that auth noise invalidates the evidence hash chain.
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.auth_events (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id         UUID REFERENCES auth.users (id) ON DELETE SET NULL,
    event           TEXT NOT NULL,
    ip_hash         VARCHAR(64),        -- SHA-256 of IP address, never raw IP
    user_agent      TEXT,               -- Truncated to first 256 chars
    detail          JSONB DEFAULT '{}', -- Additional context (provider, error, etc.)
    created_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Index: lookup by user + chronological order
CREATE INDEX idx_auth_events_user ON public.auth_events (user_id, created_at DESC);

-- Index: lookup by event type for security monitoring
CREATE INDEX idx_auth_events_type ON public.auth_events (event, created_at DESC);

-- RLS: users can only see their own auth events
ALTER TABLE public.auth_events ENABLE ROW LEVEL SECURITY;

CREATE POLICY auth_events_select
    ON public.auth_events FOR SELECT
    USING (auth.uid() = user_id);

-- Service role can insert (auth logging happens server-side)
CREATE POLICY auth_events_insert_service
    ON public.auth_events FOR INSERT
    WITH CHECK (true);

-- IMMUTABLE: no updates or deletes on auth events
CREATE OR REPLACE FUNCTION prevent_auth_event_mutation()
RETURNS TRIGGER AS $$
BEGIN
    RAISE EXCEPTION 'auth_events is immutable. UPDATE and DELETE are prohibited.';
    RETURN NULL;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER tr_auth_events_no_update
    BEFORE UPDATE ON public.auth_events
    FOR EACH ROW EXECUTE FUNCTION prevent_auth_event_mutation();

CREATE TRIGGER tr_auth_events_no_delete
    BEFORE DELETE ON public.auth_events
    FOR EACH ROW EXECUTE FUNCTION prevent_auth_event_mutation();
