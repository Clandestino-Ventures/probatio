-- ============================================================================
-- PROBATIO — Migration 015: Genre-Aware Scoring
-- ============================================================================
-- Adds genre detection and adjusted scoring columns:
--   - detected_genre + genre_confidence on analyses
--   - adjusted score columns on analysis_matches
-- ============================================================================

-- analyses: detected genre and confidence
ALTER TABLE public.analyses
    ADD COLUMN IF NOT EXISTS detected_genre VARCHAR(50),
    ADD COLUMN IF NOT EXISTS genre_confidence FLOAT;

-- analysis_matches: genre-adjusted scores alongside raw scores
ALTER TABLE public.analysis_matches
    ADD COLUMN IF NOT EXISTS score_melody_adjusted FLOAT,
    ADD COLUMN IF NOT EXISTS score_harmony_adjusted FLOAT,
    ADD COLUMN IF NOT EXISTS score_rhythm_adjusted FLOAT,
    ADD COLUMN IF NOT EXISTS score_timbre_adjusted FLOAT,
    ADD COLUMN IF NOT EXISTS score_lyrics_adjusted FLOAT,
    ADD COLUMN IF NOT EXISTS score_overall_adjusted FLOAT,
    ADD COLUMN IF NOT EXISTS detected_genre VARCHAR(50),
    ADD COLUMN IF NOT EXISTS genre_confidence FLOAT;
