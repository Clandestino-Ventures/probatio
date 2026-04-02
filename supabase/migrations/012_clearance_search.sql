-- ────────────────────────────────────────────────────────────────────────────
-- 012 — Pre-Release Clearance: pgvector similarity search functions
-- ────────────────────────────────────────────────────────────────────────────

-- Find similar reference tracks by embedding cosine similarity.
-- Used by the clearance pipeline to screen uploads against catalogs.
CREATE OR REPLACE FUNCTION public.find_similar_tracks(
  p_embedding vector(512),
  p_catalog_ids UUID[],
  p_threshold float DEFAULT 0.4,
  p_limit int DEFAULT 50
)
RETURNS TABLE(
  id UUID,
  title TEXT,
  artist TEXT,
  isrc TEXT,
  release_date DATE,
  catalog_id UUID,
  similarity float
)
LANGUAGE sql
SECURITY DEFINER
SET search_path = public, extensions
AS $$
  SELECT
    rt.id,
    rt.title,
    rt.artist,
    rt.isrc,
    rt.release_date::date,
    rt.catalog_id,
    1 - (rt.embedding <=> p_embedding) as similarity
  FROM public.reference_tracks rt
  WHERE rt.catalog_id = ANY(p_catalog_ids)
  AND rt.embedding IS NOT NULL
  AND 1 - (rt.embedding <=> p_embedding) > p_threshold
  ORDER BY rt.embedding <=> p_embedding
  LIMIT p_limit;
$$;

GRANT EXECUTE ON FUNCTION public.find_similar_tracks TO authenticated;

-- Find similar tracks by vocal embedding (for melody-specific matching).
CREATE OR REPLACE FUNCTION public.find_similar_tracks_vocals(
  p_embedding vector(512),
  p_catalog_ids UUID[],
  p_threshold float DEFAULT 0.4,
  p_limit int DEFAULT 50
)
RETURNS TABLE(
  id UUID,
  title TEXT,
  artist TEXT,
  similarity float
)
LANGUAGE sql
SECURITY DEFINER
SET search_path = public, extensions
AS $$
  SELECT
    rt.id,
    rt.title,
    rt.artist,
    1 - (rt.embedding_vocals <=> p_embedding) as similarity
  FROM public.reference_tracks rt
  WHERE rt.catalog_id = ANY(p_catalog_ids)
  AND rt.embedding_vocals IS NOT NULL
  AND 1 - (rt.embedding_vocals <=> p_embedding) > p_threshold
  ORDER BY rt.embedding_vocals <=> p_embedding
  LIMIT p_limit;
$$;

GRANT EXECUTE ON FUNCTION public.find_similar_tracks_vocals TO authenticated;

-- Add 'clearance' to the analysis_mode enum if it doesn't exist.
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_enum
    WHERE enumlabel = 'clearance'
    AND enumtypid = (SELECT oid FROM pg_type WHERE typname = 'analysis_mode')
  ) THEN
    ALTER TYPE public.analysis_mode ADD VALUE IF NOT EXISTS 'clearance';
  END IF;
END $$;

-- Add catalog_ids column to analyses for clearance mode.
ALTER TABLE public.analyses
  ADD COLUMN IF NOT EXISTS catalog_ids UUID[] DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS clearance_status TEXT DEFAULT NULL;

COMMENT ON COLUMN public.analyses.catalog_ids IS 'Catalog IDs scanned during pre-release clearance';
COMMENT ON COLUMN public.analyses.clearance_status IS 'Clearance result: cleared, conditional, blocked';
