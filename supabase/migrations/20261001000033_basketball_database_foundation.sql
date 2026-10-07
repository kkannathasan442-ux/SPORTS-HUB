-- ============================================================================
-- Migration: 033_basketball_database_foundation.sql
-- Description: STEP 20B — Dedicated Basketball Database Foundation
-- Tables: public.basketball_periods, public.basketball_events, public.basketball_lineups
-- Enums: basketball_period_type, basketball_clock_status, basketball_event_type, basketball_scoring_type, basketball_foul_type
-- Realtime: Adds basketball_periods, basketball_events, basketball_lineups to supabase_realtime
-- ============================================================================

-- 1. Enable Basketball Live Scoring in Platform Sports Catalog
UPDATE public.sports
SET supports_live_scoring = true,
    updated_at = NOW()
WHERE slug = 'basketball';

-- 2. Create Basketball Enums
DO $$ BEGIN
  CREATE TYPE public.basketball_period_type AS ENUM (
    'REGULAR',
    'OVERTIME'
  );
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE public.basketball_clock_status AS ENUM (
    'STOPPED',
    'RUNNING',
    'EXPIRED'
  );
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE public.basketball_event_type AS ENUM (
    'SCORE',
    'FOUL',
    'SUBSTITUTION',
    'TIMEOUT',
    'CLOCK',
    'PERIOD'
  );
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE public.basketball_scoring_type AS ENUM (
    'FREE_THROW_1PT',
    'FIELD_GOAL_2PT',
    'FIELD_GOAL_3PT'
  );
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE public.basketball_foul_type AS ENUM (
    'PERSONAL',
    'TECHNICAL',
    'FLAGRANT',
    'OFFENSIVE'
  );
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

-- 3. Table: public.basketball_periods
-- Represents regulation quarters and overtime periods with game-clock state and score projections
CREATE TABLE public.basketball_periods (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  match_id UUID NOT NULL REFERENCES public.matches(id) ON DELETE CASCADE,
  period_number INTEGER NOT NULL CHECK (period_number >= 1),
  period_type public.basketball_period_type NOT NULL DEFAULT 'REGULAR',

  -- Aggregate running score projection for this period
  side_a_score INTEGER NOT NULL DEFAULT 0 CHECK (side_a_score >= 0),
  side_b_score INTEGER NOT NULL DEFAULT 0 CHECK (side_b_score >= 0),

  -- Period team fouls (accumulate during period, reset at quarter breaks)
  side_a_fouls INTEGER NOT NULL DEFAULT 0 CHECK (side_a_fouls >= 0),
  side_b_fouls INTEGER NOT NULL DEFAULT 0 CHECK (side_b_fouls >= 0),

  -- Configured period duration and server-authoritative clock
  duration_seconds INTEGER NOT NULL DEFAULT 600 CHECK (duration_seconds >= 60 AND duration_seconds <= 1800),
  time_remaining_seconds INTEGER NOT NULL DEFAULT 600 CHECK (time_remaining_seconds >= 0 AND time_remaining_seconds <= duration_seconds),
  clock_status public.basketball_clock_status NOT NULL DEFAULT 'STOPPED',
  clock_last_started_at TIMESTAMPTZ,

  -- Period lifecycle state
  is_completed BOOLEAN NOT NULL DEFAULT false,
  started_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  completed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  -- Constraints
  CONSTRAINT uq_basketball_periods_match_number UNIQUE (match_id, period_number),
  CONSTRAINT chk_basketball_period_type_number CHECK (
    (period_type = 'REGULAR' AND period_number <= 4)
    OR (period_type = 'OVERTIME' AND period_number >= 5)
  )
);

-- Trigger: Ensure match sport is Basketball for basketball_periods
CREATE OR REPLACE FUNCTION public.check_basketball_period_match()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
DECLARE
  v_sport_slug TEXT;
BEGIN
  SELECT s.slug INTO v_sport_slug
  FROM public.matches m
  JOIN public.sports s ON s.id = m.sport_id
  WHERE m.id = NEW.match_id;

  IF v_sport_slug IS NULL OR v_sport_slug != 'basketball' THEN
    RAISE EXCEPTION 'INVALID_SPORT: Match sport must be Basketball to create basketball periods.';
  END IF;

  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_check_basketball_period_match
  BEFORE INSERT OR UPDATE ON public.basketball_periods
  FOR EACH ROW
  EXECUTE FUNCTION public.check_basketball_period_match();

CREATE TRIGGER trg_basketball_periods_updated_at
  BEFORE UPDATE ON public.basketball_periods
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_updated_at();

