-- ============================================================================
-- Migration: 006_venues.sql
-- Description: Physical sports venues owned by organizations
-- ============================================================================

CREATE TABLE public.venues (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  name TEXT NOT NULL CHECK (char_length(trim(name)) > 0),
  slug TEXT NOT NULL CHECK (char_length(trim(slug)) > 0 AND slug ~ '^[a-z0-9]+(?:-[a-z0-9]+)*$'),
  description TEXT,
  address_line_1 TEXT,
  address_line_2 TEXT,
  city TEXT,
  district TEXT,
  postal_code TEXT,
  latitude NUMERIC(9,6) CHECK (latitude IS NULL OR (latitude >= -90.0 AND latitude <= 90.0)),
  longitude NUMERIC(9,6) CHECK (longitude IS NULL OR (longitude >= -180.0 AND longitude <= 180.0)),
  phone TEXT,
  email TEXT,
  status public.venue_status NOT NULL DEFAULT 'DRAFT',
  timezone TEXT NOT NULL DEFAULT 'Asia/Colombo',
  cover_image_url TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT uq_venues_org_slug UNIQUE (organization_id, slug),
  CONSTRAINT uq_venues_id_org UNIQUE (id, organization_id)
);

-- Trigger for automated updated_at timestamps
CREATE TRIGGER trg_venues_updated_at
  BEFORE UPDATE ON public.venues
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_updated_at();

COMMENT ON TABLE public.venues IS 'Physical sports complexes and facilities operated by an organization.';
