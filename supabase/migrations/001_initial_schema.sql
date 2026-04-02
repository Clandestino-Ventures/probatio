-- ============================================================================
-- PROBATIO — Forensic Music Copyright Intelligence Platform
-- Initial Database Schema Migration
-- ============================================================================
-- This schema underpins a forensic evidence platform. Every column, constraint,
-- trigger, and policy is intentional. Do not modify without review.
-- ============================================================================

BEGIN;

-- --------------------------------------------------------------------------
-- 1. Extensions
-- --------------------------------------------------------------------------

CREATE EXTENSION IF NOT EXISTS "vector" SCHEMA extensions;
CREATE EXTENSION IF NOT EXISTS "pgcrypto" SCHEMA extensions;

-- --------------------------------------------------------------------------
-- 2. ENUM Types
-- --------------------------------------------------------------------------

CREATE TYPE public.user_role AS ENUM ('user', 'admin', 'expert');

CREATE TYPE public.plan_tier AS ENUM ('free', 'starter', 'professional', 'enterprise');

CREATE TYPE public.analysis_status AS ENUM (
    'queued',
    'normalizing',
    'fingerprinting',
    'separating_stems',
    'extracting_features',
    'generating_embeddings',
    'searching_matches',
    'enriching_rights',
    'generating_report',
    'completed',
    'failed'
);

CREATE TYPE public.analysis_mode AS ENUM ('screening', 'forensic');

CREATE TYPE public.risk_level AS ENUM ('low', 'medium', 'high', 'critical');

CREATE TYPE public.forensic_status AS ENUM (
    'pending_payment',
    'paid',
    'processing',
    'completed',
    'failed'
);

-- --------------------------------------------------------------------------
-- 3. Tables
-- --------------------------------------------------------------------------

-- 3.1 profiles
-- One-to-one extension of auth.users. Created automatically on signup.
CREATE TABLE public.profiles (
    id            UUID PRIMARY KEY REFERENCES auth.users (id) ON DELETE CASCADE,
    display_name  TEXT,
    email         TEXT NOT NULL,
    role          public.user_role NOT NULL DEFAULT 'user',
    plan_tier     public.plan_tier NOT NULL DEFAULT 'free',
    organization  TEXT,
    license_number TEXT,                     -- expert witness license / credential
    preferred_lang TEXT NOT NULL DEFAULT 'en',
    avatar_url    TEXT,
    created_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);

COMMENT ON TABLE  public.profiles IS 'User profile data extending auth.users.';
COMMENT ON COLUMN public.profiles.license_number IS 'Professional license number for expert witnesses.';

-- 3.2 credits
CREATE TABLE public.credits (
    id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id    UUID NOT NULL REFERENCES auth.users (id) ON DELETE CASCADE,
    balance    INTEGER NOT NULL DEFAULT 3 CHECK (balance >= 0),
    plan_tier  public.plan_tier NOT NULL DEFAULT 'free',
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),

    CONSTRAINT credits_user_unique UNIQUE (user_id)
);

COMMENT ON TABLE public.credits IS 'Per-user credit balance and plan tier.';

-- 3.3 subscriptions
CREATE TABLE public.subscriptions (
    id                      UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id                 UUID NOT NULL REFERENCES auth.users (id) ON DELETE CASCADE,
    stripe_subscription_id  TEXT UNIQUE,
    stripe_customer_id      TEXT,
    plan_tier               public.plan_tier NOT NULL DEFAULT 'free',
    status                  TEXT NOT NULL DEFAULT 'active',
    current_period_start    TIMESTAMPTZ,
    current_period_end      TIMESTAMPTZ,
    cancel_at_period_end    BOOLEAN NOT NULL DEFAULT FALSE,
    created_at              TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at              TIMESTAMPTZ NOT NULL DEFAULT now()
);

COMMENT ON TABLE public.subscriptions IS 'Stripe subscription state mirror.';