-- 4. Table: public.basketball_events
-- Authoritative append-only event ledger for points, fouls, substitutions, timeouts, and clock adjustments
CREATE TABLE public.basketball_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  match_id UUID NOT NULL REFERENCES public.matches(id) ON DELETE CASCADE,
  period_id UUID NOT NULL REFERENCES public.basketball_periods(id) ON DELETE CASCADE,
  sequence_number INTEGER NOT NULL CHECK (sequence_number >= 1),

  -- Idempotency protection key
  client_event_id UUID NOT NULL,

  -- Team and participant attribution
  side TEXT NOT NULL CHECK (side IN ('SIDE_A', 'SIDE_B')),
  competitor_id UUID NOT NULL,
  participant_id UUID REFERENCES public.match_participants(id) ON DELETE SET NULL,

  -- Event classification
  event_type public.basketball_event_type NOT NULL,
  scoring_type public.basketball_scoring_type,
  points INTEGER NOT NULL DEFAULT 0 CHECK (points >= 0 AND points <= 3),
  foul_type public.basketball_foul_type,

  -- Game clock snapshot at point of event
  game_clock_seconds INTEGER NOT NULL CHECK (game_clock_seconds >= 0),

  -- Structured payload for substitutions, timeouts, or notes
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,

  -- Soft-undo flag
  voided_at TIMESTAMPTZ NULL,

  -- Audit fields
  created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  -- Composite foreign key guarantees competitor belongs to the same match
  CONSTRAINT fk_basketball_events_competitor_match
    FOREIGN KEY (competitor_id, match_id)
    REFERENCES public.match_competitors(id, match_id)
    ON DELETE CASCADE,

  -- Unique constraints
  CONSTRAINT uq_basketball_events_period_seq UNIQUE (period_id, sequence_number),
  CONSTRAINT uq_basketball_events_match_client_event UNIQUE (match_id, client_event_id),

  -- Score consistency check constraint
  CONSTRAINT chk_basketball_events_scoring_integrity CHECK (
    (event_type = 'SCORE' AND scoring_type IS NOT NULL AND points > 0 AND (
      (scoring_type = 'FREE_THROW_1PT' AND points = 1) OR
      (scoring_type = 'FIELD_GOAL_2PT' AND points = 2) OR
      (scoring_type = 'FIELD_GOAL_3PT' AND points = 3)
    ))
    OR (event_type != 'SCORE' AND scoring_type IS NULL AND points = 0)
  ),

  -- Foul consistency check constraint
  CONSTRAINT chk_basketball_events_foul_integrity CHECK (
    (event_type = 'FOUL' AND foul_type IS NOT NULL)
    OR (event_type != 'FOUL' AND foul_type IS NULL)
  )
);

-- Trigger: Ensure period_id belongs to the same match
CREATE OR REPLACE FUNCTION public.check_basketball_event_match()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
DECLARE
  v_period_match_id UUID;
BEGIN
  SELECT match_id INTO v_period_match_id
  FROM public.basketball_periods
  WHERE id = NEW.period_id;

  IF v_period_match_id IS NULL OR v_period_match_id != NEW.match_id THEN
    RAISE EXCEPTION 'INTEGRITY_ERROR: Event period_id does not belong to the referenced match.';
  END IF;

  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_check_basketball_event_match
  BEFORE INSERT OR UPDATE ON public.basketball_events
  FOR EACH ROW
  EXECUTE FUNCTION public.check_basketball_event_match();

CREATE TRIGGER trg_basketball_events_updated_at
  BEFORE UPDATE ON public.basketball_events
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_updated_at();

-- 5. Table: public.basketball_lineups
-- Tracks active on-court players vs bench substitutes, foul counts, and projections per participant
CREATE TABLE public.basketball_lineups (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  match_id UUID NOT NULL REFERENCES public.matches(id) ON DELETE CASCADE,
  competitor_id UUID NOT NULL,
  participant_id UUID NOT NULL,

  -- Lineup status
  is_starter BOOLEAN NOT NULL DEFAULT false,
  is_on_court BOOLEAN NOT NULL DEFAULT false,

  -- Personal stats projections (maintained atomically via RPCs)
  points_projection INTEGER NOT NULL DEFAULT 0 CHECK (points_projection >= 0),
  fouls_projection INTEGER NOT NULL DEFAULT 0 CHECK (fouls_projection >= 0),
  is_fouled_out BOOLEAN NOT NULL DEFAULT false,

  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  -- Composite foreign key guarantees competitor belongs to match
  CONSTRAINT fk_basketball_lineups_competitor_match
    FOREIGN KEY (competitor_id, match_id)
    REFERENCES public.match_competitors(id, match_id)
    ON DELETE CASCADE,

  -- Foreign key to match participants
  CONSTRAINT fk_basketball_lineups_participant
    FOREIGN KEY (participant_id)
    REFERENCES public.match_participants(id)
    ON DELETE CASCADE,

  -- Unique constraint: A player can only appear once in a match's lineups
  CONSTRAINT uq_basketball_lineup_match_player UNIQUE (match_id, participant_id)
);

