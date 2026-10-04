-- ============================================================================
-- Migration: 025_matches.sql
-- Description: STEP 15B — Match / Game Management Database Foundation
-- Tables: public.matches, public.match_competitors, public.match_participants
-- Enums: match_status, match_type, match_format, match_participant_role, match_participant_status
-- ============================================================================

-- 1. Create Enums
DO $$ BEGIN
  CREATE TYPE public.match_status AS ENUM (
    'DRAFT',
    'SCHEDULED',
    'WARMUP',
    'LIVE',
    'PAUSED',
    'COMPLETED',
    'ABANDONED',
    'CANCELLED'
  );
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE public.match_type AS ENUM (
    'CASUAL',
    'PRACTICE',
    'COMPETITIVE',
    'TOURNAMENT',
    'LEAGUE'
  );
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE public.match_format AS ENUM (
    'SINGLES',
    'DOUBLES',
    'TEAM'
  );
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE public.match_participant_role AS ENUM (
    'CAPTAIN',
    'PLAYER',
    'SUBSTITUTE'
  );
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE public.match_participant_status AS ENUM (
    'INVITED',
    'CONFIRMED',
    'DECLINED',
    'PLAYING',
    'BENCH'
  );
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

-- 2. Server-side Match Reference Generator Function
-- Format: MTH-YYYYMMDD-XXXXXX (Collision-safe, non-sequential)
CREATE OR REPLACE FUNCTION public.generate_match_reference()
RETURNS TEXT
LANGUAGE plpgsql
AS $$
DECLARE
  v_date TEXT;
  v_chars TEXT := 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  v_random TEXT := '';
  v_ref TEXT;
  v_i INT;
  v_exists BOOLEAN;
BEGIN
  v_date := TO_CHAR(NOW() AT TIME ZONE 'Asia/Colombo', 'YYYYMMDD');
  LOOP
    v_random := '';
    FOR v_i IN 1..6 LOOP
      v_random := v_random || SUBSTR(v_chars, FLOOR(RANDOM() * LENGTH(v_chars) + 1)::INT, 1);
    END LOOP;
    v_ref := 'MTH-' || v_date || '-' || v_random;
    SELECT EXISTS (SELECT 1 FROM public.matches WHERE match_reference = v_ref) INTO v_exists;
    EXIT WHEN NOT v_exists;
  END LOOP;
  RETURN v_ref;
END;
$$;

-- 3. Table: public.matches
CREATE TABLE public.matches (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  match_reference VARCHAR(50) UNIQUE NOT NULL DEFAULT public.generate_match_reference(),
  sport_id UUID NOT NULL REFERENCES public.sports(id) ON DELETE RESTRICT,
  organization_id UUID REFERENCES public.organizations(id) ON DELETE RESTRICT,
  venue_id UUID REFERENCES public.venues(id) ON DELETE SET NULL,
  facility_id UUID,
  booking_id UUID UNIQUE REFERENCES public.bookings(id) ON DELETE SET NULL,
  title TEXT,
  match_type public.match_type NOT NULL DEFAULT 'CASUAL',
  match_format public.match_format NOT NULL DEFAULT 'SINGLES',
  status public.match_status NOT NULL DEFAULT 'DRAFT',
  scheduled_start TIMESTAMPTZ,
  scheduled_end TIMESTAMPTZ,
  actual_start TIMESTAMPTZ,
  actual_end TIMESTAMPTZ,
  created_by UUID NOT NULL REFERENCES auth.users(id) ON DELETE RESTRICT,
  scorer_user_id UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  winner_side TEXT,
  result_summary TEXT,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  -- Constraints
  CONSTRAINT chk_matches_winner_side CHECK (
    winner_side IS NULL OR winner_side IN ('SIDE_A', 'SIDE_B', 'DRAW', 'NO_RESULT')
  ),

  CONSTRAINT chk_matches_facility_requires_venue CHECK (
    facility_id IS NULL OR venue_id IS NOT NULL
  ),

  CONSTRAINT chk_matches_scheduled_times CHECK (
    (status IN ('DRAFT', 'CANCELLED') AND (scheduled_start IS NULL OR scheduled_end IS NULL OR scheduled_start < scheduled_end))
    OR (
      status NOT IN ('DRAFT', 'CANCELLED')
      AND scheduled_start IS NOT NULL
      AND scheduled_end IS NOT NULL
      AND scheduled_start < scheduled_end
      AND (scheduled_end - scheduled_start) >= INTERVAL '15 minutes'
      AND (scheduled_end - scheduled_start) <= INTERVAL '720 minutes'
    )
  ),

  -- Composite foreign key guarantees match.facility_id belongs to match.venue_id
  CONSTRAINT fk_matches_facility_venue
    FOREIGN KEY (facility_id, venue_id)
    REFERENCES public.facilities(id, venue_id)
    ON DELETE SET NULL
);

