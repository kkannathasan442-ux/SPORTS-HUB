-- ============================================================================
-- Migration: 026_cricket_scoring.sql
-- Description: STEP 16B — Live Cricket Scoring Database Foundation
-- Tables: public.cricket_innings, public.cricket_deliveries
-- Enums: cricket_extras_type, cricket_dismissal_type
-- ============================================================================

-- 1. Create Enums
DO $$ BEGIN
  CREATE TYPE public.cricket_extras_type AS ENUM (
    'NONE',
    'WIDE',
    'NO_BALL',
    'BYE',
    'LEG_BYE',
    'PENALTY'
  );
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE public.cricket_dismissal_type AS ENUM (
    'BOWLED',
    'CAUGHT',
    'LBW',
    'RUN_OUT',
    'STUMPED',
    'HIT_WICKET',
    'RETIRED_HURT'
  );
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

-- 2. Table: public.cricket_innings
CREATE TABLE public.cricket_innings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  match_id UUID NOT NULL REFERENCES public.matches(id) ON DELETE CASCADE,
  innings_number INTEGER NOT NULL CHECK (innings_number > 0),
  batting_competitor_id UUID NOT NULL REFERENCES public.match_competitors(id) ON DELETE CASCADE,
  bowling_competitor_id UUID NOT NULL REFERENCES public.match_competitors(id) ON DELETE CASCADE,
  total_runs INTEGER NOT NULL DEFAULT 0 CHECK (total_runs >= 0),
  total_wickets INTEGER NOT NULL DEFAULT 0 CHECK (total_wickets >= 0 AND total_wickets <= 10),
  legal_balls INTEGER NOT NULL DEFAULT 0 CHECK (legal_balls >= 0),
  target_runs INTEGER NULL CHECK (target_runs IS NULL OR target_runs >= 0),
  is_declared BOOLEAN NOT NULL DEFAULT false,
  is_completed BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  CONSTRAINT uq_cricket_innings_number UNIQUE (match_id, innings_number),
  CONSTRAINT chk_cricket_innings_competitors_different CHECK (batting_competitor_id != bowling_competitor_id)
);

-- Ensure batting and bowling competitors belong to the same match
CREATE OR REPLACE FUNCTION public.check_cricket_innings_competitors()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
DECLARE
  v_batting_match_id UUID;
  v_bowling_match_id UUID;
BEGIN
  SELECT match_id INTO v_batting_match_id FROM public.match_competitors WHERE id = NEW.batting_competitor_id;
  SELECT match_id INTO v_bowling_match_id FROM public.match_competitors WHERE id = NEW.bowling_competitor_id;
  
  IF v_batting_match_id != NEW.match_id OR v_bowling_match_id != NEW.match_id THEN
    RAISE EXCEPTION 'Batting and bowling competitors must belong to the same match as the innings.';
  END IF;
  
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_check_cricket_innings_competitors
  BEFORE INSERT OR UPDATE ON public.cricket_innings
  FOR EACH ROW
  EXECUTE FUNCTION public.check_cricket_innings_competitors();

-- 3. Table: public.cricket_deliveries
CREATE TABLE public.cricket_deliveries (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  match_id UUID NOT NULL REFERENCES public.matches(id) ON DELETE CASCADE,
  innings_id UUID NOT NULL REFERENCES public.cricket_innings(id) ON DELETE CASCADE,
  sequence_number INTEGER NOT NULL CHECK (sequence_number > 0),
  over_number INTEGER NOT NULL CHECK (over_number >= 0),
  ball_number INTEGER NOT NULL CHECK (ball_number > 0),
  
  striker_participant_id UUID NOT NULL REFERENCES public.match_participants(id) ON DELETE RESTRICT,
  non_striker_participant_id UUID NOT NULL REFERENCES public.match_participants(id) ON DELETE RESTRICT,
  bowler_participant_id UUID NOT NULL REFERENCES public.match_participants(id) ON DELETE RESTRICT,
  
  runs_off_bat INTEGER NOT NULL DEFAULT 0 CHECK (runs_off_bat >= 0),
  extras_amount INTEGER NOT NULL DEFAULT 0 CHECK (extras_amount >= 0),
  extras_type public.cricket_extras_type NOT NULL DEFAULT 'NONE',
  
  is_legal_delivery BOOLEAN NOT NULL DEFAULT true,
  
  is_wicket BOOLEAN NOT NULL DEFAULT false,
  dismissal_type public.cricket_dismissal_type NULL,
  dismissed_participant_id UUID NULL REFERENCES public.match_participants(id) ON DELETE RESTRICT,
  fielder_participant_id UUID NULL REFERENCES public.match_participants(id) ON DELETE RESTRICT,
  
  client_event_id UUID NOT NULL,
  voided_at TIMESTAMPTZ NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  CONSTRAINT uq_cricket_deliveries_client_event UNIQUE (match_id, client_event_id),
  CONSTRAINT chk_cricket_deliveries_striker_different CHECK (striker_participant_id != non_striker_participant_id),
  
  CONSTRAINT chk_cricket_deliveries_extras CHECK (
    (extras_type = 'NONE' AND extras_amount = 0) OR
    (extras_type != 'NONE' AND extras_amount > 0) OR
    (extras_type = 'PENALTY' AND extras_amount > 0 AND runs_off_bat = 0)
  ),
  
  CONSTRAINT chk_cricket_deliveries_wicket CHECK (
    (is_wicket = false AND dismissal_type IS NULL AND dismissed_participant_id IS NULL AND fielder_participant_id IS NULL) OR
    (is_wicket = true AND dismissal_type IS NOT NULL AND dismissed_participant_id IS NOT NULL)
  )
);

