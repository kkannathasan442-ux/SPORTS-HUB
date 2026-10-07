-- ============================================================================
-- Migration: 030_badminton_scoring.sql
-- Description: STEP 17B — Live Badminton Scoring Database Foundation
-- Tables: public.badminton_games, public.badminton_rallies
-- Enum: badminton_rally_type
-- ============================================================================

-- 1. Create Enum
DO $$ BEGIN
  CREATE TYPE public.badminton_rally_type AS ENUM (
    'NORMAL',
    'SMASH',
    'DROP',
    'NET',
    'OUT',
    'FAULT',
    'SERVICE_FAULT'
  );
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

-- 2. Table: public.badminton_games
CREATE TABLE public.badminton_games (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  match_id UUID NOT NULL REFERENCES public.matches(id) ON DELETE CASCADE,
  game_number INTEGER NOT NULL CHECK (game_number > 0 AND game_number <= 5),

  -- Running authoritative score snapshot
  side_a_points INTEGER NOT NULL DEFAULT 0 CHECK (side_a_points >= 0 AND side_a_points <= 30),
  side_b_points INTEGER NOT NULL DEFAULT 0 CHECK (side_b_points >= 0 AND side_b_points <= 30),

  -- Winner & completion lifecycle
  winner_side TEXT CHECK (winner_side IS NULL OR winner_side IN ('SIDE_A', 'SIDE_B')),
  is_completed BOOLEAN NOT NULL DEFAULT false,

  -- Current service state
  serving_side TEXT NOT NULL DEFAULT 'SIDE_A' CHECK (serving_side IN ('SIDE_A', 'SIDE_B')),
  server_participant_id UUID REFERENCES public.match_participants(id) ON DELETE RESTRICT,
  receiver_participant_id UUID REFERENCES public.match_participants(id) ON DELETE RESTRICT,

  -- Configurable game thresholds (defaults to BWF standard)
  points_to_win INTEGER NOT NULL DEFAULT 21 CHECK (points_to_win > 0 AND points_to_win <= 30),
  win_by INTEGER NOT NULL DEFAULT 2 CHECK (win_by > 0 AND win_by <= 5),
  max_points INTEGER NOT NULL DEFAULT 30 CHECK (max_points >= points_to_win AND max_points <= 50),

  -- Timestamps
  started_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  completed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  -- Unique constraint: match_id + game_number
  CONSTRAINT uq_badminton_games_match_number UNIQUE (match_id, game_number)
);

-- Ensure match sport is Badminton
CREATE OR REPLACE FUNCTION public.check_badminton_game_match()
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

  IF v_sport_slug IS NULL OR v_sport_slug != 'badminton' THEN
    RAISE EXCEPTION 'Match sport must be Badminton to create badminton games.';
  END IF;

  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_check_badminton_game_match
  BEFORE INSERT OR UPDATE ON public.badminton_games
  FOR EACH ROW
  EXECUTE FUNCTION public.check_badminton_game_match();

-- 3. Table: public.badminton_rallies
CREATE TABLE public.badminton_rallies (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  match_id UUID NOT NULL REFERENCES public.matches(id) ON DELETE CASCADE,
  game_id UUID NOT NULL REFERENCES public.badminton_games(id) ON DELETE CASCADE,
  sequence_number INTEGER NOT NULL CHECK (sequence_number > 0),

  -- Rally outcome
  winner_side TEXT NOT NULL CHECK (winner_side IN ('SIDE_A', 'SIDE_B')),
  winning_participant_id UUID REFERENCES public.match_participants(id) ON DELETE RESTRICT,

  -- Service context during this rally
  server_side TEXT NOT NULL CHECK (server_side IN ('SIDE_A', 'SIDE_B')),
  server_participant_id UUID REFERENCES public.match_participants(id) ON DELETE RESTRICT,
  receiver_participant_id UUID REFERENCES public.match_participants(id) ON DELETE RESTRICT,

  -- Rally metadata
  rally_type public.badminton_rally_type NOT NULL DEFAULT 'NORMAL',

  -- Authoritative score state AFTER rally
  score_after_side_a INTEGER NOT NULL CHECK (score_after_side_a >= 0),
  score_after_side_b INTEGER NOT NULL CHECK (score_after_side_b >= 0),

  -- Idempotency protection
  client_event_id UUID NOT NULL,

  -- Soft-undo flag
  voided_at TIMESTAMPTZ NULL,

  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  CONSTRAINT uq_badminton_rallies_game_seq UNIQUE (game_id, sequence_number),
  CONSTRAINT uq_badminton_rallies_client_event UNIQUE (game_id, client_event_id)
);

-- Ensure rally game_id belongs to the same match
CREATE OR REPLACE FUNCTION public.check_badminton_rally_match()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
DECLARE
  v_game_match_id UUID;