-- 4. Table: public.match_competitors
CREATE TABLE public.match_competitors (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  match_id UUID NOT NULL REFERENCES public.matches(id) ON DELETE CASCADE,
  side TEXT NOT NULL CHECK (side IN ('SIDE_A', 'SIDE_B')),
  team_id UUID REFERENCES public.teams(id) ON DELETE SET NULL,
  competitor_name TEXT NOT NULL CHECK (char_length(trim(competitor_name)) > 0),
  score_summary TEXT,
  is_winner BOOLEAN,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT uq_match_competitor_side UNIQUE (match_id, side),
  CONSTRAINT uq_match_competitors_id_match UNIQUE (id, match_id)
);

-- 5. Table: public.match_participants
CREATE TABLE public.match_participants (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  match_id UUID NOT NULL REFERENCES public.matches(id) ON DELETE CASCADE,
  competitor_id UUID NOT NULL,
  user_id UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  display_name TEXT NOT NULL CHECK (char_length(trim(display_name)) > 0),
  team_id UUID REFERENCES public.teams(id) ON DELETE SET NULL,
  role public.match_participant_role NOT NULL DEFAULT 'PLAYER',
  jersey_number INTEGER CHECK (jersey_number IS NULL OR (jersey_number >= 0 AND jersey_number <= 999)),
  status public.match_participant_status NOT NULL DEFAULT 'CONFIRMED',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  -- Composite foreign key guarantees competitor belongs to the same match
  CONSTRAINT fk_match_participants_competitor_match
    FOREIGN KEY (competitor_id, match_id)
    REFERENCES public.match_competitors(id, match_id)
    ON DELETE CASCADE
);

-- Partial unique index: prevents the same registered user appearing twice in the same match
CREATE UNIQUE INDEX idx_match_participants_unique_user 
ON public.match_participants (match_id, user_id) 
WHERE user_id IS NOT NULL;

-- 6. Performance Indexes
CREATE INDEX idx_matches_sport_id ON public.matches(sport_id);
CREATE INDEX idx_matches_organization_id ON public.matches(organization_id);
CREATE INDEX idx_matches_venue_id ON public.matches(venue_id);
CREATE INDEX idx_matches_facility_id ON public.matches(facility_id);
CREATE INDEX idx_matches_booking_id ON public.matches(booking_id);
CREATE INDEX idx_matches_status ON public.matches(status);
CREATE INDEX idx_matches_scheduled_start ON public.matches(scheduled_start);
CREATE INDEX idx_matches_created_by ON public.matches(created_by);

CREATE INDEX idx_match_competitors_match_id ON public.match_competitors(match_id);
CREATE INDEX idx_match_competitors_team_id ON public.match_competitors(team_id);

CREATE INDEX idx_match_participants_match_id ON public.match_participants(match_id);
CREATE INDEX idx_match_participants_competitor_id ON public.match_participants(competitor_id);
CREATE INDEX idx_match_participants_user_id ON public.match_participants(user_id);

-- 7. Trigger Functions & Triggers

-- Trigger 7A: Automated updated_at timestamps
CREATE TRIGGER trg_matches_updated_at
  BEFORE UPDATE ON public.matches
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_updated_at();

-- Trigger 7B: Tenant, Booking, Venue, and Facility Consistency
CREATE OR REPLACE FUNCTION public.handle_match_tenant_consistency()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_booking RECORD;
  v_venue RECORD;
  v_facility RECORD;
