-- ============================================================================
-- PROBATIO — Migration 003: Probatiol Signatures, Analysis Segments, Vector RPC
-- ============================================================================
-- Creates the tables and RPC functions needed for multi-dimensional vector
-- search. These are the forensic differentiators:
--
-- 1. spectral_signatures: 4 embeddings per analysis (timbre/melody/harmony/rhythm)
-- 2. analysis_segments: per-segment features + embeddings (~100 per track)
-- 3. match_by_dimension: RPC for dimension-specific vector search
-- 4. match_segments: RPC for segment-level similarity matching
-- ============================================================================

-- ────────────────────────────────────────────────────────────────────────────
-- ENUM: match_dimension (if not exists from Day 1 schema)
-- ────────────────────────────────────────────────────────────────────────────
DO $$ BEGIN
  CREATE TYPE match_dimension AS ENUM ('melody', 'harmony', 'rhythm', 'timbre', 'lyrics', 'structure');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE stem_type AS ENUM ('vocals', 'bass', 'drums', 'other');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- ────────────────────────────────────────────────────────────────────────────
-- TABLE: spectral_signatures
-- 4 rows per analysis: one per forensic dimension (timbre, melody, harmony, rhythm).
-- Each row stores a 512-dim CLAP embedding for that dimension.
-- ────────────────────────────────────────────────────────────────────────────
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

-- HNSW index for fast cosine similarity search per dimension
CREATE INDEX IF NOT EXISTS idx_spectral_embedding
    ON public.spectral_signatures
    USING hnsw (embedding vector_cosine_ops)
    WITH (m = 16, ef_construction = 64);

-- Lookup by analysis
CREATE INDEX IF NOT EXISTS idx_spectral_analysis
    ON public.spectral_signatures(analysis_id);

-- Lookup by dimension (for dimension-specific search)
CREATE INDEX IF NOT EXISTS idx_spectral_dimension
    ON public.spectral_signatures(dimension);

-- RLS
ALTER TABLE public.spectral_signatures ENABLE ROW LEVEL SECURITY;

CREATE POLICY spectral_select ON public.spectral_signatures FOR SELECT
    USING (EXISTS (
        SELECT 1 FROM public.analyses
        WHERE analyses.id = spectral_signatures.analysis_id
        AND analyses.user_id = auth.uid()
    ));

-- Service role can insert (pipeline runs server-side)
CREATE POLICY spectral_insert_service ON public.spectral_signatures FOR INSERT
    WITH CHECK (true);

CREATE POLICY spectral_delete_service ON public.spectral_signatures FOR DELETE
    USING (true);

-- ────────────────────────────────────────────────────────────────────────────
-- TABLE: analysis_segments
-- ~100 rows per analysis (4s windows, 2s hop on a 3.5 min track).
-- Each segment stores per-window features + a CLAP embedding for
-- segment-level similarity matching ("bars 12-16 match bars 8-12").
-- ────────────────────────────────────────────────────────────────────────────
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

-- HNSW index on segment embeddings for segment-level matching
CREATE INDEX IF NOT EXISTS idx_segments_embedding
    ON public.analysis_segments
    USING hnsw (embedding vector_cosine_ops)
    WITH (m = 16, ef_construction = 64);

-- Lookup by analysis + ordering
CREATE INDEX IF NOT EXISTS idx_segments_analysis
    ON public.analysis_segments(analysis_id, segment_index);

-- RLS
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

-- ────────────────────────────────────────────────────────────────────────────
-- RPC: match_by_dimension
-- Search spectral_signatures for similar embeddings in a specific dimension.
-- Used by the pipeline to find tracks with similar melody, harmony, etc.
-- ────────────────────────────────────────────────────────────────────────────
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

-- ────────────────────────────────────────────────────────────────────────────
-- RPC: match_reference_tracks
-- Search reference_tracks catalog by embedding similarity.
-- Uses the full-mix embedding (timbre dimension).
-- ────────────────────────────────────────────────────────────────────────────
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

-- ────────────────────────────────────────────────────────────────────────────
-- RPC: match_segments
-- Segment-to-segment matching: find segments in other analyses that are
-- similar to a given segment embedding. This enables "bars 12-16 of Track A
-- match bars 8-12 of Track B at 0.94 cosine similarity."
-- ────────────────────────────────────────────────────────────────────────────
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
