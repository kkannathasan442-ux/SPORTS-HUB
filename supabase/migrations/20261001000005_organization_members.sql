-- ============================================================================
-- Migration: 005_organization_members.sql
-- Description: User memberships and roles within organizations
-- ============================================================================

CREATE TABLE public.organization_members (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  role public.app_role NOT NULL,
  status public.member_status NOT NULL DEFAULT 'ACTIVE',
  joined_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT uq_organization_members_org_user UNIQUE (organization_id, user_id)
);

-- Trigger for automated updated_at timestamps
CREATE TRIGGER trg_organization_members_updated_at
  BEFORE UPDATE ON public.organization_members
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_updated_at();

COMMENT ON TABLE public.organization_members IS 'User memberships, staff roles, and statuses within organizations.';