BEGIN
  -- Generate server-side match reference if missing
  IF NEW.match_reference IS NULL OR NEW.match_reference = '' THEN
    NEW.match_reference := public.generate_match_reference();
  END IF;

  -- Prevent altering match_reference on UPDATE
  IF TG_OP = 'UPDATE' AND OLD.match_reference != NEW.match_reference THEN
    RAISE EXCEPTION 'match_reference is immutable.';
  END IF;

  -- 1. Validate Booking consistency
  IF NEW.booking_id IS NOT NULL THEN
    SELECT organization_id, venue_id, facility_id, sport_id, status
    INTO v_booking
    FROM public.bookings
    WHERE id = NEW.booking_id;

    IF NOT FOUND THEN
      RAISE EXCEPTION 'Referenced booking does not exist.';
    END IF;

    -- Match organization must match booking organization
    IF NEW.organization_id IS NULL THEN
      NEW.organization_id := v_booking.organization_id;
    ELSIF NEW.organization_id != v_booking.organization_id THEN
      RAISE EXCEPTION 'Match organization_id (%) does not match booking organization_id (%).', NEW.organization_id, v_booking.organization_id;
    END IF;

    -- Match venue must match booking venue
    IF NEW.venue_id IS NULL THEN
      NEW.venue_id := v_booking.venue_id;
    ELSIF NEW.venue_id != v_booking.venue_id THEN
      RAISE EXCEPTION 'Match venue_id (%) does not match booking venue_id (%).', NEW.venue_id, v_booking.venue_id;
    END IF;

    -- Match facility must match booking facility
    IF NEW.facility_id IS NULL THEN
      NEW.facility_id := v_booking.facility_id;
    ELSIF NEW.facility_id != v_booking.facility_id THEN
      RAISE EXCEPTION 'Match facility_id (%) does not match booking facility_id (%).', NEW.facility_id, v_booking.facility_id;
    END IF;

    -- Match sport must match booking sport if booking has sport_id
    IF v_booking.sport_id IS NOT NULL AND NEW.sport_id != v_booking.sport_id THEN
      RAISE EXCEPTION 'Match sport_id (%) does not match booking sport_id (%).', NEW.sport_id, v_booking.sport_id;
    END IF;
  END IF;

  -- 2. Validate Venue consistency with Organization
  IF NEW.organization_id IS NOT NULL AND NEW.venue_id IS NOT NULL THEN
    SELECT organization_id, status INTO v_venue FROM public.venues WHERE id = NEW.venue_id;
    IF NOT FOUND THEN
      RAISE EXCEPTION 'Referenced venue does not exist.';
    END IF;

    IF v_venue.organization_id != NEW.organization_id THEN
      RAISE EXCEPTION 'Venue organization_id (%) does not match match organization_id (%).', v_venue.organization_id, NEW.organization_id;
    END IF;
  END IF;

  -- 3. Validate Facility consistency
  IF NEW.facility_id IS NOT NULL THEN
    SELECT venue_id, sport_id, status INTO v_facility FROM public.facilities WHERE id = NEW.facility_id;
    IF NOT FOUND THEN
      RAISE EXCEPTION 'Referenced facility does not exist.';
    END IF;

    -- Facility must not be ARCHIVED
    IF v_facility.status = 'ARCHIVED'::public.facility_status THEN
      RAISE EXCEPTION 'Cannot associate match with an ARCHIVED facility.';
    END IF;

    -- Facility must not be CLOSED for scheduled/live matches
    IF NEW.status IN ('SCHEDULED', 'WARMUP', 'LIVE') AND v_facility.status = 'CLOSED'::public.facility_status THEN
      RAISE EXCEPTION 'Cannot schedule or play a match on a CLOSED facility.';
    END IF;

    -- Facility sport must match match sport when facility.sport_id is not NULL
    IF v_facility.sport_id IS NOT NULL AND v_facility.sport_id != NEW.sport_id THEN
      RAISE EXCEPTION 'Facility sport (%) does not match match sport (%).', v_facility.sport_id, NEW.sport_id;
    END IF;
  END IF;

  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_matches_tenant_consistency
  BEFORE INSERT OR UPDATE ON public.matches
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_match_tenant_consistency();

