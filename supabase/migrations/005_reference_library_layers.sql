-- ============================================================================
-- PROBATIO — Migration 005: Reference Library Two-Layer Strategy
-- ============================================================================
-- Adds visibility controls, enterprise catalogs, match source tracking,
-- and visibility-aware search RPC for the two-layer reference system:
--   Layer 1: AcoustID fingerprint identification (35M+ tracks)
--   Layer 2: CLAP embedding similarity (grows with each analysis)
-- ============================================================================

-- ────────────────────────────────────────────────────────────────────────────
-- 1. reference_tracks: Add visibility + organization + contributor columns
-- ────────────────────────────────────────────────────────────────────────────

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

-- Update RLS: visibility-aware access
DROP POLICY IF EXISTS reference_tracks_select_authenticated ON public.reference_tracks;

CREATE POLICY ref_tracks_select_visible ON public.reference_tracks FOR SELECT USING (
  visibility = 'public'
  OR (visibility = 'enterprise' AND organization_id IN (
    SELECT id FROM public.profiles WHERE id = auth.uid()
  ))
  OR (visibility = 'private' AND contributed_by = auth.uid())
);

-- Service role can insert/update (pipeline + bulk ingestion)
CREATE POLICY ref_tracks_insert_service ON public.reference_tracks FOR INSERT
  WITH CHECK (true);
CREATE POLICY ref_tracks_update_service ON public.reference_tracks FOR UPDATE
  USING (true);

-- ────────────────────────────────────────────────────────────────────────────
-- 2. enterprise_catalogs table
-- ────────────────────────────────────────────────────────────────────────────

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

-- FK from reference_tracks to enterprise_catalogs
ALTER TABLE public.reference_tracks
  ADD CONSTRAINT fk_ref_tracks_catalog
  FOREIGN KEY (catalog_id) REFERENCES public.enterprise_catalogs(id) ON DELETE SET NULL;

-- updated_at trigger
CREATE TRIGGER tr_catalogs_updated
  BEFORE UPDATE ON public.enterprise_catalogs FOR EACH ROW
  EXECUTE FUNCTION public.set_updated_at();

-- ────────────────────────────────────────────────────────────────────────────
-- 3. analyses: Add identified_track field (AcoustID identification)
-- ────────────────────────────────────────────────────────────────────────────

ALTER TABLE public.analyses
  ADD COLUMN IF NOT EXISTS identified_track JSONB;
-- { "title": "Despacito", "artist": "Luis Fonsi", "isrc": "USUG11700344",
--   "reference_track_id": "uuid", "confidence": 0.97, "source": "acoustid" }

-- ────────────────────────────────────────────────────────────────────────────
-- 4. analysis_matches: Add match_source field
-- ────────────────────────────────────────────────────────────────────────────

ALTER TABLE public.analysis_matches
  ADD COLUMN IF NOT EXISTS match_source TEXT DEFAULT 'embedding'
    CHECK (match_source IN ('fingerprint', 'embedding', 'both', 'cross_analysis'));

-- ────────────────────────────────────────────────────────────────────────────
-- 5. profiles: Add library_opt_in preference
-- ────────────────────────────────────────────────────────────────────────────

ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS library_opt_in BOOLEAN NOT NULL DEFAULT true;

-- ────────────────────────────────────────────────────────────────────────────
-- 6. RPC: Visibility-aware reference track search
-- ────────────────────────────────────────────────────────────────────────────

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
