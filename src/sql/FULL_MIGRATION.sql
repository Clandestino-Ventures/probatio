-- ╔══════════════════════════════════════════════════════════════════════════════╗
-- ║  SPECTRA — Full Database Migration (Concatenated)                          ║
-- ║  Generated: 2026-03-19                                                     ║
-- ║                                                                            ║
-- ║  Source files (9 migrations, 1407 lines):                                  ║
-- ║    001_initial_schema.sql                                                  ║
-- ║    002_auth_events.sql                                                     ║
-- ║    003_spectral_signatures_segments_rpc.sql                                ║
-- ║    004_match_evidence.sql                                                  ║
-- ║    005_reference_library_layers.sql                                        ║
-- ║    006_normalization_forensic.sql                                          ║
-- ║    007_pipeline_versions_reproducibility.sql                               ║
-- ║    008_organizations_isolation.sql                                         ║
-- ║    009_data_retention.sql                                                  ║
-- ║                                                                            ║
-- ║  IMPORTANT: Run these in order against a fresh Supabase project.           ║
-- ║  Migration 006 references pipeline_versions (created in 007).              ║
-- ║  If running as a single script, swap 006 and 007 or run 007 first.        ║
-- ╚══════════════════════════════════════════════════════════════════════════════╝


-- ============================================================================
-- Migration 001: Initial Schema
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
CREATE TABLE public.profiles (
    id            UUID PRIMARY KEY REFERENCES auth.users (id) ON DELETE CASCADE,
    display_name  TEXT,
    email         TEXT NOT NULL,
    role          public.user_role NOT NULL DEFAULT 'user',
    plan_tier     public.plan_tier NOT NULL DEFAULT 'free',
    organization  TEXT,
    license_number TEXT,
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
CREATE TABLE public.analyses (
    id                    UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id               UUID NOT NULL REFERENCES auth.users (id) ON DELETE CASCADE,
    mode                  public.analysis_mode NOT NULL DEFAULT 'screening',
    status                public.analysis_status NOT NULL DEFAULT 'queued',
    file_name             TEXT NOT NULL,
    file_hash             TEXT NOT NULL,
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
    output_hash           TEXT,
    error_message         TEXT,
    error_step            TEXT,
    normalization_params  JSONB,
    created_at            TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at            TIMESTAMPTZ NOT NULL DEFAULT now()
);

COMMENT ON TABLE  public.analyses IS 'Each row represents one audio analysis job through the SPECTRA pipeline.';
COMMENT ON COLUMN public.analyses.file_hash IS 'SHA-256 digest of the original uploaded file.';
COMMENT ON COLUMN public.analyses.output_hash IS 'SHA-256 digest of the complete analysis output for tamper detection.';

-- 3.5 analysis_matches
CREATE TABLE public.analysis_matches (
    id                    UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    analysis_id           UUID NOT NULL REFERENCES public.analyses (id) ON DELETE CASCADE,
    reference_track_id    UUID NOT NULL,
    similarity_score      JSONB NOT NULL,
    overall_similarity    FLOAT NOT NULL CHECK (overall_similarity >= 0 AND overall_similarity <= 1),
    risk_level            public.risk_level NOT NULL,
    timestamps_similarity JSONB,
    rights_info           JSONB,
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
    pro_registration  TEXT,
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
    chain_of_custody         JSONB,
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
    timestamp_ref   FLOAT,
    layer           TEXT NOT NULL CHECK (layer IN ('melody', 'harmony', 'rhythm', 'general')),
    created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at      TIMESTAMPTZ NOT NULL DEFAULT now(),

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

CREATE INDEX idx_analyses_user_id      ON public.analyses (user_id);
CREATE INDEX idx_analyses_status       ON public.analyses (status);
CREATE INDEX idx_analyses_file_hash    ON public.analyses (file_hash);
CREATE INDEX idx_analyses_user_status  ON public.analyses (user_id, status);

CREATE INDEX idx_analysis_matches_analysis_id ON public.analysis_matches (analysis_id);

CREATE INDEX idx_forensic_cases_user_id ON public.forensic_cases (user_id);

CREATE INDEX idx_audit_log_entity       ON public.audit_log (entity_type, entity_id);
CREATE INDEX idx_audit_log_created_at   ON public.audit_log (created_at);

CREATE INDEX idx_credit_usage_user_id   ON public.credit_usage (user_id);

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
    SELECT entry_hash INTO v_previous_hash
    FROM public.audit_log
    ORDER BY created_at DESC, id DESC
    LIMIT 1;

    IF v_previous_hash IS NULL THEN
        v_previous_hash := 'SPECTRA_GENESIS_0000000000000000000000000000000000000000000000000000000000000000';
    END IF;

    NEW.previous_log_hash := v_previous_hash;

    IF NEW.created_at IS NULL THEN
        NEW.created_at := now();
    END IF;

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
    INSERT INTO public.profiles (id, email, display_name)
    VALUES (
        NEW.id,
        COALESCE(NEW.email, ''),
        COALESCE(NEW.raw_user_meta_data ->> 'display_name', split_part(COALESCE(NEW.email, ''), '@', 1))
    );

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

CREATE POLICY profiles_select_own ON public.profiles
    FOR SELECT USING (auth.uid() = id);

CREATE POLICY profiles_update_own ON public.profiles
    FOR UPDATE USING (auth.uid() = id)
    WITH CHECK (auth.uid() = id);

CREATE POLICY credits_select_own ON public.credits
    FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY subscriptions_select_own ON public.subscriptions
    FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY analyses_select_own ON public.analyses
    FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY analyses_insert_own ON public.analyses
    FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY analyses_update_own ON public.analyses
    FOR UPDATE USING (auth.uid() = user_id)
    WITH CHECK (auth.uid() = user_id);

CREATE POLICY analysis_matches_select_own ON public.analysis_matches
    FOR SELECT USING (
        EXISTS (
            SELECT 1 FROM public.analyses a
            WHERE a.id = analysis_id AND a.user_id = auth.uid()
        )
    );

CREATE POLICY reference_tracks_select_authenticated ON public.reference_tracks
    FOR SELECT USING (auth.role() = 'authenticated');

CREATE POLICY forensic_cases_select_own ON public.forensic_cases
    FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY forensic_cases_insert_own ON public.forensic_cases
    FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY forensic_cases_update_own ON public.forensic_cases
    FOR UPDATE USING (auth.uid() = user_id)
    WITH CHECK (auth.uid() = user_id);

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

CREATE POLICY credit_usage_select_own ON public.credit_usage
    FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY audit_log_select_own ON public.audit_log
    FOR SELECT USING (auth.uid() = actor_id);

CREATE POLICY audit_log_insert_authenticated ON public.audit_log
    FOR INSERT WITH CHECK (auth.role() = 'authenticated');

-- --------------------------------------------------------------------------
-- 7. Service-role bypass grants
-- --------------------------------------------------------------------------

GRANT ALL ON ALL TABLES IN SCHEMA public TO service_role;
GRANT ALL ON ALL SEQUENCES IN SCHEMA public TO service_role;
GRANT USAGE ON SCHEMA public TO service_role;

COMMIT;


-- ============================================================================
-- Migration 002: Auth Events
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.auth_events (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id         UUID REFERENCES auth.users (id) ON DELETE SET NULL,
    event           TEXT NOT NULL,
    ip_hash         VARCHAR(64),
    user_agent      TEXT,
    detail          JSONB DEFAULT '{}',
    created_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_auth_events_user ON public.auth_events (user_id, created_at DESC);
CREATE INDEX idx_auth_events_type ON public.auth_events (event, created_at DESC);

ALTER TABLE public.auth_events ENABLE ROW LEVEL SECURITY;

CREATE POLICY auth_events_select
    ON public.auth_events FOR SELECT
    USING (auth.uid() = user_id);

CREATE POLICY auth_events_insert_service
    ON public.auth_events FOR INSERT
    WITH CHECK (true);

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


-- ============================================================================
-- Migration 003: Spectral Signatures, Analysis Segments, Vector RPC
-- ============================================================================

DO $$ BEGIN
  CREATE TYPE match_dimension AS ENUM ('melody', 'harmony', 'rhythm', 'timbre', 'lyrics', 'structure');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE stem_type AS ENUM ('vocals', 'bass', 'drums', 'other');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

CREATE TABLE IF NOT EXISTS public.spectral_signatures (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    analysis_id     UUID NOT NULL REFERENCES public.analyses(id) ON DELETE CASCADE,
    dimension       match_dimension NOT NULL,
    stem_type       stem_type,
    embedding       vector(512) NOT NULL,
    model_used      TEXT NOT NULL,
    confidence      REAL,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_spectral_embedding
    ON public.spectral_signatures
    USING hnsw (embedding vector_cosine_ops)
    WITH (m = 16, ef_construction = 64);

CREATE INDEX IF NOT EXISTS idx_spectral_analysis
    ON public.spectral_signatures(analysis_id);

CREATE INDEX IF NOT EXISTS idx_spectral_dimension
    ON public.spectral_signatures(dimension);

ALTER TABLE public.spectral_signatures ENABLE ROW LEVEL SECURITY;

CREATE POLICY spectral_select ON public.spectral_signatures FOR SELECT
    USING (EXISTS (
        SELECT 1 FROM public.analyses
        WHERE analyses.id = spectral_signatures.analysis_id
        AND analyses.user_id = auth.uid()
    ));

CREATE POLICY spectral_insert_service ON public.spectral_signatures FOR INSERT
    WITH CHECK (true);

CREATE POLICY spectral_delete_service ON public.spectral_signatures FOR DELETE
    USING (true);

CREATE TABLE IF NOT EXISTS public.analysis_segments (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    analysis_id     UUID NOT NULL REFERENCES public.analyses(id) ON DELETE CASCADE,
    start_sec       REAL NOT NULL,
    end_sec         REAL NOT NULL,
    segment_index   INTEGER NOT NULL,
    label           TEXT,
    pitch_contour   JSONB,
    chroma_vector   JSONB,
    onset_density   REAL,
    rms_energy      REAL,
    embedding       vector(512),
    stem_type       stem_type,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_segments_embedding
    ON public.analysis_segments
    USING hnsw (embedding vector_cosine_ops)
    WITH (m = 16, ef_construction = 64);

CREATE INDEX IF NOT EXISTS idx_segments_analysis
    ON public.analysis_segments(analysis_id, segment_index);

ALTER TABLE public.analysis_segments ENABLE ROW LEVEL SECURITY;

CREATE POLICY segments_select ON public.analysis_segments FOR SELECT
    USING (EXISTS (
        SELECT 1 FROM public.analyses
        WHERE analyses.id = analysis_segments.analysis_id
        AND analyses.user_id = auth.uid()
    ));

CREATE POLICY segments_insert_service ON public.analysis_segments FOR INSERT
    WITH CHECK (true);

CREATE POLICY segments_delete_service ON public.analysis_segments FOR DELETE
    USING (true);

CREATE POLICY segments_update_service ON public.analysis_segments FOR UPDATE
    USING (true);

-- RPC: match_by_dimension
CREATE OR REPLACE FUNCTION match_by_dimension(
    query_embedding vector(512),
    query_dimension match_dimension,
    exclude_analysis_id UUID,
    match_threshold FLOAT DEFAULT 0.3,
    match_count INT DEFAULT 20
)
RETURNS TABLE (
    analysis_id UUID,
    dimension match_dimension,
    similarity FLOAT
)
LANGUAGE sql STABLE
AS $$
    SELECT
        ss.analysis_id,
        ss.dimension,
        1 - (ss.embedding <=> query_embedding) AS similarity
    FROM public.spectral_signatures ss
    WHERE
        ss.dimension = query_dimension
        AND ss.analysis_id != exclude_analysis_id
        AND 1 - (ss.embedding <=> query_embedding) > match_threshold
    ORDER BY ss.embedding <=> query_embedding
    LIMIT match_count;
$$;

-- RPC: match_reference_tracks
CREATE OR REPLACE FUNCTION match_reference_tracks(
    query_embedding vector(512),
    match_threshold FLOAT DEFAULT 0.3,
    match_count INT DEFAULT 10
)
RETURNS TABLE (
    id UUID,
    title TEXT,
    artist TEXT,
    album TEXT,
    isrc VARCHAR(12),
    musicbrainz_id TEXT,
    similarity FLOAT
)
LANGUAGE sql STABLE
AS $$
    SELECT
        rt.id, rt.title, rt.artist, rt.album, rt.isrc, rt.musicbrainz_id,
        1 - (rt.embedding <=> query_embedding) AS similarity
    FROM public.reference_tracks rt
    WHERE
        rt.embedding IS NOT NULL
        AND 1 - (rt.embedding <=> query_embedding) > match_threshold
    ORDER BY rt.embedding <=> query_embedding
    LIMIT match_count;
$$;

-- RPC: match_segments
CREATE OR REPLACE FUNCTION match_segments(
    query_embedding vector(512),
    exclude_analysis_id UUID,
    match_threshold FLOAT DEFAULT 0.5,
    match_count INT DEFAULT 20
)
RETURNS TABLE (
    segment_id UUID,
    analysis_id UUID,
    segment_index INTEGER,
    start_sec REAL,
    end_sec REAL,
    similarity FLOAT
)
LANGUAGE sql STABLE
AS $$
    SELECT
        seg.id AS segment_id,
        seg.analysis_id,
        seg.segment_index,
        seg.start_sec,
        seg.end_sec,
        1 - (seg.embedding <=> query_embedding) AS similarity
    FROM public.analysis_segments seg
    WHERE
        seg.analysis_id != exclude_analysis_id
        AND seg.embedding IS NOT NULL
        AND 1 - (seg.embedding <=> query_embedding) > match_threshold
    ORDER BY seg.embedding <=> query_embedding
    LIMIT match_count;
$$;


-- ============================================================================
-- Migration 004: Match Evidence
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


-- ============================================================================
-- Migration 005: Reference Library Two-Layer Strategy
-- ============================================================================

ALTER TABLE public.reference_tracks
  ADD COLUMN IF NOT EXISTS visibility TEXT NOT NULL DEFAULT 'public'
    CHECK (visibility IN ('public', 'enterprise', 'private')),
  ADD COLUMN IF NOT EXISTS organization_id UUID,
  ADD COLUMN IF NOT EXISTS contributed_by UUID,
  ADD COLUMN IF NOT EXISTS catalog_id UUID;

CREATE INDEX IF NOT EXISTS idx_ref_tracks_visibility
  ON public.reference_tracks(visibility);
CREATE INDEX IF NOT EXISTS idx_ref_tracks_org
  ON public.reference_tracks(organization_id) WHERE organization_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_ref_tracks_source
  ON public.reference_tracks(source);
CREATE INDEX IF NOT EXISTS idx_ref_tracks_acoustid
  ON public.reference_tracks(acoustid) WHERE acoustid IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_ref_tracks_musicbrainz
  ON public.reference_tracks(musicbrainz_id) WHERE musicbrainz_id IS NOT NULL;

DROP POLICY IF EXISTS reference_tracks_select_authenticated ON public.reference_tracks;

CREATE POLICY ref_tracks_select_visible ON public.reference_tracks FOR SELECT USING (
  visibility = 'public'
  OR (visibility = 'enterprise' AND organization_id IN (
    SELECT id FROM public.profiles WHERE id = auth.uid()
  ))
  OR (visibility = 'private' AND contributed_by = auth.uid())
);

CREATE POLICY ref_tracks_insert_service ON public.reference_tracks FOR INSERT
  WITH CHECK (true);
CREATE POLICY ref_tracks_update_service ON public.reference_tracks FOR UPDATE
  USING (true);

CREATE TABLE IF NOT EXISTS public.enterprise_catalogs (
  id                      UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id         UUID NOT NULL,
  name                    TEXT NOT NULL,
  description             TEXT,
  track_count             INTEGER NOT NULL DEFAULT 0,
  tracks_with_embeddings  INTEGER NOT NULL DEFAULT 0,
  status                  TEXT NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending', 'ingesting', 'completed', 'failed')),
  ingestion_progress      JSONB DEFAULT '{}'::JSONB,
  estimated_cost_cents    INTEGER,
  actual_cost_cents       INTEGER,
  created_at              TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at              TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_catalogs_org ON public.enterprise_catalogs(organization_id);

ALTER TABLE public.enterprise_catalogs ENABLE ROW LEVEL SECURITY;

CREATE POLICY catalogs_select ON public.enterprise_catalogs FOR SELECT
  USING (organization_id = auth.uid());
CREATE POLICY catalogs_insert ON public.enterprise_catalogs FOR INSERT
  WITH CHECK (organization_id = auth.uid());
CREATE POLICY catalogs_update ON public.enterprise_catalogs FOR UPDATE
  USING (organization_id = auth.uid());
CREATE POLICY catalogs_insert_service ON public.enterprise_catalogs FOR INSERT
  WITH CHECK (true);
CREATE POLICY catalogs_update_service ON public.enterprise_catalogs FOR UPDATE
  USING (true);

ALTER TABLE public.reference_tracks
  ADD CONSTRAINT fk_ref_tracks_catalog
  FOREIGN KEY (catalog_id) REFERENCES public.enterprise_catalogs(id) ON DELETE SET NULL;

CREATE TRIGGER tr_catalogs_updated
  BEFORE UPDATE ON public.enterprise_catalogs FOR EACH ROW
  EXECUTE FUNCTION public.set_updated_at();

ALTER TABLE public.analyses
  ADD COLUMN IF NOT EXISTS identified_track JSONB;

ALTER TABLE public.analysis_matches
  ADD COLUMN IF NOT EXISTS match_source TEXT DEFAULT 'embedding'
    CHECK (match_source IN ('fingerprint', 'embedding', 'both', 'cross_analysis'));

ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS library_opt_in BOOLEAN NOT NULL DEFAULT true;

-- RPC: Visibility-aware reference track search
CREATE OR REPLACE FUNCTION match_reference_tracks_with_visibility(
  query_embedding vector(512),
  match_threshold FLOAT DEFAULT 0.3,
  match_count INT DEFAULT 10,
  visibility_filter TEXT DEFAULT 'public',
  org_id UUID DEFAULT NULL
)
RETURNS TABLE (
  id UUID,
  title TEXT,
  artist TEXT,
  album TEXT,
  isrc TEXT,
  musicbrainz_id TEXT,
  similarity FLOAT,
  visibility TEXT,
  source TEXT
)
LANGUAGE sql STABLE
AS $$
  SELECT
    rt.id, rt.title, rt.artist, rt.album, rt.isrc,
    rt.musicbrainz_id,
    1 - (rt.embedding <=> query_embedding) AS similarity,
    rt.visibility,
    rt.source
  FROM public.reference_tracks rt
  WHERE
    rt.embedding IS NOT NULL
    AND 1 - (rt.embedding <=> query_embedding) > match_threshold
    AND (
      (visibility_filter = 'public' AND rt.visibility = 'public')
      OR (visibility_filter = 'enterprise' AND rt.visibility = 'enterprise'
          AND rt.organization_id = org_id)
      OR (visibility_filter = 'all' AND (
        rt.visibility = 'public'
        OR (rt.visibility = 'enterprise' AND rt.organization_id = org_id)
      ))
    )
  ORDER BY rt.embedding <=> query_embedding
  LIMIT match_count;
$$;


-- ============================================================================
-- Migration 007: Pipeline Versions + Reproducibility
-- (Run BEFORE 006 which references pipeline_versions)
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.pipeline_versions (
    id                    UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    version_tag           TEXT NOT NULL UNIQUE,
    demucs_model          TEXT NOT NULL,
    demucs_version        TEXT NOT NULL,
    crepe_model           TEXT NOT NULL,
    crepe_version         TEXT NOT NULL,
    clap_model            TEXT NOT NULL,
    clap_version          TEXT NOT NULL,
    librosa_version       TEXT NOT NULL,
    llm_model             TEXT NOT NULL,
    params                JSONB NOT NULL DEFAULT '{}'::JSONB,
    is_active             BOOLEAN NOT NULL DEFAULT false,
    description           TEXT,
    modal_image_digest    JSONB DEFAULT '{}'::JSONB,
    weight_archive_urls   JSONB DEFAULT '{}'::JSONB,
    test_corpus_hash      VARCHAR(64),
    verified_reproducible BOOLEAN DEFAULT false,
    verified_at           TIMESTAMPTZ,
    reproducibility_notes TEXT,
    created_at            TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_pipeline_versions_active
    ON public.pipeline_versions(is_active) WHERE is_active = true;

ALTER TABLE public.pipeline_versions ENABLE ROW LEVEL SECURITY;

CREATE POLICY pipeline_versions_select ON public.pipeline_versions
    FOR SELECT USING (auth.role() = 'authenticated');

CREATE POLICY pipeline_versions_insert_service ON public.pipeline_versions
    FOR INSERT WITH CHECK (true);
CREATE POLICY pipeline_versions_update_service ON public.pipeline_versions
    FOR UPDATE USING (true);

INSERT INTO public.pipeline_versions (
    version_tag, demucs_model, demucs_version, crepe_model, crepe_version,
    clap_model, clap_version, librosa_version, llm_model, params,
    is_active, description
) VALUES (
    'v1.0.0-alpha',
    'htdemucs_ft', 'v4.0.1',
    'full', 'v0.0.16',
    'HTSAT-tiny', 'laion/clap-htsat-unfused',
    '0.10.1',
    'claude-sonnet-4-20250514',
    '{
      "crepe_step_size": 10,
      "crepe_confidence_threshold": 0.7,
      "clap_embedding_dim": 512,
      "similarity_threshold": 0.3,
      "risk_thresholds": {"low": 0.1, "moderate": 0.3, "high": 0.6, "critical": 0.85},
      "dtw_window_size": 50,
      "chroma_hop_length": 512,
      "segment_duration_sec": 4,
      "max_matches_returned": 10,
      "normalization": {
        "target_lufs": -14.0,
        "target_sample_rate": 44100,
        "target_channels": 1,
        "target_bit_depth": 24,
        "peak_ceiling_db": -1.0,
        "standard": "EBU R128"
      }
    }'::jsonb,
    true,
    'Initial Spectra pipeline for alpha release'
) ON CONFLICT (version_tag) DO NOTHING;

-- Immutability trigger
CREATE OR REPLACE FUNCTION public.prevent_pipeline_version_mutation()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    usage_count INTEGER;
BEGIN
    SELECT COUNT(*) INTO usage_count
    FROM public.analyses
    WHERE pipeline_version = OLD.version_tag;

    IF usage_count > 0 THEN
        IF NEW.version_tag != OLD.version_tag
           OR NEW.demucs_model != OLD.demucs_model
           OR NEW.demucs_version != OLD.demucs_version
           OR NEW.crepe_model != OLD.crepe_model
           OR NEW.crepe_version != OLD.crepe_version
           OR NEW.clap_model != OLD.clap_model
           OR NEW.clap_version != OLD.clap_version
           OR NEW.librosa_version != OLD.librosa_version
           OR NEW.llm_model != OLD.llm_model
           OR NEW.params::TEXT != OLD.params::TEXT
        THEN
            RAISE EXCEPTION
                'Pipeline version "%" has been used in % analyses and cannot be modified. Create a new version instead.',
                OLD.version_tag, usage_count;
        END IF;
    END IF;

    RETURN NEW;
END;
$$;

CREATE TRIGGER tr_pipeline_version_immutable
    BEFORE UPDATE ON public.pipeline_versions
    FOR EACH ROW EXECUTE FUNCTION public.prevent_pipeline_version_mutation();


-- ============================================================================
-- Migration 006: Forensic Audio Normalization
-- (Moved after 007 since it references pipeline_versions)
-- ============================================================================

ALTER TABLE public.analyses
  ADD COLUMN IF NOT EXISTS normalized_audio_url TEXT,
  ADD COLUMN IF NOT EXISTS normalized_hash VARCHAR(64),
  ADD COLUMN IF NOT EXISTS normalization_metrics JSONB;

UPDATE public.pipeline_versions
SET params = COALESCE(params, '{}'::jsonb) || '{
  "normalization": {
    "target_lufs": -14.0,
    "target_sample_rate": 44100,
    "target_channels": 1,
    "target_bit_depth": 24,
    "peak_ceiling_db": -1.0,
    "standard": "EBU R128"
  }
}'::jsonb
WHERE is_active = true;


-- ============================================================================
-- Migration 008: Organizations + Data Isolation
-- ============================================================================

DO $$ BEGIN
  CREATE TYPE org_role AS ENUM ('member', 'admin', 'owner');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

CREATE TABLE IF NOT EXISTS public.organizations (
    id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name                TEXT NOT NULL,
    slug                TEXT NOT NULL UNIQUE,
    plan_tier           public.plan_tier NOT NULL DEFAULT 'enterprise',
    stripe_customer_id  TEXT,
    default_visibility  TEXT NOT NULL DEFAULT 'enterprise'
        CHECK (default_visibility IN ('public', 'enterprise')),
    created_by          UUID NOT NULL,
    created_at          TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at          TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_orgs_slug ON public.organizations(slug);

CREATE TABLE IF NOT EXISTS public.organization_members (
    id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    organization_id   UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
    user_id           UUID NOT NULL,
    role              org_role NOT NULL DEFAULT 'member',
    invited_by        UUID,
    joined_at         TIMESTAMPTZ NOT NULL DEFAULT now(),
    CONSTRAINT unique_org_member UNIQUE (organization_id, user_id)
);

CREATE INDEX IF NOT EXISTS idx_org_members_org ON public.organization_members(organization_id);
CREATE INDEX IF NOT EXISTS idx_org_members_user ON public.organization_members(user_id);

ALTER TABLE public.profiles
    ADD COLUMN IF NOT EXISTS organization_id UUID REFERENCES public.organizations(id);

CREATE INDEX IF NOT EXISTS idx_profiles_org ON public.profiles(organization_id)
    WHERE organization_id IS NOT NULL;

ALTER TABLE public.organizations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.organization_members ENABLE ROW LEVEL SECURITY;

CREATE POLICY orgs_select ON public.organizations FOR SELECT USING (
    id IN (SELECT organization_id FROM public.organization_members WHERE user_id = auth.uid())
);

CREATE POLICY orgs_insert_service ON public.organizations FOR INSERT WITH CHECK (true);
CREATE POLICY orgs_update_service ON public.organizations FOR UPDATE USING (true);

CREATE POLICY org_members_select ON public.organization_members FOR SELECT USING (
    organization_id IN (
        SELECT organization_id FROM public.organization_members WHERE user_id = auth.uid()
    )
);

CREATE POLICY org_members_insert_service ON public.organization_members FOR INSERT WITH CHECK (true);
CREATE POLICY org_members_delete_service ON public.organization_members FOR DELETE USING (true);

DROP POLICY IF EXISTS ref_tracks_select_visible ON public.reference_tracks;
DROP POLICY IF EXISTS reference_tracks_select_authenticated ON public.reference_tracks;

CREATE POLICY ref_tracks_select_isolated ON public.reference_tracks FOR SELECT USING (
    visibility = 'public'
    OR (
        visibility = 'enterprise'
        AND organization_id IN (
            SELECT om.organization_id FROM public.organization_members om
            WHERE om.user_id = auth.uid()
        )
    )
    OR (visibility = 'private' AND contributed_by = auth.uid())
);

CREATE TRIGGER tr_orgs_updated
    BEFORE UPDATE ON public.organizations FOR EACH ROW
    EXECUTE FUNCTION public.set_updated_at();


-- ============================================================================
-- Migration 009: Data Retention Enforcement
-- ============================================================================

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

ALTER TABLE public.organizations
    ADD COLUMN IF NOT EXISTS retention_days INTEGER NOT NULL DEFAULT 90
        CHECK (retention_days BETWEEN 7 AND 365);

ALTER TABLE public.forensic_cases
    ADD COLUMN IF NOT EXISTS archived_at TIMESTAMPTZ,
    ADD COLUMN IF NOT EXISTS archived_by UUID,
    ADD COLUMN IF NOT EXISTS audio_deleted_at TIMESTAMPTZ;

ALTER TABLE public.analyses ALTER COLUMN audio_url DROP NOT NULL;