-- Trigger 7C: Format Roster Completeness Function
CREATE OR REPLACE FUNCTION public.validate_match_roster_completeness(
  p_match_id UUID,
  p_format public.match_format,
  p_sport_id UUID
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_side_a_id UUID;
  v_side_b_id UUID;
  v_team_a_id UUID;
  v_team_b_id UUID;
  v_count_a INT;
  v_count_b INT;
  v_supports_team BOOLEAN;
BEGIN
  -- 1. Check exactly SIDE_A and SIDE_B exist
  SELECT id, team_id INTO v_side_a_id, v_team_a_id
  FROM public.match_competitors
  WHERE match_id = p_match_id AND side = 'SIDE_A';

  SELECT id, team_id INTO v_side_b_id, v_team_b_id
  FROM public.match_competitors
  WHERE match_id = p_match_id AND side = 'SIDE_B';

  IF v_side_a_id IS NULL OR v_side_b_id IS NULL THEN
    RAISE EXCEPTION 'Cannot transition match to SCHEDULED: both SIDE_A and SIDE_B must be configured.';
  END IF;

  -- 2. Count participants on each side
  SELECT COUNT(*) INTO v_count_a
  FROM public.match_participants
  WHERE match_id = p_match_id AND competitor_id = v_side_a_id;

  SELECT COUNT(*) INTO v_count_b
  FROM public.match_participants
  WHERE match_id = p_match_id AND competitor_id = v_side_b_id;

  IF p_format = 'SINGLES' THEN
    IF v_count_a != 1 OR v_count_b != 1 THEN
      RAISE EXCEPTION 'SINGLES format requires exactly 1 participant on each side (Found Side A: %, Side B: %).', v_count_a, v_count_b;
    END IF;
  ELSIF p_format = 'DOUBLES' THEN
    IF v_count_a != 2 OR v_count_b != 2 THEN
      RAISE EXCEPTION 'DOUBLES format requires exactly 2 participants on each side (Found Side A: %, Side B: %).', v_count_a, v_count_b;
    END IF;
  ELSIF p_format = 'TEAM' THEN
    IF v_team_a_id IS NULL OR v_team_b_id IS NULL THEN
      RAISE EXCEPTION 'TEAM format requires a team assigned to both competitors.';
    END IF;

    SELECT supports_team INTO v_supports_team FROM public.sports WHERE id = p_sport_id;
    IF v_supports_team IS FALSE THEN
      RAISE EXCEPTION 'Selected sport does not support TEAM format.';
    END IF;

    IF v_count_a < 1 OR v_count_b < 1 THEN
      RAISE EXCEPTION 'TEAM format requires at least 1 participant on each side.';
    END IF;
  END IF;
END;
$$;

-- Trigger 7D: Status Transitions & Server Timestamp Integrity
CREATE OR REPLACE FUNCTION public.handle_match_status_transitions()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  -- On INSERT, matches must start in DRAFT
  IF TG_OP = 'INSERT' THEN
    IF NEW.status != 'DRAFT' THEN
      RAISE EXCEPTION 'New matches must start in DRAFT status.';
    END IF;
    RETURN NEW;
  END IF;

  -- On UPDATE
  IF OLD.status != NEW.status THEN
    -- Check terminal state protection
    IF OLD.status IN ('COMPLETED', 'CANCELLED', 'ABANDONED') THEN
      RAISE EXCEPTION 'Cannot transition match from terminal status %.', OLD.status;
    END IF;

    -- Check valid transitions
    IF NOT (
      (OLD.status = 'DRAFT' AND NEW.status IN ('SCHEDULED', 'CANCELLED')) OR
      (OLD.status = 'SCHEDULED' AND NEW.status IN ('WARMUP', 'LIVE', 'CANCELLED')) OR
      (OLD.status = 'WARMUP' AND NEW.status IN ('LIVE', 'CANCELLED')) OR
      (OLD.status = 'LIVE' AND NEW.status IN ('PAUSED', 'COMPLETED', 'ABANDONED')) OR
      (OLD.status = 'PAUSED' AND NEW.status IN ('LIVE', 'COMPLETED', 'ABANDONED'))
    ) THEN
      RAISE EXCEPTION 'Invalid match status transition from % to %.', OLD.status, NEW.status;
    END IF;

    -- Timestamp integrity: enforce server timestamps on transition
    IF NEW.status = 'LIVE' AND OLD.status != 'PAUSED' THEN
      NEW.actual_start := NOW();
    END IF;

    IF NEW.status IN ('COMPLETED', 'ABANDONED') THEN
      NEW.actual_end := NOW();
      IF NEW.actual_start IS NULL THEN
        NEW.actual_start := COALESCE(OLD.actual_start, NOW());
      END IF;
    END IF;

    -- Check format / roster completeness before transitioning from DRAFT to SCHEDULED or LIVE
    IF NEW.status IN ('SCHEDULED', 'LIVE') AND OLD.status = 'DRAFT' THEN
      PERFORM public.validate_match_roster_completeness(NEW.id, NEW.match_format, NEW.sport_id);
    END IF;
  ELSE
    -- If status is NOT changing, ensure client cannot arbitrarily alter actual_start or actual_end
    IF OLD.actual_start IS NOT NULL AND NEW.actual_start != OLD.actual_start AND NOT public.is_super_admin() THEN
      NEW.actual_start := OLD.actual_start;
    END IF;
    IF OLD.actual_end IS NOT NULL AND NEW.actual_end != OLD.actual_end AND NOT public.is_super_admin() THEN
      NEW.actual_end := OLD.actual_end;
    END IF;
  END IF;

  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_matches_status_transitions
  BEFORE INSERT OR UPDATE ON public.matches
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_match_status_transitions();

-- Trigger 7E: Global Team Rule on Competitors
CREATE OR REPLACE FUNCTION public.handle_competitor_team_validation()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_match_org_id UUID;
  v_team_org_id UUID;
  v_team_sport_id UUID;
  v_match_sport_id UUID;
BEGIN
  IF NEW.team_id IS NOT NULL THEN
    SELECT organization_id, sport_id INTO v_match_org_id, v_match_sport_id
    FROM public.matches WHERE id = NEW.match_id;

    SELECT organization_id, sport_id INTO v_team_org_id, v_team_sport_id
    FROM public.teams WHERE id = NEW.team_id;

    -- If match is global (organization_id IS NULL), team must also be global
    IF v_match_org_id IS NULL AND v_team_org_id IS NOT NULL THEN
      RAISE EXCEPTION 'Organization-private teams cannot be used in a global match.';
    END IF;

    -- If match belongs to an org, and team belongs to an org, orgs must match
    IF v_match_org_id IS NOT NULL AND v_team_org_id IS NOT NULL AND v_team_org_id != v_match_org_id THEN
      RAISE EXCEPTION 'Cannot use a team from another organization.';
    END IF;

    -- Team sport must match match sport
    IF v_team_sport_id != v_match_sport_id THEN
      RAISE EXCEPTION 'Team sport does not match match sport.';
    END IF;
  END IF;

  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_competitor_team_validation
  BEFORE INSERT OR UPDATE ON public.match_competitors
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_competitor_team_validation();

-- Trigger 7F: Participant team consistency with competitor
CREATE OR REPLACE FUNCTION public.handle_match_participant_consistency()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_competitor RECORD;
BEGIN
  SELECT team_id INTO v_competitor FROM public.match_competitors WHERE id = NEW.competitor_id;
  IF FOUND THEN
    IF NEW.team_id IS NULL AND v_competitor.team_id IS NOT NULL THEN
      NEW.team_id := v_competitor.team_id;
    ELSIF NEW.team_id IS NOT NULL AND v_competitor.team_id IS NOT NULL AND NEW.team_id != v_competitor.team_id THEN
      RAISE EXCEPTION 'Participant team_id does not match competitor team_id.';
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_match_participant_consistency
  BEFORE INSERT OR UPDATE ON public.match_participants
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_match_participant_consistency();

-- 8. Enable Row-Level Security
ALTER TABLE public.matches ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.match_competitors ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.match_participants ENABLE ROW LEVEL SECURITY;

-- 9. RLS Policies

-- Matches: SELECT
CREATE POLICY "matches_select_authorized"
  ON public.matches
  FOR SELECT
  TO authenticated
  USING (
    organization_id IS NULL
    OR public.is_super_admin()
    OR (organization_id IS NOT NULL AND public.is_org_member(organization_id))
    OR created_by = auth.uid()
    OR scorer_user_id = auth.uid()
    OR EXISTS (
      SELECT 1 FROM public.match_participants mp
      WHERE mp.match_id = matches.id AND mp.user_id = auth.uid()
    )
  );

-- Matches: INSERT
CREATE POLICY "matches_insert_authorized"
  ON public.matches
  FOR INSERT
  TO authenticated
  WITH CHECK (
    public.is_super_admin()
    OR (organization_id IS NULL AND created_by = auth.uid())
    OR (organization_id IS NOT NULL AND public.is_org_member(organization_id) AND created_by = auth.uid())
  );

-- Matches: UPDATE
CREATE POLICY "matches_update_authorized"
  ON public.matches
  FOR UPDATE
  TO authenticated
  USING (
    public.is_super_admin()
    OR (organization_id IS NOT NULL AND public.has_org_role(organization_id, ARRAY['OWNER'::public.app_role, 'MANAGER'::public.app_role]))
    OR (created_by = auth.uid() AND status IN ('DRAFT', 'SCHEDULED'))
    OR (scorer_user_id = auth.uid())
  )
  WITH CHECK (
    public.is_super_admin()
    OR (organization_id IS NOT NULL AND public.has_org_role(organization_id, ARRAY['OWNER'::public.app_role, 'MANAGER'::public.app_role]))
    OR (created_by = auth.uid() AND status IN ('DRAFT', 'SCHEDULED'))
    OR (scorer_user_id = auth.uid())
  );

-- Matches: DELETE (Strictly DRAFT status only)
CREATE POLICY "matches_delete_draft_only"
  ON public.matches
  FOR DELETE
  TO authenticated
  USING (
    status = 'DRAFT'
    AND (
      public.is_super_admin()
      OR created_by = auth.uid()
      OR (organization_id IS NOT NULL AND public.has_org_role(organization_id, ARRAY['OWNER'::public.app_role, 'MANAGER'::public.app_role]))
    )
  );

-- Match Competitors: SELECT
CREATE POLICY "match_competitors_select"
  ON public.match_competitors
  FOR SELECT
  TO authenticated
  USING (true);

-- Match Competitors: INSERT / UPDATE / DELETE
CREATE POLICY "match_competitors_modify_authorized"
  ON public.match_competitors
  FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.matches m
      WHERE m.id = match_competitors.match_id
      AND (
        public.is_super_admin()
        OR (m.organization_id IS NOT NULL AND public.has_org_role(m.organization_id, ARRAY['OWNER'::public.app_role, 'MANAGER'::public.app_role]))
        OR (m.created_by = auth.uid() AND m.status IN ('DRAFT', 'SCHEDULED'))
        OR m.scorer_user_id = auth.uid()
      )
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.matches m
      WHERE m.id = match_competitors.match_id
      AND (
        public.is_super_admin()
        OR (m.organization_id IS NOT NULL AND public.has_org_role(m.organization_id, ARRAY['OWNER'::public.app_role, 'MANAGER'::public.app_role]))
        OR (m.created_by = auth.uid() AND m.status IN ('DRAFT', 'SCHEDULED'))
        OR m.scorer_user_id = auth.uid()
      )
    )
  );