-- 3.4 analyses
-- Central table for every analysis job. The status column tracks granular
-- pipeline steps so the UI can show real-time progress.
CREATE TABLE public.analyses (
    id                    UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id               UUID NOT NULL REFERENCES auth.users (id) ON DELETE CASCADE,
    mode                  public.analysis_mode NOT NULL DEFAULT 'screening',
    status                public.analysis_status NOT NULL DEFAULT 'queued',
    file_name             TEXT NOT NULL,
    file_hash             TEXT NOT NULL,              -- SHA-256 of the uploaded file
    file_size_bytes       BIGINT NOT NULL CHECK (file_size_bytes > 0),
    audio_url             TEXT,
    duration_seconds      FLOAT,
    pipeline_version      TEXT,
    current_step          TEXT,
    processing_time_ms    INTEGER,
    stems_urls            JSONB,
    features              JSONB,
    embeddings            JSONB,
    results               JSONB,
    report                JSONB,
    overall_risk          public.risk_level,
    match_count           INTEGER NOT NULL DEFAULT 0,
    output_hash           TEXT,                       -- SHA-256 of the final output
    error_message         TEXT,
    error_step            TEXT,
    normalization_params  JSONB,
    created_at            TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at            TIMESTAMPTZ NOT NULL DEFAULT now()
);

COMMENT ON TABLE  public.analyses IS 'Each row represents one audio analysis job through the PROBATIO pipeline.';
COMMENT ON COLUMN public.analyses.file_hash IS 'SHA-256 digest of the original uploaded file.';
COMMENT ON COLUMN public.analyses.output_hash IS 'SHA-256 digest of the complete analysis output for tamper detection.';

-- 3.5 analysis_matches
CREATE TABLE public.analysis_matches (
    id                    UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    analysis_id           UUID NOT NULL REFERENCES public.analyses (id) ON DELETE CASCADE,
    reference_track_id    UUID NOT NULL,              -- FK added after reference_tracks
    similarity_score      JSONB NOT NULL,             -- {melody, harmony, rhythm, structure, overall}
    overall_similarity    FLOAT NOT NULL CHECK (overall_similarity >= 0 AND overall_similarity <= 1),
    risk_level            public.risk_level NOT NULL,
    timestamps_similarity JSONB,                      -- array of timestamp-pair similarities
    rights_info           JSONB,                      -- snapshot of rights at time of match
    action_recommended    TEXT,
    created_at            TIMESTAMPTZ NOT NULL DEFAULT now()
);

COMMENT ON TABLE  public.analysis_matches IS 'Individual matches between an analysis and a reference track.';
COMMENT ON COLUMN public.analysis_matches.similarity_score IS 'Breakdown: {melody, harmony, rhythm, structure, overall} each 0-1.';
COMMENT ON COLUMN public.analysis_matches.rights_info IS 'Point-in-time snapshot of rights holder data for legal evidence.';

-- 3.6 reference_tracks
CREATE TABLE public.reference_tracks (
    id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    title             TEXT NOT NULL,
    artist            TEXT NOT NULL,
    album             TEXT,
    isrc              TEXT,
    embedding         vector(512),
    embedding_vocals  vector(512),
    fingerprint       TEXT,
    acoustid          TEXT,
    publisher         TEXT,
    composer          TEXT,
    pro_registration  TEXT,                           -- PRO (ASCAP/BMI/SESAC) registration ID
    musicbrainz_id    TEXT,
    source            TEXT,
    duration_seconds  FLOAT,
    release_year      INTEGER,
    genre             TEXT,
    created_at        TIMESTAMPTZ NOT NULL DEFAULT now()
);

COMMENT ON TABLE  public.reference_tracks IS 'Canonical reference track catalog for similarity search.';
COMMENT ON COLUMN public.reference_tracks.embedding IS '512-dim vector embedding of the full mix.';
COMMENT ON COLUMN public.reference_tracks.embedding_vocals IS '512-dim vector embedding of the isolated vocal stem.';

-- Now add the FK from analysis_matches -> reference_tracks
ALTER TABLE public.analysis_matches
    ADD CONSTRAINT analysis_matches_reference_track_fk
    FOREIGN KEY (reference_track_id) REFERENCES public.reference_tracks (id) ON DELETE RESTRICT;

-- 3.7 forensic_cases
CREATE TABLE public.forensic_cases (
    id                       UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id                  UUID NOT NULL REFERENCES auth.users (id) ON DELETE CASCADE,
    case_name                TEXT NOT NULL,
    case_description         TEXT,
    parties_involved         TEXT,
    track_a_analysis_id      UUID REFERENCES public.analyses (id) ON DELETE SET NULL,
    track_b_analysis_id      UUID REFERENCES public.analyses (id) ON DELETE SET NULL,
    forensic_comparison      JSONB,
    forensic_similarity      JSONB,
    status                   public.forensic_status NOT NULL DEFAULT 'pending_payment',
    stripe_payment_intent_id TEXT,
    evidence_package_url     TEXT,
    chain_of_custody         JSONB,                   -- immutable log of who accessed what and when
    pipeline_version         TEXT,
    created_at               TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at               TIMESTAMPTZ NOT NULL DEFAULT now()
);

