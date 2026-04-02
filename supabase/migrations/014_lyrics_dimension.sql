-- ============================================================================
-- PROBATIO — Migration 014: Lyrics Dimension
-- ============================================================================
-- Adds the 5th analysis dimension (lyrics) to the schema:
--   - score_lyrics column on analysis_matches
--   - lyrics_embedding on reference_tracks
--   - lyrics_text / lyrics_language on analyses
--   - RPC function find_similar_tracks_lyrics
-- ============================================================================

-- analysis_matches: individual lyrics score
ALTER TABLE public.analysis_matches
    ADD COLUMN IF NOT EXISTS score_lyrics FLOAT;

-- reference_tracks: lyrics embedding for similarity search
ALTER TABLE public.reference_tracks
    ADD COLUMN IF NOT EXISTS lyrics_embedding vector(512);

-- analyses: store whisper transcription text and detected language
ALTER TABLE public.analyses
    ADD COLUMN IF NOT EXISTS lyrics_text TEXT,
    ADD COLUMN IF NOT EXISTS lyrics_language TEXT;

-- RPC: find similar tracks by lyrics embedding (same pattern as find_similar_tracks_vocals)
CREATE OR REPLACE FUNCTION public.find_similar_tracks_lyrics(
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
    1 - (rt.lyrics_embedding <=> p_embedding) as similarity
  FROM public.reference_tracks rt
  WHERE rt.catalog_id = ANY(p_catalog_ids)
  AND rt.lyrics_embedding IS NOT NULL
  AND 1 - (rt.lyrics_embedding <=> p_embedding) > p_threshold
  ORDER BY rt.lyrics_embedding <=> p_embedding
  LIMIT p_limit;
$$;

GRANT EXECUTE ON FUNCTION public.find_similar_tracks_lyrics TO authenticated;
