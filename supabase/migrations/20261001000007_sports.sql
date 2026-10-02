-- ============================================================================
-- Migration: 007_sports.sql
-- Description: Platform-level sports and activities catalog
-- ============================================================================

CREATE TABLE public.sports (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL CHECK (char_length(trim(name)) > 0),
  slug TEXT NOT NULL UNIQUE CHECK (char_length(trim(slug)) > 0 AND slug ~ '^[a-z0-9]+(?:-[a-z0-9]+)*$'),
  description TEXT,
  icon TEXT,
  image_url TEXT,
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  supports_booking BOOLEAN NOT NULL DEFAULT TRUE,
  supports_team BOOLEAN NOT NULL DEFAULT TRUE,
  supports_tournament BOOLEAN NOT NULL DEFAULT TRUE,
  supports_live_scoring BOOLEAN NOT NULL DEFAULT FALSE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Trigger for automated updated_at timestamps
CREATE TRIGGER trg_sports_updated_at
  BEFORE UPDATE ON public.sports
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_updated_at();

COMMENT ON TABLE public.sports IS 'Global platform sports catalog defining capabilities for booking, teams, tournaments, and live scoring.';