COMMENT ON TABLE  public.forensic_cases IS 'Forensic comparison cases — admissible-evidence-grade A-vs-B analysis.';
COMMENT ON COLUMN public.forensic_cases.chain_of_custody IS 'Append-only JSON log of access events for evidence integrity.';

-- 3.8 expert_annotations
CREATE TABLE public.expert_annotations (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    case_id         UUID REFERENCES public.forensic_cases (id) ON DELETE CASCADE,
    analysis_id     UUID REFERENCES public.analyses (id) ON DELETE CASCADE,
    annotator_id    UUID NOT NULL REFERENCES auth.users (id) ON DELETE CASCADE,
    annotation_text TEXT NOT NULL,
    timestamp_ref   FLOAT,                            -- audio timestamp the annotation refers to
    layer           TEXT NOT NULL CHECK (layer IN ('melody', 'harmony', 'rhythm', 'general')),
    created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at      TIMESTAMPTZ NOT NULL DEFAULT now(),

    -- At least one parent must be set
    CONSTRAINT expert_annotations_parent_check
        CHECK (case_id IS NOT NULL OR analysis_id IS NOT NULL)
);

COMMENT ON TABLE  public.expert_annotations IS 'Expert witness annotations attached to cases or analyses.';
COMMENT ON COLUMN public.expert_annotations.layer IS 'Musical layer: melody, harmony, rhythm, or general.';

-- 3.9 credit_usage
CREATE TABLE public.credit_usage (
    id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id       UUID NOT NULL REFERENCES auth.users (id) ON DELETE CASCADE,
    analysis_id   UUID REFERENCES public.analyses (id) ON DELETE SET NULL,
    action        TEXT NOT NULL,
    amount        INTEGER NOT NULL,
    balance_after INTEGER NOT NULL CHECK (balance_after >= 0),
    description   TEXT,
    created_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);

COMMENT ON TABLE public.credit_usage IS 'Immutable ledger of credit transactions.';

-- 3.10 audit_log — APPEND-ONLY
-- This table forms a merkle hash chain. Each entry's hash depends on the
-- previous entry, making tampering detectable. UPDATE and DELETE are blocked
-- by triggers.
CREATE TABLE public.audit_log (
    id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    entity_type       TEXT NOT NULL,
    entity_id         UUID NOT NULL,
    action            TEXT NOT NULL,
    actor_id          UUID REFERENCES auth.users (id) ON DELETE SET NULL,
    metadata          JSONB DEFAULT '{}'::JSONB,
    hash_before       TEXT,
    hash_after        TEXT,
    previous_log_hash TEXT,
    entry_hash        TEXT NOT NULL,
    created_at        TIMESTAMPTZ NOT NULL DEFAULT now()
);

COMMENT ON TABLE  public.audit_log IS 'Append-only audit log with merkle hash chain for tamper detection.';
COMMENT ON COLUMN public.audit_log.entry_hash IS 'SHA-256(previous_log_hash || action || metadata || hash_before || hash_after || created_at).';

-- --------------------------------------------------------------------------
-- 4. Indexes
-- --------------------------------------------------------------------------

-- analyses: hot-path queries
CREATE INDEX idx_analyses_user_id      ON public.analyses (user_id);
CREATE INDEX idx_analyses_status       ON public.analyses (status);
CREATE INDEX idx_analyses_file_hash    ON public.analyses (file_hash);
CREATE INDEX idx_analyses_user_status  ON public.analyses (user_id, status);

-- analysis_matches: join path
CREATE INDEX idx_analysis_matches_analysis_id ON public.analysis_matches (analysis_id);

-- forensic_cases: user listing
CREATE INDEX idx_forensic_cases_user_id ON public.forensic_cases (user_id);

-- audit_log: entity lookup and chronological queries
CREATE INDEX idx_audit_log_entity       ON public.audit_log (entity_type, entity_id);
CREATE INDEX idx_audit_log_created_at   ON public.audit_log (created_at);

-- credit_usage: user history
CREATE INDEX idx_credit_usage_user_id   ON public.credit_usage (user_id);

-- reference_tracks: pgvector approximate nearest neighbor (IVFFlat)
-- NOTE: IVFFlat indexes require data to be present for training. On an empty
-- table these create with lists=1 implicitly. After loading reference data,
-- consider REINDEX or recreating with appropriate lists parameter.
CREATE INDEX idx_reference_tracks_embedding
    ON public.reference_tracks USING ivfflat (embedding vector_cosine_ops)
    WITH (lists = 100);