BEGIN
  SELECT match_id INTO v_game_match_id FROM public.badminton_games WHERE id = NEW.game_id;

  IF v_game_match_id != NEW.match_id THEN
    RAISE EXCEPTION 'Rally game_id does not belong to the same match.';
  END IF;

  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_check_badminton_rally_match
  BEFORE INSERT OR UPDATE ON public.badminton_rallies
  FOR EACH ROW
  EXECUTE FUNCTION public.check_badminton_rally_match();

-- Updated_at triggers
CREATE TRIGGER trg_badminton_games_updated_at
  BEFORE UPDATE ON public.badminton_games
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_updated_at();

CREATE TRIGGER trg_badminton_rallies_updated_at
  BEFORE UPDATE ON public.badminton_rallies
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_updated_at();

-- 4. Indexes
CREATE INDEX idx_badminton_games_match_id ON public.badminton_games(match_id);
CREATE UNIQUE INDEX idx_badminton_games_match_number ON public.badminton_games(match_id, game_number);

CREATE INDEX idx_badminton_rallies_match_id ON public.badminton_rallies(match_id);
CREATE INDEX idx_badminton_rallies_game_seq ON public.badminton_rallies(game_id, sequence_number);
CREATE INDEX idx_badminton_rallies_game_voided ON public.badminton_rallies(game_id) WHERE voided_at IS NULL;
CREATE UNIQUE INDEX idx_badminton_rallies_idempotency ON public.badminton_rallies(game_id, client_event_id);

-- 5. Row Level Security (RLS)
ALTER TABLE public.badminton_games ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.badminton_rallies ENABLE ROW LEVEL SECURITY;

-- Games: SELECT (Matches parent match visibility for authenticated)
CREATE POLICY "badminton_games_select_authorized"
  ON public.badminton_games
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.matches m
      WHERE m.id = badminton_games.match_id
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

-- Games: Public / Spectator SELECT for non-draft matches
CREATE POLICY "badminton_games_select_public"
  ON public.badminton_games
  FOR SELECT
  TO anon, authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.matches m
      WHERE m.id = badminton_games.match_id
      AND m.status IN ('SCHEDULED', 'WARMUP', 'LIVE', 'PAUSED', 'COMPLETED')
    )
  );

-- Games: INSERT / UPDATE (Only authorized scorers or org managers)
CREATE POLICY "badminton_games_modify_authorized"
  ON public.badminton_games
  FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.matches m
      WHERE m.id = badminton_games.match_id
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
      WHERE m.id = badminton_games.match_id
      AND (
        public.is_super_admin()
        OR (m.organization_id IS NOT NULL AND public.has_org_role(m.organization_id, ARRAY['OWNER'::public.app_role, 'MANAGER'::public.app_role]))
        OR m.created_by = auth.uid()
        OR m.scorer_user_id = auth.uid()
      )
    )
  );

-- Rallies: SELECT (Matches parent match visibility for authenticated)
CREATE POLICY "badminton_rallies_select_authorized"
  ON public.badminton_rallies
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.matches m
      WHERE m.id = badminton_rallies.match_id
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

-- Rallies: Public / Spectator SELECT for active or completed matches
CREATE POLICY "badminton_rallies_select_public"
  ON public.badminton_rallies
  FOR SELECT
  TO anon, authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.matches m
      WHERE m.id = badminton_rallies.match_id
      AND m.status IN ('WARMUP', 'LIVE', 'PAUSED', 'COMPLETED')
    )
  );

-- Rallies: INSERT / UPDATE (Only authorized scorers or org managers)
CREATE POLICY "badminton_rallies_insert_authorized"
  ON public.badminton_rallies
  FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.matches m
      WHERE m.id = badminton_rallies.match_id
      AND (
        public.is_super_admin()
        OR (m.organization_id IS NOT NULL AND public.has_org_role(m.organization_id, ARRAY['OWNER'::public.app_role, 'MANAGER'::public.app_role]))
        OR m.created_by = auth.uid()
        OR m.scorer_user_id = auth.uid()
      )
    )
  );

CREATE POLICY "badminton_rallies_update_authorized"
  ON public.badminton_rallies
  FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.matches m
      WHERE m.id = badminton_rallies.match_id
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
      WHERE m.id = badminton_rallies.match_id
      AND (
        public.is_super_admin()
        OR (m.organization_id IS NOT NULL AND public.has_org_role(m.organization_id, ARRAY['OWNER'::public.app_role, 'MANAGER'::public.app_role]))
        OR m.created_by = auth.uid()
        OR m.scorer_user_id = auth.uid()
      )
    )
  );

-- Direct DELETE is explicitly NOT permitted on badminton_rallies or badminton_games
-- To ensure auditability and soft undo, no DELETE policy is created.

-- 6. Realtime Preparation
DO $$ BEGIN
  ALTER PUBLICATION supabase_realtime ADD TABLE public.badminton_games;
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  ALTER PUBLICATION supabase_realtime ADD TABLE public.badminton_rallies;
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;
