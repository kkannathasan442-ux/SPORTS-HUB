-- ============================================================================
-- Migration: 004_organizations.sql
-- Description: Multi-tenant sports and recreation business organizations
-- ============================================================================

CREATE TABLE public.organizations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL CHECK (char_length(trim(name)) > 0),
  slug TEXT NOT NULL UNIQUE CHECK (char_length(trim(slug)) > 0 AND slug ~ '^[a-z0-9]+(?:-[a-z0-9]+)*$'),
  description TEXT,
  logo_url TEXT,
  phone TEXT,
  email TEXT,
  website TEXT,
  status public.organization_status NOT NULL DEFAULT 'PENDING',
  currency VARCHAR(3) NOT NULL DEFAULT 'LKR' CHECK (char_length(currency) = 3),
  timezone TEXT NOT NULL DEFAULT 'Asia/Colombo',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Trigger for automated updated_at timestamps
CREATE TRIGGER trg_organizations_updated_at
  BEFORE UPDATE ON public.organizations
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_updated_at();

COMMENT ON TABLE public.organizations IS 'Multi-tenant organization entity representing a sports business or club.';
