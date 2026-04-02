-- ============================================================================
-- PROBATIO — Migration 011: RLS Hardening
-- ============================================================================
-- Removes overly permissive INSERT policies that allow any authenticated
-- user to write to tables that should be service-role-only.
-- Service role bypasses RLS, so these policies are not needed.
-- ============================================================================

-- P0: audit_log — remove authenticated INSERT policy
-- Only service role (pipeline, API routes) should write to audit_log.
DROP POLICY IF EXISTS audit_log_insert_authenticated ON public.audit_log;

-- P1: Remove WITH CHECK (true) INSERT policies on service-only tables.
-- These named "*_service" but actually allow any authenticated user to INSERT.
-- Service role bypasses RLS — no INSERT policy needed for it.

-- spectral_signatures
DROP POLICY IF EXISTS spectral_insert_service ON public.spectral_signatures;
DROP POLICY IF EXISTS spectral_delete_service ON public.spectral_signatures;

-- analysis_segments
DROP POLICY IF EXISTS segments_insert_service ON public.analysis_segments;
DROP POLICY IF EXISTS segments_delete_service ON public.analysis_segments;
DROP POLICY IF EXISTS segments_update_service ON public.analysis_segments;

-- match_evidence
DROP POLICY IF EXISTS evidence_insert_service ON public.match_evidence;
DROP POLICY IF EXISTS evidence_delete_service ON public.match_evidence;

-- auth_events
DROP POLICY IF EXISTS auth_events_insert_service ON public.auth_events;

-- reference_tracks (keep visibility-based SELECT, remove open INSERT/UPDATE)
DROP POLICY IF EXISTS ref_tracks_insert_service ON public.reference_tracks;
DROP POLICY IF EXISTS ref_tracks_update_service ON public.reference_tracks;

-- enterprise_catalogs
DROP POLICY IF EXISTS catalogs_insert_service ON public.enterprise_catalogs;
DROP POLICY IF EXISTS catalogs_update_service ON public.enterprise_catalogs;

-- pipeline_versions
DROP POLICY IF EXISTS pipeline_versions_insert_service ON public.pipeline_versions;
DROP POLICY IF EXISTS pipeline_versions_update_service ON public.pipeline_versions;

-- organizations
DROP POLICY IF EXISTS orgs_insert_service ON public.organizations;
DROP POLICY IF EXISTS orgs_update_service ON public.organizations;

-- organization_members
DROP POLICY IF EXISTS org_members_insert_service ON public.organization_members;
DROP POLICY IF EXISTS org_members_delete_service ON public.organization_members;
