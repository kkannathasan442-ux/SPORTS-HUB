-- ============================================================================
-- Migration: 008_venue_sports.sql
-- Description: Association between physical venues and supported sports
-- ============================================================================

CREATE TABLE public.venue_sports (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  venue_id UUID NOT NULL REFERENCES public.venues(id) ON DELETE CASCADE,
  sport_id UUID NOT NULL REFERENCES public.sports(id) ON DELETE RESTRICT,
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT uq_venue_sports_venue_sport UNIQUE (venue_id, sport_id)
);

COMMENT ON TABLE public.venue_sports IS 'Supported sports and game types offered at specific physical venues.';
