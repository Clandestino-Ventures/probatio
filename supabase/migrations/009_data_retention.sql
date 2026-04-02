-- ============================================================================
-- PROBATIO — Migration 009: Data Retention Enforcement
-- ============================================================================
-- Adds retention tracking to analyses and forensic cases.
-- Audio files are deleted after 90 days (configurable per org).
-- Forensic case audio is never auto-deleted — only manually archived.
-- Every deletion is documented in the chain of custody.
-- ============================================================================

-- ────────────────────────────────────────────────────────────────────────────
-- 1. analyses: Add retention tracking columns
-- ────────────────────────────────────────────────────────────────────────────

ALTER TABLE public.analyses
    ADD COLUMN IF NOT EXISTS audio_expires_at TIMESTAMPTZ,
    ADD COLUMN IF NOT EXISTS audio_deleted_at TIMESTAMPTZ,
    ADD COLUMN IF NOT EXISTS deletion_notified BOOLEAN DEFAULT false,
    ADD COLUMN IF NOT EXISTS deletion_notification_sent_at TIMESTAMPTZ;

CREATE INDEX IF NOT EXISTS idx_analyses_expiry
    ON public.analyses(audio_expires_at)
    WHERE audio_expires_at IS NOT NULL AND audio_deleted_at IS NULL;

CREATE INDEX IF NOT EXISTS idx_analyses_notify
    ON public.analyses(audio_expires_at, deletion_notified)
    WHERE deletion_notified = false AND audio_deleted_at IS NULL;

-- ────────────────────────────────────────────────────────────────────────────
-- 2. organizations: Add configurable retention period
-- ────────────────────────────────────────────────────────────────────────────

ALTER TABLE public.organizations
    ADD COLUMN IF NOT EXISTS retention_days INTEGER NOT NULL DEFAULT 90
        CHECK (retention_days BETWEEN 7 AND 365);

-- ────────────────────────────────────────────────────────────────────────────
-- 3. forensic_cases: Add archiving fields
-- ────────────────────────────────────────────────────────────────────────────

ALTER TABLE public.forensic_cases
    ADD COLUMN IF NOT EXISTS archived_at TIMESTAMPTZ,
    ADD COLUMN IF NOT EXISTS archived_by UUID,
    ADD COLUMN IF NOT EXISTS audio_deleted_at TIMESTAMPTZ;

-- ────────────────────────────────────────────────────────────────────────────
-- 4. Make audio_url nullable (needed for deletion)
-- ────────────────────────────────────────────────────────────────────────────

ALTER TABLE public.analyses ALTER COLUMN audio_url DROP NOT NULL;
