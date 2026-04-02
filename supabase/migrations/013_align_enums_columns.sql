-- ============================================================================
-- PROBATIO — Migration 013: Align Enums & Column References
-- ============================================================================
-- The application code uses status/risk values that differ from the original
-- enum definitions. This migration adds the missing values so both old and
-- new values are valid. Postgres enums only support ADD VALUE (not rename/remove),
-- so both sets coexist.
-- ============================================================================

-- ── analysis_status: add short-form values used by pipeline code ─────────
ALTER TYPE public.analysis_status ADD VALUE IF NOT EXISTS 'pending';
ALTER TYPE public.analysis_status ADD VALUE IF NOT EXISTS 'uploading';
ALTER TYPE public.analysis_status ADD VALUE IF NOT EXISTS 'separating';
ALTER TYPE public.analysis_status ADD VALUE IF NOT EXISTS 'extracting';
ALTER TYPE public.analysis_status ADD VALUE IF NOT EXISTS 'matching';
ALTER TYPE public.analysis_status ADD VALUE IF NOT EXISTS 'classifying';

-- ── forensic_status: add values used by UI and webhook code ──────────────
ALTER TYPE public.forensic_status ADD VALUE IF NOT EXISTS 'intake';
ALTER TYPE public.forensic_status ADD VALUE IF NOT EXISTS 'in_review';
ALTER TYPE public.forensic_status ADD VALUE IF NOT EXISTS 'expert_assigned';
ALTER TYPE public.forensic_status ADD VALUE IF NOT EXISTS 'analysis_complete';
ALTER TYPE public.forensic_status ADD VALUE IF NOT EXISTS 'report_generated';
ALTER TYPE public.forensic_status ADD VALUE IF NOT EXISTS 'closed';

-- ── risk_level: add "moderate" used by risk-classifier code ──────────────
ALTER TYPE public.risk_level ADD VALUE IF NOT EXISTS 'moderate';

-- ── audit_log: add user_id alias for actor_id ────────────────────────────
-- Some code paths use user_id instead of actor_id. Rather than changing all
-- call sites, add a generated column that mirrors actor_id.
-- NOTE: This is a compatibility shim. New code should use actor_id directly.
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public'
    AND table_name = 'audit_log'
    AND column_name = 'user_id'
  ) THEN
    -- Add user_id as a nullable column that defaults to NULL.
    -- The audit_log_compute_hash trigger already handles insert-time logic.
    ALTER TABLE public.audit_log ADD COLUMN user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL;

    -- Copy existing actor_id values into user_id.
    UPDATE public.audit_log SET user_id = actor_id WHERE actor_id IS NOT NULL;

    -- Create a trigger to keep them in sync on INSERT.
    CREATE OR REPLACE FUNCTION public.audit_log_sync_user_id()
    RETURNS TRIGGER AS $fn$
    BEGIN
      -- If user_id is provided but actor_id is not, copy to actor_id.
      IF NEW.actor_id IS NULL AND NEW.user_id IS NOT NULL THEN
        NEW.actor_id := NEW.user_id;
      END IF;
      -- Always sync user_id from actor_id.
      IF NEW.actor_id IS NOT NULL THEN
        NEW.user_id := NEW.actor_id;
      END IF;
      RETURN NEW;
    END;
    $fn$ LANGUAGE plpgsql;

    CREATE TRIGGER trg_audit_log_sync_user_id
      BEFORE INSERT ON public.audit_log
      FOR EACH ROW EXECUTE FUNCTION public.audit_log_sync_user_id();
  END IF;
END $$;

-- ── credits: add lifetime tracking columns if missing ────────────────────
ALTER TABLE public.credits
  ADD COLUMN IF NOT EXISTS lifetime_purchased INTEGER DEFAULT 0,
  ADD COLUMN IF NOT EXISTS lifetime_used INTEGER DEFAULT 0,
  ADD COLUMN IF NOT EXISTS last_replenished_at TIMESTAMPTZ;
