-- ============================================================================
-- PROBATIO — Migration 007: Pipeline Versions Table + Reproducibility
-- ============================================================================
-- Creates the pipeline_versions table that was referenced conceptually but
-- never materialized in the schema. Adds reproducibility metadata and
-- immutability enforcement.
--
-- A defense attorney's question: "Can you re-run this and get the same result?"
-- This migration ensures the answer is provably "yes."
-- ============================================================================

-- ────────────────────────────────────────────────────────────────────────────
-- 1. Create pipeline_versions table
-- ────────────────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.pipeline_versions (
    id                    UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    version_tag           TEXT NOT NULL UNIQUE,

    -- Model versions (pinned for reproducibility)
    demucs_model          TEXT NOT NULL,
    demucs_version        TEXT NOT NULL,
    crepe_model           TEXT NOT NULL,
    crepe_version         TEXT NOT NULL,
    clap_model            TEXT NOT NULL,
    clap_version          TEXT NOT NULL,
    librosa_version       TEXT NOT NULL,
    llm_model             TEXT NOT NULL,

    -- Full parameter configuration
    params                JSONB NOT NULL DEFAULT '{}'::JSONB,

    -- Active version flag (only one can be active)
    is_active             BOOLEAN NOT NULL DEFAULT false,
    description           TEXT,

    -- Reproducibility metadata
    modal_image_digest    JSONB DEFAULT '{}'::JSONB,
    weight_archive_urls   JSONB DEFAULT '{}'::JSONB,
    test_corpus_hash      VARCHAR(64),
    verified_reproducible BOOLEAN DEFAULT false,
    verified_at           TIMESTAMPTZ,
    reproducibility_notes TEXT,

    created_at            TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Only one active version at a time
CREATE UNIQUE INDEX IF NOT EXISTS idx_pipeline_versions_active
    ON public.pipeline_versions(is_active) WHERE is_active = true;

-- RLS
ALTER TABLE public.pipeline_versions ENABLE ROW LEVEL SECURITY;

-- Pipeline versions are readable by all authenticated users
CREATE POLICY pipeline_versions_select ON public.pipeline_versions
    FOR SELECT USING (auth.role() = 'authenticated');

-- Service role can insert/update
CREATE POLICY pipeline_versions_insert_service ON public.pipeline_versions
    FOR INSERT WITH CHECK (true);
CREATE POLICY pipeline_versions_update_service ON public.pipeline_versions
    FOR UPDATE USING (true);

-- ────────────────────────────────────────────────────────────────────────────
-- 2. Seed the initial pipeline version
-- ────────────────────────────────────────────────────────────────────────────

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
    'Initial Probatio pipeline for alpha release'
) ON CONFLICT (version_tag) DO NOTHING;

-- ────────────────────────────────────────────────────────────────────────────
-- 3. Immutability trigger: prevent modification of used pipeline versions
-- ────────────────────────────────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION public.prevent_pipeline_version_mutation()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    usage_count INTEGER;
BEGIN
    -- Count analyses using this pipeline version
    SELECT COUNT(*) INTO usage_count
    FROM public.analyses
    WHERE pipeline_version = OLD.version_tag;

    IF usage_count > 0 THEN
        -- Only allow changes to operational fields, not config fields
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
