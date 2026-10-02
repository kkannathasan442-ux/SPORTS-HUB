-- ============================================================================
-- Migration: 009_facilities.sql
-- Description: Individual courts, pitches, tables, and bookable spaces within venues
-- ============================================================================

CREATE TABLE public.facilities (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  venue_id UUID NOT NULL REFERENCES public.venues(id) ON DELETE CASCADE,
  sport_id UUID REFERENCES public.sports(id) ON DELETE SET NULL,
  name TEXT NOT NULL CHECK (char_length(trim(name)) > 0),
  slug TEXT NOT NULL CHECK (char_length(trim(slug)) > 0 AND slug ~ '^[a-z0-9]+(?:-[a-z0-9]+)*$'),
  description TEXT,
  facility_type TEXT,
  capacity INTEGER CHECK (capacity IS NULL OR capacity > 0),
  status public.facility_status NOT NULL DEFAULT 'AVAILABLE',
  is_bookable BOOLEAN NOT NULL DEFAULT TRUE,
  default_duration_minutes INTEGER NOT NULL DEFAULT 60 CHECK (default_duration_minutes > 0),
  buffer_minutes INTEGER NOT NULL DEFAULT 0 CHECK (buffer_minutes >= 0),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT uq_facilities_venue_slug UNIQUE (venue_id, slug),
  CONSTRAINT uq_facilities_id_venue UNIQUE (id, venue_id)
);

-- Trigger for automated updated_at timestamps
CREATE TRIGGER trg_facilities_updated_at
  BEFORE UPDATE ON public.facilities
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_updated_at();

COMMENT ON TABLE public.facilities IS 'Specific courts, pitches, tables, and rooms inside a physical sports venue.';
