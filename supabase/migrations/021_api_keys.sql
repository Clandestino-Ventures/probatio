-- ============================================================================
-- PROBATIO — Migration 021: API Keys
-- ============================================================================
-- Programmatic access for Enterprise orgs. Keys are SHA-256 hashed
-- before storage — the plaintext key is shown ONCE on creation.
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.api_keys (
    id                      UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    organization_id         UUID NOT NULL,
    key_prefix              VARCHAR(12) NOT NULL,
    key_hash                VARCHAR(128) NOT NULL,
    name                    TEXT NOT NULL,
    description             TEXT,
    permissions             TEXT[] NOT NULL DEFAULT '{analyze}',
    rate_limit_per_minute   INTEGER NOT NULL DEFAULT 30,
    rate_limit_per_day      INTEGER NOT NULL DEFAULT 1000,
    is_active               BOOLEAN NOT NULL DEFAULT true,
    last_used_at            TIMESTAMPTZ,
    total_requests          INTEGER NOT NULL DEFAULT 0,
    created_by              UUID NOT NULL,
    created_at              TIMESTAMPTZ NOT NULL DEFAULT now(),
    expires_at              TIMESTAMPTZ,
    revoked_at              TIMESTAMPTZ,
    revoked_by              UUID
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_api_keys_hash
    ON public.api_keys(key_hash);

CREATE INDEX IF NOT EXISTS idx_api_keys_org
    ON public.api_keys(organization_id, is_active);

ALTER TABLE public.api_keys ENABLE ROW LEVEL SECURITY;

-- Only org admins/owners can see keys
CREATE POLICY api_keys_select ON public.api_keys FOR SELECT
    USING (
        organization_id IN (
            SELECT organization_id FROM public.organization_members
            WHERE user_id = (SELECT auth.uid())
            AND role IN ('admin', 'owner')
        )
    );

CREATE POLICY api_keys_insert ON public.api_keys FOR INSERT
    WITH CHECK (
        organization_id IN (
            SELECT organization_id FROM public.organization_members
            WHERE user_id = (SELECT auth.uid())
            AND role IN ('admin', 'owner')
        )
    );

CREATE POLICY api_keys_update ON public.api_keys FOR UPDATE
    USING (
        organization_id IN (
            SELECT organization_id FROM public.organization_members
            WHERE user_id = (SELECT auth.uid())
            AND role IN ('admin', 'owner')
        )
    );
