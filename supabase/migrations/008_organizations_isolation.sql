-- ============================================================================
-- PROBATIO — Migration 008: Organizations + Data Isolation
-- ============================================================================
-- Creates organizations as first-class entities with member management.
-- Updates RLS for enterprise catalog isolation via org membership.
-- Ensures forensic case tracks never leak into reference library.
-- ============================================================================

-- ────────────────────────────────────────────────────────────────────────────
-- 1. Organizations table
-- ────────────────────────────────────────────────────────────────────────────

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

-- ────────────────────────────────────────────────────────────────────────────
-- 2. Organization members
-- ────────────────────────────────────────────────────────────────────────────

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

-- ────────────────────────────────────────────────────────────────────────────
-- 3. Link profiles to organizations
-- ────────────────────────────────────────────────────────────────────────────

ALTER TABLE public.profiles
    ADD COLUMN IF NOT EXISTS organization_id UUID REFERENCES public.organizations(id);

CREATE INDEX IF NOT EXISTS idx_profiles_org ON public.profiles(organization_id)
    WHERE organization_id IS NOT NULL;

-- ────────────────────────────────────────────────────────────────────────────
-- 4. RLS for organizations
-- ────────────────────────────────────────────────────────────────────────────

ALTER TABLE public.organizations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.organization_members ENABLE ROW LEVEL SECURITY;

-- Organizations visible to their members
CREATE POLICY orgs_select ON public.organizations FOR SELECT USING (
    id IN (SELECT organization_id FROM public.organization_members WHERE user_id = auth.uid())
);

-- Service role can manage
CREATE POLICY orgs_insert_service ON public.organizations FOR INSERT WITH CHECK (true);
CREATE POLICY orgs_update_service ON public.organizations FOR UPDATE USING (true);

-- Org members visible to other members
CREATE POLICY org_members_select ON public.organization_members FOR SELECT USING (
    organization_id IN (
        SELECT organization_id FROM public.organization_members WHERE user_id = auth.uid()
    )
);

CREATE POLICY org_members_insert_service ON public.organization_members FOR INSERT WITH CHECK (true);
CREATE POLICY org_members_delete_service ON public.organization_members FOR DELETE USING (true);

-- ────────────────────────────────────────────────────────────────────────────
-- 5. Update reference_tracks RLS with proper org membership check
-- ────────────────────────────────────────────────────────────────────────────

DROP POLICY IF EXISTS ref_tracks_select_visible ON public.reference_tracks;
DROP POLICY IF EXISTS reference_tracks_select_authenticated ON public.reference_tracks;

CREATE POLICY ref_tracks_select_isolated ON public.reference_tracks FOR SELECT USING (
    -- Public: visible to all authenticated users
    visibility = 'public'
    -- Enterprise: visible only to members of the owning organization
    OR (
        visibility = 'enterprise'
        AND organization_id IN (
            SELECT om.organization_id FROM public.organization_members om
            WHERE om.user_id = auth.uid()
        )
    )
    -- Private: visible only to the contributor
    OR (visibility = 'private' AND contributed_by = auth.uid())
);

-- ────────────────────────────────────────────────────────────────────────────
-- 6. Triggers
-- ────────────────────────────────────────────────────────────────────────────

CREATE TRIGGER tr_orgs_updated
    BEFORE UPDATE ON public.organizations FOR EACH ROW
    EXECUTE FUNCTION public.set_updated_at();