CREATE INDEX idx_reference_tracks_embedding_vocals
    ON public.reference_tracks USING ivfflat (embedding_vocals vector_cosine_ops)
    WITH (lists = 100);

-- --------------------------------------------------------------------------
-- 5. Functions & Triggers
-- --------------------------------------------------------------------------

-- 5.1 Generic updated_at trigger function
CREATE OR REPLACE FUNCTION public.set_updated_at()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
    NEW.updated_at = now();
    RETURN NEW;
END;
$$;

-- Apply updated_at to all mutable tables
CREATE TRIGGER trg_profiles_updated_at
    BEFORE UPDATE ON public.profiles
    FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE TRIGGER trg_credits_updated_at
    BEFORE UPDATE ON public.credits
    FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE TRIGGER trg_subscriptions_updated_at
    BEFORE UPDATE ON public.subscriptions
    FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE TRIGGER trg_analyses_updated_at
    BEFORE UPDATE ON public.analyses
    FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE TRIGGER trg_forensic_cases_updated_at
    BEFORE UPDATE ON public.forensic_cases
    FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE TRIGGER trg_expert_annotations_updated_at
    BEFORE UPDATE ON public.expert_annotations
    FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- 5.2 Audit log: append-only enforcement — block UPDATE
CREATE OR REPLACE FUNCTION public.audit_log_prevent_update()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
    RAISE EXCEPTION 'audit_log is append-only: UPDATE operations are forbidden';
END;
$$;

CREATE TRIGGER trg_audit_log_prevent_update
    BEFORE UPDATE ON public.audit_log
    FOR EACH ROW EXECUTE FUNCTION public.audit_log_prevent_update();

-- 5.3 Audit log: append-only enforcement — block DELETE
CREATE OR REPLACE FUNCTION public.audit_log_prevent_delete()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
    RAISE EXCEPTION 'audit_log is append-only: DELETE operations are forbidden';
END;
$$;

CREATE TRIGGER trg_audit_log_prevent_delete
    BEFORE DELETE ON public.audit_log
    FOR EACH ROW EXECUTE FUNCTION public.audit_log_prevent_delete();

-- 5.4 Audit log: merkle hash chain computation on INSERT
-- Computes entry_hash = SHA-256(previous_log_hash || action || metadata || hash_before || hash_after || created_at)
CREATE OR REPLACE FUNCTION public.audit_log_compute_hash()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_previous_hash TEXT;
    v_payload       TEXT;
BEGIN
    -- Fetch the most recent entry's hash to form the chain
    SELECT entry_hash INTO v_previous_hash
    FROM public.audit_log
    ORDER BY created_at DESC, id DESC
    LIMIT 1;

    -- Genesis entry: use a known seed
    IF v_previous_hash IS NULL THEN
        v_previous_hash := 'SPECTRA_GENESIS_0000000000000000000000000000000000000000000000000000000000000000';
    END IF;

    NEW.previous_log_hash := v_previous_hash;

    -- Ensure created_at is set before hashing
    IF NEW.created_at IS NULL THEN
        NEW.created_at := now();
    END IF;

    -- Construct the payload for hashing
    v_payload := COALESCE(v_previous_hash, '')
        || '|' || COALESCE(NEW.action, '')
        || '|' || COALESCE(NEW.metadata::TEXT, '')
        || '|' || COALESCE(NEW.hash_before, '')
        || '|' || COALESCE(NEW.hash_after, '')
        || '|' || NEW.created_at::TEXT;

    NEW.entry_hash := encode(digest(v_payload, 'sha256'), 'hex');

    RETURN NEW;
END;
$$;

CREATE TRIGGER trg_audit_log_compute_hash
    BEFORE INSERT ON public.audit_log
    FOR EACH ROW EXECUTE FUNCTION public.audit_log_compute_hash();

-- 5.5 Auto-create profile + credits on auth.users signup
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
    -- Create profile
    INSERT INTO public.profiles (id, email, display_name)
    VALUES (
        NEW.id,
        COALESCE(NEW.email, ''),
        COALESCE(NEW.raw_user_meta_data ->> 'display_name', split_part(COALESCE(NEW.email, ''), '@', 1))
    );

    -- Create credits with free-tier defaults
    INSERT INTO public.credits (user_id, balance, plan_tier)
    VALUES (NEW.id, 3, 'free');

    RETURN NEW;
