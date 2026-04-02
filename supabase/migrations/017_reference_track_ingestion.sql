-- ============================================================================
-- PROBATIO — Migration 017: Reference Track Ingestion Support
-- ============================================================================
-- Adds columns to reference_tracks needed for the catalog ingestion pipeline:
--   - fingerprinted: whether the track has been fully processed
--   - status: processing state (pending/processing/completed/failed)
--   - features_json: extracted audio features (CREPE, librosa)
--   - lyrics_text / lyrics_language: Whisper transcription
--   - audio_url: location of the uploaded audio file
--   - error_message: failure reason if processing fails
-- ============================================================================

ALTER TABLE public.reference_tracks
    ADD COLUMN IF NOT EXISTS fingerprinted BOOLEAN DEFAULT false,
    ADD COLUMN IF NOT EXISTS status VARCHAR(20) DEFAULT 'pending',
    ADD COLUMN IF NOT EXISTS features_json JSONB,
    ADD COLUMN IF NOT EXISTS lyrics_text TEXT,
    ADD COLUMN IF NOT EXISTS lyrics_language VARCHAR(10),
    ADD COLUMN IF NOT EXISTS audio_url TEXT,
    ADD COLUMN IF NOT EXISTS error_message TEXT;

-- Index for querying unprocessed tracks in a catalog
CREATE INDEX IF NOT EXISTS idx_reference_tracks_catalog_status
    ON public.reference_tracks(catalog_id, status)
    WHERE fingerprinted = false;