-- Ensure delivery innings_id belongs to the same match
CREATE OR REPLACE FUNCTION public.check_cricket_delivery_match()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
DECLARE
  v_innings_match_id UUID;
BEGIN
  SELECT match_id INTO v_innings_match_id FROM public.cricket_innings WHERE id = NEW.innings_id;
  
  IF v_innings_match_id != NEW.match_id THEN
    RAISE EXCEPTION 'Delivery innings_id does not belong to the same match.';
  END IF;
  
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_check_cricket_delivery_match
  BEFORE INSERT OR UPDATE ON public.cricket_deliveries
  FOR EACH ROW
  EXECUTE FUNCTION public.check_cricket_delivery_match();

-- Prevent inserting active delivery without strictly sequential sequence_number
CREATE OR REPLACE FUNCTION public.check_cricket_delivery_sequence()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
DECLARE
  v_expected_sequence INTEGER;
BEGIN
  IF NEW.voided_at IS NULL THEN
    -- For active deliveries, ensure sequence is exactly MAX(sequence) + 1 for the innings
    SELECT COALESCE(MAX(sequence_number), 0) + 1 INTO v_expected_sequence
    FROM public.cricket_deliveries
    WHERE innings_id = NEW.innings_id AND voided_at IS NULL;
    
    IF NEW.sequence_number != v_expected_sequence THEN
      RAISE EXCEPTION 'Delivery sequence_number (%) must be strictly sequential (expected %).', NEW.sequence_number, v_expected_sequence;
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_check_cricket_delivery_sequence
  BEFORE INSERT ON public.cricket_deliveries
  FOR EACH ROW
  EXECUTE FUNCTION public.check_cricket_delivery_sequence();


-- Updated_at triggers
CREATE TRIGGER trg_cricket_innings_updated_at
  BEFORE UPDATE ON public.cricket_innings
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_updated_at();

CREATE TRIGGER trg_cricket_deliveries_updated_at
  BEFORE UPDATE ON public.cricket_deliveries
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_updated_at();

-- 4. RLS Policies

ALTER TABLE public.cricket_innings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.cricket_deliveries ENABLE ROW LEVEL SECURITY;

-- Innings: SELECT (Matches parent match visibility)
CREATE POLICY "cricket_innings_select_authorized"
  ON public.cricket_innings
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.matches m
      WHERE m.id = cricket_innings.match_id
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

-- Innings: INSERT / UPDATE (Only authorized scorers or admins)
CREATE POLICY "cricket_innings_modify_authorized"
  ON public.cricket_innings
  FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.matches m
      WHERE m.id = cricket_innings.match_id
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
      WHERE m.id = cricket_innings.match_id
      AND (
        public.is_super_admin()
        OR (m.organization_id IS NOT NULL AND public.has_org_role(m.organization_id, ARRAY['OWNER'::public.app_role, 'MANAGER'::public.app_role]))
        OR m.created_by = auth.uid()
        OR m.scorer_user_id = auth.uid()
      )
    )
  );

-- Deliveries: SELECT (Matches parent match visibility)
CREATE POLICY "cricket_deliveries_select_authorized"
  ON public.cricket_deliveries
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.matches m
      WHERE m.id = cricket_deliveries.match_id
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

-- Deliveries: INSERT / UPDATE (Only authorized scorers or admins)
CREATE POLICY "cricket_deliveries_modify_authorized"
  ON public.cricket_deliveries
  FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.matches m
      WHERE m.id = cricket_deliveries.match_id
      AND (
        public.is_super_admin()
        OR (m.organization_id IS NOT NULL AND public.has_org_role(m.organization_id, ARRAY['OWNER'::public.app_role, 'MANAGER'::public.app_role]))
        OR m.created_by = auth.uid()
        OR m.scorer_user_id = auth.uid()
      )
    )
  );

CREATE POLICY "cricket_deliveries_update_authorized"
  ON public.cricket_deliveries
  FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.matches m
      WHERE m.id = cricket_deliveries.match_id
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
      WHERE m.id = cricket_deliveries.match_id
      AND (
        public.is_super_admin()
        OR (m.organization_id IS NOT NULL AND public.has_org_role(m.organization_id, ARRAY['OWNER'::public.app_role, 'MANAGER'::public.app_role]))
        OR m.created_by = auth.uid()
        OR m.scorer_user_id = auth.uid()
      )
    )
  );

-- Deliveries: DELETE is explicitly NOT permitted to ensure auditability. No policy created for DELETE.

-- 5. Indexes
CREATE INDEX idx_cricket_innings_match_id ON public.cricket_innings(match_id);
CREATE UNIQUE INDEX idx_cricket_innings_match_number ON public.cricket_innings(match_id, innings_number);

CREATE INDEX idx_cricket_deliveries_match_id ON public.cricket_deliveries(match_id);
CREATE INDEX idx_cricket_deliveries_innings_seq ON public.cricket_deliveries(innings_id, sequence_number);
CREATE INDEX idx_cricket_deliveries_innings_over_ball ON public.cricket_deliveries(innings_id, over_number, ball_number);
CREATE INDEX idx_cricket_deliveries_active ON public.cricket_deliveries(innings_id) WHERE voided_at IS NULL;
CREATE UNIQUE INDEX idx_cricket_deliveries_idempotency ON public.cricket_deliveries(match_id, client_event_id);

-- 6. Realtime Preparation
-- Wrap in DO block to handle duplicate cases smoothly if run multiple times
DO $$ BEGIN
  ALTER PUBLICATION supabase_realtime ADD TABLE public.cricket_innings;
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  ALTER PUBLICATION supabase_realtime ADD TABLE public.cricket_deliveries;
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;