-- Trigger: Ensure match sport is Basketball for lineups
CREATE OR REPLACE FUNCTION public.check_basketball_lineup_match()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
DECLARE
  v_sport_slug TEXT;
  v_part_competitor_id UUID;
BEGIN
  SELECT s.slug INTO v_sport_slug
  FROM public.matches m
  JOIN public.sports s ON s.id = m.sport_id
  WHERE m.id = NEW.match_id;

  IF v_sport_slug IS NULL OR v_sport_slug != 'basketball' THEN
    RAISE EXCEPTION 'INVALID_SPORT: Match sport must be Basketball to manage lineups.';
  END IF;

  -- Ensure participant belongs to the competitor
  SELECT competitor_id INTO v_part_competitor_id
  FROM public.match_participants
  WHERE id = NEW.participant_id;

  IF v_part_competitor_id IS NULL OR v_part_competitor_id != NEW.competitor_id THEN
    RAISE EXCEPTION 'INTEGRITY_ERROR: Lineup participant does not belong to the designated competitor.';
  END IF;

  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_check_basketball_lineup_match
  BEFORE INSERT OR UPDATE ON public.basketball_lineups
  FOR EACH ROW
  EXECUTE FUNCTION public.check_basketball_lineup_match();

CREATE TRIGGER trg_basketball_lineups_updated_at
  BEFORE UPDATE ON public.basketball_lineups
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_updated_at();

-- 6. Performance & Integrity Indexes
CREATE INDEX idx_basketball_periods_match_id ON public.basketball_periods(match_id);
CREATE INDEX idx_basketball_periods_active ON public.basketball_periods(match_id, period_number) WHERE is_completed = false;

CREATE INDEX idx_basketball_events_match_id ON public.basketball_events(match_id);
CREATE INDEX idx_basketball_events_period_id ON public.basketball_events(period_id);
CREATE INDEX idx_basketball_events_period_seq ON public.basketball_events(period_id, sequence_number);
CREATE INDEX idx_basketball_events_active ON public.basketball_events(match_id, period_id) WHERE voided_at IS NULL;
CREATE INDEX idx_basketball_events_participant ON public.basketball_events(participant_id) WHERE participant_id IS NOT NULL;
CREATE INDEX idx_basketball_events_client_id ON public.basketball_events(match_id, client_event_id);

CREATE INDEX idx_basketball_lineups_match_id ON public.basketball_lineups(match_id);
CREATE INDEX idx_basketball_lineups_competitor ON public.basketball_lineups(competitor_id);
CREATE INDEX idx_basketball_lineups_on_court ON public.basketball_lineups(match_id, competitor_id) WHERE is_on_court = true;

-- 7. Row Level Security (RLS) Policies
ALTER TABLE public.basketball_periods ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.basketball_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.basketball_lineups ENABLE ROW LEVEL SECURITY;

-- Periods: Authenticated Organization Members & Assigned Scorers
CREATE POLICY "basketball_periods_select_authorized"
  ON public.basketball_periods
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.matches m
      WHERE m.id = basketball_periods.match_id
      AND (
        m.organization_id IS NULL
        OR public.is_super_admin()
        OR public.is_org_member(m.organization_id)
        OR m.created_by = auth.uid()
        OR m.scorer_user_id = auth.uid()
        OR EXISTS (
          SELECT 1 FROM public.match_participants mp
          WHERE mp.match_id = m.id AND mp.user_id = auth.uid()
        )
      )
    )
  );

-- Periods: Public Spectators for Scheduled / Active / Completed Matches
CREATE POLICY "basketball_periods_select_public"
  ON public.basketball_periods
  FOR SELECT
  TO anon, authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.matches m
      WHERE m.id = basketball_periods.match_id
      AND m.status IN ('SCHEDULED', 'WARMUP', 'LIVE', 'PAUSED', 'COMPLETED')
    )
  );

-- Periods: Mutation Restricted to Scorer / Org Managers
CREATE POLICY "basketball_periods_modify_authorized"
  ON public.basketball_periods
  FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.matches m
      WHERE m.id = basketball_periods.match_id
      AND (
        public.is_super_admin()
        OR (m.organization_id IS NOT NULL AND public.has_org_role(m.organization_id, ARRAY['OWNER'::public.app_role, 'MANAGER'::public.app_role]))
        OR m.created_by = auth.uid()
        OR m.scorer_user_id = auth.uid()
      )
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.matches m
      WHERE m.id = basketball_periods.match_id
      AND (
        public.is_super_admin()
        OR (m.organization_id IS NOT NULL AND public.has_org_role(m.organization_id, ARRAY['OWNER'::public.app_role, 'MANAGER'::public.app_role]))
        OR m.created_by = auth.uid()
        OR m.scorer_user_id = auth.uid()
      )
    )
  );