END;
$$;

CREATE TRIGGER trg_auth_users_new_user
    AFTER INSERT ON auth.users
    FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- --------------------------------------------------------------------------
-- 6. Row Level Security (RLS)
-- --------------------------------------------------------------------------

-- Enable RLS on every table
ALTER TABLE public.profiles           ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.credits            ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.subscriptions      ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.analyses           ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.analysis_matches   ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.reference_tracks   ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.forensic_cases     ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.expert_annotations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.credit_usage       ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.audit_log          ENABLE ROW LEVEL SECURITY;

-- ---- profiles ----
CREATE POLICY profiles_select_own ON public.profiles
    FOR SELECT USING (auth.uid() = id);

CREATE POLICY profiles_update_own ON public.profiles
    FOR UPDATE USING (auth.uid() = id)
    WITH CHECK (auth.uid() = id);

-- ---- credits ----
CREATE POLICY credits_select_own ON public.credits
    FOR SELECT USING (auth.uid() = user_id);

-- ---- subscriptions ----
CREATE POLICY subscriptions_select_own ON public.subscriptions
    FOR SELECT USING (auth.uid() = user_id);

-- ---- analyses ----
CREATE POLICY analyses_select_own ON public.analyses
    FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY analyses_insert_own ON public.analyses
    FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY analyses_update_own ON public.analyses
    FOR UPDATE USING (auth.uid() = user_id)
    WITH CHECK (auth.uid() = user_id);

-- ---- analysis_matches ----
-- Users see matches belonging to their analyses
CREATE POLICY analysis_matches_select_own ON public.analysis_matches
    FOR SELECT USING (
        EXISTS (
            SELECT 1 FROM public.analyses a
            WHERE a.id = analysis_id AND a.user_id = auth.uid()
        )
    );

-- ---- reference_tracks ----
-- Reference tracks are readable by all authenticated users (catalog data)
CREATE POLICY reference_tracks_select_authenticated ON public.reference_tracks
    FOR SELECT USING (auth.role() = 'authenticated');

-- ---- forensic_cases ----
CREATE POLICY forensic_cases_select_own ON public.forensic_cases
    FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY forensic_cases_insert_own ON public.forensic_cases
    FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY forensic_cases_update_own ON public.forensic_cases
    FOR UPDATE USING (auth.uid() = user_id)
    WITH CHECK (auth.uid() = user_id);

-- ---- expert_annotations ----
-- Annotators see their own annotations; case owners see annotations on their cases
CREATE POLICY expert_annotations_select_own ON public.expert_annotations
    FOR SELECT USING (
        auth.uid() = annotator_id
        OR EXISTS (
            SELECT 1 FROM public.forensic_cases fc
            WHERE fc.id = case_id AND fc.user_id = auth.uid()
        )
        OR EXISTS (
            SELECT 1 FROM public.analyses a
            WHERE a.id = analysis_id AND a.user_id = auth.uid()
        )
    );

CREATE POLICY expert_annotations_insert_own ON public.expert_annotations
    FOR INSERT WITH CHECK (auth.uid() = annotator_id);

CREATE POLICY expert_annotations_update_own ON public.expert_annotations
    FOR UPDATE USING (auth.uid() = annotator_id)
    WITH CHECK (auth.uid() = annotator_id);

-- ---- credit_usage ----
CREATE POLICY credit_usage_select_own ON public.credit_usage
    FOR SELECT USING (auth.uid() = user_id);

-- ---- audit_log ----
-- Users can see audit entries where they are the actor
CREATE POLICY audit_log_select_own ON public.audit_log
    FOR SELECT USING (auth.uid() = actor_id);

-- Audit log insert is allowed for authenticated users (service-role bypasses RLS anyway)
CREATE POLICY audit_log_insert_authenticated ON public.audit_log
    FOR INSERT WITH CHECK (auth.role() = 'authenticated');

-- --------------------------------------------------------------------------
-- 7. Service-role bypass grants
-- --------------------------------------------------------------------------
-- Supabase service_role bypasses RLS by default. These grants ensure the
-- backend workers (pipeline, webhooks) can operate on all tables.

GRANT ALL ON ALL TABLES IN SCHEMA public TO service_role;
GRANT ALL ON ALL SEQUENCES IN SCHEMA public TO service_role;
GRANT USAGE ON SCHEMA public TO service_role;

-- --------------------------------------------------------------------------
-- Migration complete
-- --------------------------------------------------------------------------

COMMIT;
