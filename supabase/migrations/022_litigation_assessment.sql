-- ============================================================================
-- PROBATIO Migration 022: Litigation Risk Assessment
-- ============================================================================
-- Adds JSONB column to store AI-generated litigation risk assessments
-- containing case law analysis, Arnstein test findings, and risk probability.
-- ============================================================================

ALTER TABLE analyses ADD COLUMN IF NOT EXISTS litigation_assessment JSONB;

COMMENT ON COLUMN analyses.litigation_assessment IS
  'AI-generated litigation risk assessment with case law precedent analysis, '
  'Arnstein test findings, strengths/weaknesses, and probability estimate.';