-- Events: Authenticated Organization Members
CREATE POLICY "basketball_events_select_authorized"
  ON public.basketball_events
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.matches m
      WHERE m.id = basketball_events.match_id
      AND (
        m.organization_id IS NULL
        OR public.is_super_admin()
        OR public.is_org_member(m.organization_id)
        OR m.created_by = auth.uid()
        OR m.scorer_user_id = auth.uid()
        OR EXISTS (
          SELECT 1 FROM public.match_participants mp
          WHERE mp.match_id = m.id AND mp.user_id = auth.uid()
        )
      )
    )
  );

-- Events: Public Spectators for Scheduled / Active / Completed Matches
CREATE POLICY "basketball_events_select_public"
  ON public.basketball_events
  FOR SELECT
  TO anon, authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.matches m
      WHERE m.id = basketball_events.match_id
      AND m.status IN ('SCHEDULED', 'WARMUP', 'LIVE', 'PAUSED', 'COMPLETED')
    )
  );

-- Events: Insert Restricted to Authorized Scorers & Managers
CREATE POLICY "basketball_events_insert_authorized"
  ON public.basketball_events
  FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.matches m
      WHERE m.id = basketball_events.match_id
      AND (
        public.is_super_admin()
        OR (m.organization_id IS NOT NULL AND public.has_org_role(m.organization_id, ARRAY['OWNER'::public.app_role, 'MANAGER'::public.app_role]))
        OR m.created_by = auth.uid()
        OR m.scorer_user_id = auth.uid()
      )
    )
  );

-- Events: Update Restricted to Authorized Scorers (for soft-undo)
CREATE POLICY "basketball_events_update_authorized"
  ON public.basketball_events
  FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.matches m
      WHERE m.id = basketball_events.match_id
      AND (
        public.is_super_admin()
        OR (m.organization_id IS NOT NULL AND public.has_org_role(m.organization_id, ARRAY['OWNER'::public.app_role, 'MANAGER'::public.app_role]))
        OR m.created_by = auth.uid()
        OR m.scorer_user_id = auth.uid()
      )
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.matches m
      WHERE m.id = basketball_events.match_id
      AND (
        public.is_super_admin()
        OR (m.organization_id IS NOT NULL AND public.has_org_role(m.organization_id, ARRAY['OWNER'::public.app_role, 'MANAGER'::public.app_role]))
        OR m.created_by = auth.uid()
        OR m.scorer_user_id = auth.uid()
      )
    )
  );

-- Direct DELETE is explicitly NOT permitted on basketball_events (Auditability & Soft-Undo)

-- Lineups: Select Authorized
CREATE POLICY "basketball_lineups_select_authorized"
  ON public.basketball_lineups
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.matches m
      WHERE m.id = basketball_lineups.match_id
      AND (
        m.organization_id IS NULL
        OR public.is_super_admin()
        OR public.is_org_member(m.organization_id)
        OR m.created_by = auth.uid()
        OR m.scorer_user_id = auth.uid()
        OR EXISTS (
          SELECT 1 FROM public.match_participants mp
          WHERE mp.match_id = m.id AND mp.user_id = auth.uid()
        )
      )
    )
  );

-- Lineups: Public Spectators
CREATE POLICY "basketball_lineups_select_public"
  ON public.basketball_lineups
  FOR SELECT
  TO anon, authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.matches m
      WHERE m.id = basketball_lineups.match_id
      AND m.status IN ('SCHEDULED', 'WARMUP', 'LIVE', 'PAUSED', 'COMPLETED')
    )
  );

-- Lineups: Modify Authorized
CREATE POLICY "basketball_lineups_modify_authorized"
  ON public.basketball_lineups
  FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.matches m
      WHERE m.id = basketball_lineups.match_id
      AND (
        public.is_super_admin()
        OR (m.organization_id IS NOT NULL AND public.has_org_role(m.organization_id, ARRAY['OWNER'::public.app_role, 'MANAGER'::public.app_role]))
        OR m.created_by = auth.uid()
        OR m.scorer_user_id = auth.uid()
      )
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.matches m
      WHERE m.id = basketball_lineups.match_id
      AND (
        public.is_super_admin()
        OR (m.organization_id IS NOT NULL AND public.has_org_role(m.organization_id, ARRAY['OWNER'::public.app_role, 'MANAGER'::public.app_role]))
        OR m.created_by = auth.uid()
        OR m.scorer_user_id = auth.uid()
      )
    )
  );

-- 8. Realtime Publication Configuration
DO $$ BEGIN
  ALTER PUBLICATION supabase_realtime ADD TABLE public.basketball_periods;
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  ALTER PUBLICATION supabase_realtime ADD TABLE public.basketball_events;
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  ALTER PUBLICATION supabase_realtime ADD TABLE public.basketball_lineups;
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;