-- Match Participants: SELECT
CREATE POLICY "match_participants_select"
  ON public.match_participants
  FOR SELECT
  TO authenticated
  USING (true);

-- Match Participants: INSERT / UPDATE / DELETE
CREATE POLICY "match_participants_modify_authorized"
  ON public.match_participants
  FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.matches m
      WHERE m.id = match_participants.match_id
      AND (
        public.is_super_admin()
        OR (m.organization_id IS NOT NULL AND public.has_org_role(m.organization_id, ARRAY['OWNER'::public.app_role, 'MANAGER'::public.app_role]))
        OR (m.created_by = auth.uid() AND m.status IN ('DRAFT', 'SCHEDULED'))
        OR m.scorer_user_id = auth.uid()
      )
    )
    OR EXISTS (
      SELECT 1 FROM public.match_competitors mc
      JOIN public.team_members tm ON tm.team_id = mc.team_id
      WHERE mc.id = match_participants.competitor_id
      AND tm.user_id = auth.uid()
      AND tm.role IN ('CAPTAIN', 'MANAGER')
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.matches m
      WHERE m.id = match_participants.match_id
      AND (
        public.is_super_admin()
        OR (m.organization_id IS NOT NULL AND public.has_org_role(m.organization_id, ARRAY['OWNER'::public.app_role, 'MANAGER'::public.app_role]))
        OR (m.created_by = auth.uid() AND m.status IN ('DRAFT', 'SCHEDULED'))
        OR m.scorer_user_id = auth.uid()
      )
    )
    OR EXISTS (
      SELECT 1 FROM public.match_competitors mc
      JOIN public.team_members tm ON tm.team_id = mc.team_id
      WHERE mc.id = match_participants.competitor_id
      AND tm.user_id = auth.uid()
      AND tm.role IN ('CAPTAIN', 'MANAGER')
    )
  );

-- Comments
COMMENT ON TABLE public.matches IS 'Core matches table managing sporting matches across individual and team sports';
COMMENT ON TABLE public.match_competitors IS 'Represents the two opposing sides (SIDE_A, SIDE_B) of a match';
COMMENT ON TABLE public.match_participants IS 'Represents individual players and squad members assigned to a competitor side';
