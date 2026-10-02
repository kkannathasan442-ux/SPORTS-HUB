-- ============================================================================
-- Migration: 010_venue_operating_hours.sql
-- Description: Operating schedule and daily hours of operation for venues
-- ============================================================================

CREATE TABLE public.venue_operating_hours (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  venue_id UUID NOT NULL REFERENCES public.venues(id) ON DELETE CASCADE,
  day_of_week SMALLINT NOT NULL CHECK (day_of_week BETWEEN 0 AND 6),
  open_time TIME,
  close_time TIME,
  is_closed BOOLEAN NOT NULL DEFAULT FALSE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT uq_venue_operating_hours_venue_day UNIQUE (venue_id, day_of_week),
  CONSTRAINT chk_operating_hours_valid CHECK (
    (is_closed = TRUE) OR (open_time IS NOT NULL AND close_time IS NOT NULL AND open_time < close_time)
  )
);

-- Trigger for automated updated_at timestamps
CREATE TRIGGER trg_venue_operating_hours_updated_at
  BEFORE UPDATE ON public.venue_operating_hours
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_updated_at();

COMMENT ON TABLE public.venue_operating_hours IS 'Day-of-week operating hours schedule (0=Sun, 1=Mon, ..., 6=Sat) for venues.';
