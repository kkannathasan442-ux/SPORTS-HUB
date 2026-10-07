-- ============================================================================
-- Migration: 034_basketball_scoring_clock_rpc.sql
-- Description: STEP 20C — Atomic Basketball Scoring & Server-Authoritative Game Clock Backend
-- Functions:
--   1. public.init_basketball_match
--   2. public.record_basketball_score
--   3. public.record_basketball_foul
--   4. public.update_basketball_clock
--   5. public.substitute_basketball_player
--   6. public.record_basketball_timeout
--   7. public.undo_basketball_event
--   8. public.progress_basketball_period
--   9. public.complete_basketball_match
--  10. public.get_basketball_match_state
-- ============================================================================

-- Helper function: Compute current authoritative remaining seconds
CREATE OR REPLACE FUNCTION public.calc_basketball_current_clock(
  p_time_remaining INTEGER,
  p_clock_status public.basketball_clock_status,
  p_last_started_at TIMESTAMPTZ
) RETURNS INTEGER
LANGUAGE plpgsql
IMMUTABLE
AS $$
BEGIN
  IF p_clock_status = 'RUNNING' AND p_last_started_at IS NOT NULL THEN
    RETURN GREATEST(0, p_time_remaining - FLOOR(EXTRACT(EPOCH FROM (NOW() - p_last_started_at)))::INTEGER);
  ELSE
    RETURN p_time_remaining;
  END IF;
END;
$$;


-- 1. INIT BASKETBALL MATCH RPC
-- Prepares a Basketball match for live scoring: validates rosters, starting 5s,
-- initializes Q1, clock, foul tracking, and timeout allocations.
CREATE OR REPLACE FUNCTION public.init_basketball_match(
  p_match_id UUID,
  p_starters_side_a UUID[] DEFAULT NULL,
  p_starters_side_b UUID[] DEFAULT NULL
) RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_match RECORD;
  v_comp_a RECORD;
  v_comp_b RECORD;
  v_count_a INTEGER := 0;
  v_count_b INTEGER := 0;
  v_period_duration INTEGER;
  v_period_1 public.basketball_periods;
  p_id UUID;
  v_starters_a UUID[];
  v_starters_b UUID[];
  v_starter_count_a INTEGER;
  v_starter_count_b INTEGER;
BEGIN
  -- 1. Lock and Verify Match
  SELECT m.*, s.slug AS sport_slug
  INTO v_match
  FROM public.matches m
  JOIN public.sports s ON s.id = m.sport_id
  WHERE m.id = p_match_id
  FOR UPDATE OF m;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'NOT_FOUND: Match not found.';
  END IF;

  IF v_match.sport_slug != 'basketball' THEN
    RAISE EXCEPTION 'INVALID_SPORT: Match is not a Basketball match (sport is %).', v_match.sport_slug;
  END IF;

  -- 2. Authorization Verification
  IF auth.uid() IS NOT NULL THEN
    IF NOT (
      public.is_super_admin()
      OR (v_match.organization_id IS NOT NULL AND public.has_org_role(v_match.organization_id, ARRAY['OWNER'::public.app_role, 'MANAGER'::public.app_role]))
      OR v_match.created_by = auth.uid()
      OR v_match.scorer_user_id = auth.uid()
    ) THEN
      RAISE EXCEPTION 'FORBIDDEN: You do not have permission to initialize this match.';
    END IF;
  ELSE
    IF current_user = 'anon' THEN
      RAISE EXCEPTION 'UNAUTHENTICATED: Anonymous users cannot initialize matches.';
    END IF;
  END IF;

  -- 3. Match Format Validation
  IF v_match.match_format != 'TEAM' THEN
    RAISE EXCEPTION 'INVALID_MATCH_FORMAT: Basketball matches must use TEAM format.';
  END IF;

  IF v_match.status IN ('COMPLETED', 'ABANDONED', 'CANCELLED') THEN
    RAISE EXCEPTION 'INVALID_MATCH_STATE: Match is in terminal state (%).', v_match.status;
  END IF;

  -- 4. Verify Competitors
  SELECT * INTO v_comp_a FROM public.match_competitors WHERE match_id = p_match_id AND side = 'SIDE_A';
  SELECT * INTO v_comp_b FROM public.match_competitors WHERE match_id = p_match_id AND side = 'SIDE_B';

  IF v_comp_a.id IS NULL OR v_comp_b.id IS NULL THEN
    RAISE EXCEPTION 'INVALID_COMPETITORS: Match must have both SIDE_A and SIDE_B competitors.';
  END IF;

  -- 5. Validate Roster Sizes (5 to 15 participants per team)
  SELECT COUNT(*) INTO v_count_a FROM public.match_participants WHERE match_id = p_match_id AND competitor_id = v_comp_a.id;
  SELECT COUNT(*) INTO v_count_b FROM public.match_participants WHERE match_id = p_match_id AND competitor_id = v_comp_b.id;

  IF v_count_a < 5 OR v_count_a > 15 THEN
    RAISE EXCEPTION 'INVALID_ROSTER: Side A must have between 5 and 15 players (found %).', v_count_a;
  END IF;

  IF v_count_b < 5 OR v_count_b > 15 THEN
    RAISE EXCEPTION 'INVALID_ROSTER: Side B must have between 5 and 15 players (found %).', v_count_b;
  END IF;

  -- 6. Resolve Starting Lineups
  -- Side A starters
  IF p_starters_side_a IS NOT NULL THEN
    IF cardinality(p_starters_side_a) != 5 THEN
      RAISE EXCEPTION 'INVALID_LINEUP: Side A must specify exactly 5 starting players.';
    END IF;
    -- Verify each starter belongs to Side A
    SELECT COUNT(DISTINCT id) INTO v_starter_count_a
    FROM public.match_participants
    WHERE id = ANY(p_starters_side_a) AND match_id = p_match_id AND competitor_id = v_comp_a.id;
    IF v_starter_count_a != 5 THEN
      RAISE EXCEPTION 'INVALID_LINEUP: All 5 Side A starters must belong to Side A roster.';
    END IF;
    v_starters_a := p_starters_side_a;
  ELSE
    -- Check if lineups already exist with 5 starters
    SELECT ARRAY_AGG(participant_id) INTO v_starters_a
    FROM public.basketball_lineups
    WHERE match_id = p_match_id AND competitor_id = v_comp_a.id AND is_on_court = true;

    IF v_starters_a IS NULL OR cardinality(v_starters_a) != 5 THEN
      -- Pick first 5 participants as default starters
      SELECT ARRAY_AGG(id) INTO v_starters_a
      FROM (
        SELECT id FROM public.match_participants
        WHERE match_id = p_match_id AND competitor_id = v_comp_a.id
        ORDER BY jersey_number ASC NULLS LAST, display_name ASC
        LIMIT 5
      ) t;
    END IF;
  END IF;

  -- Side B starters
  IF p_starters_side_b IS NOT NULL THEN
    IF cardinality(p_starters_side_b) != 5 THEN
      RAISE EXCEPTION 'INVALID_LINEUP: Side B must specify exactly 5 starting players.';
    END IF;
    SELECT COUNT(DISTINCT id) INTO v_starter_count_b
    FROM public.match_participants
    WHERE id = ANY(p_starters_side_b) AND match_id = p_match_id AND competitor_id = v_comp_b.id;
    IF v_starter_count_b != 5 THEN
      RAISE EXCEPTION 'INVALID_LINEUP: All 5 Side B starters must belong to Side B roster.';
    END IF;
    v_starters_b := p_starters_side_b;
  ELSE
    SELECT ARRAY_AGG(participant_id) INTO v_starters_b
    FROM public.basketball_lineups
    WHERE match_id = p_match_id AND competitor_id = v_comp_b.id AND is_on_court = true;

    IF v_starters_b IS NULL OR cardinality(v_starters_b) != 5 THEN
      SELECT ARRAY_AGG(id) INTO v_starters_b
      FROM (
        SELECT id FROM public.match_participants
        WHERE match_id = p_match_id AND competitor_id = v_comp_b.id
        ORDER BY jersey_number ASC NULLS LAST, display_name ASC
        LIMIT 5
      ) t;
    END IF;
  END IF;

  -- 7. Upsert basketball_lineups for all participants
  FOR p_id IN SELECT id FROM public.match_participants WHERE match_id = p_match_id AND competitor_id = v_comp_a.id LOOP
    INSERT INTO public.basketball_lineups (
      match_id, competitor_id, participant_id, is_starter, is_on_court
    ) VALUES (
      p_match_id, v_comp_a.id, p_id, p_id = ANY(v_starters_a), p_id = ANY(v_starters_a)
    ) ON CONFLICT (match_id, participant_id) DO UPDATE SET
      is_starter = EXCLUDED.is_starter,
      is_on_court = EXCLUDED.is_on_court,
      updated_at = NOW();
  END LOOP;

  FOR p_id IN SELECT id FROM public.match_participants WHERE match_id = p_match_id AND competitor_id = v_comp_b.id LOOP
    INSERT INTO public.basketball_lineups (
      match_id, competitor_id, participant_id, is_starter, is_on_court
    ) VALUES (
      p_match_id, v_comp_b.id, p_id, p_id = ANY(v_starters_b), p_id = ANY(v_starters_b)
    ) ON CONFLICT (match_id, participant_id) DO UPDATE SET
      is_starter = EXCLUDED.is_starter,
      is_on_court = EXCLUDED.is_on_court,
      updated_at = NOW();
  END LOOP;

  -- 8. Configuration Validation & Period 1 Initialization
  v_period_duration := COALESCE(
    (v_match.metadata->'basketball_config'->>'period_duration_seconds')::INTEGER,
    600
  );
  IF v_period_duration < 60 OR v_period_duration > 1800 THEN
    v_period_duration := 600;
  END IF;

  SELECT * INTO v_period_1
  FROM public.basketball_periods
  WHERE match_id = p_match_id AND period_number = 1;

  IF NOT FOUND THEN
    INSERT INTO public.basketball_periods (
      match_id,
      period_number,
      period_type,
      duration_seconds,
      time_remaining_seconds,
      clock_status,
      clock_last_started_at,
      side_a_score,
      side_b_score,
      side_a_fouls,
      side_b_fouls,
      is_completed
    ) VALUES (
      p_match_id,
      1,
      'REGULAR',
      v_period_duration,
      v_period_duration,
      'STOPPED',
      NULL,
      0,
      0,
      0,
      0,
      false
    ) RETURNING * INTO v_period_1;
  END IF;

  -- 9. Transition match lifecycle if not LIVE
  IF v_match.status = 'DRAFT' THEN
    UPDATE public.matches
    SET status = 'SCHEDULED',
        updated_at = NOW()
    WHERE id = p_match_id;

    UPDATE public.matches
    SET status = 'LIVE',
        actual_start = COALESCE(actual_start, NOW()),
        updated_at = NOW()
    WHERE id = p_match_id;
  ELSIF v_match.status IN ('SCHEDULED', 'WARMUP') THEN
    UPDATE public.matches
    SET status = 'LIVE',
        actual_start = COALESCE(actual_start, NOW()),
        updated_at = NOW()
    WHERE id = p_match_id;
  END IF;

  RETURN jsonb_build_object(
    'status', 'initialized',
    'match_id', p_match_id,
    'period_id', v_period_1.id,
    'period_number', 1,
    'duration_seconds', v_period_duration,
    'time_remaining_seconds', v_period_1.time_remaining_seconds,
    'clock_status', v_period_1.clock_status,
    'starters_side_a', v_starters_a,
    'starters_side_b', v_starters_b
  );
END;
$$;


-- 2. RECORD BASKETBALL SCORE RPC
-- Records 1pt, 2pt, or 3pt scoring event with validation of active on-court player.
-- Atomically updates period aggregate scores and player points projections.
CREATE OR REPLACE FUNCTION public.record_basketball_score(
  p_match_id UUID,
  p_period_id UUID,
  p_client_event_id UUID,
  p_side TEXT,
  p_participant_id UUID,
  p_scoring_type public.basketball_scoring_type,
  p_metadata JSONB DEFAULT '{}'::jsonb
) RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_match RECORD;
  v_existing_event public.basketball_events;
  v_period public.basketball_periods;
  v_comp public.match_competitors;
  v_part public.match_participants;
  v_lineup public.basketball_lineups;
  v_points INTEGER;
  v_clock INTEGER;
  v_seq INTEGER;
  v_new_side_a INTEGER;
  v_new_side_b INTEGER;
  v_total_a INTEGER;
  v_total_b INTEGER;
  v_event_id UUID;
BEGIN
  -- 1. Lock and Verify Match
  SELECT m.*, s.slug AS sport_slug
  INTO v_match
  FROM public.matches m
  JOIN public.sports s ON s.id = m.sport_id
  WHERE m.id = p_match_id
  FOR UPDATE OF m;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'NOT_FOUND: Match not found.';
  END IF;

  IF v_match.sport_slug != 'basketball' THEN
    RAISE EXCEPTION 'INVALID_SPORT: Match is not a Basketball match (sport is %).', v_match.sport_slug;
  END IF;

  -- 2. Authorization Verification
  IF auth.uid() IS NOT NULL THEN
    IF NOT (
      public.is_super_admin()
      OR (v_match.organization_id IS NOT NULL AND public.has_org_role(v_match.organization_id, ARRAY['OWNER'::public.app_role, 'MANAGER'::public.app_role]))
      OR v_match.created_by = auth.uid()
      OR v_match.scorer_user_id = auth.uid()
    ) THEN
      RAISE EXCEPTION 'FORBIDDEN: You do not have permission to score this match.';
    END IF;
  ELSE
    IF current_user = 'anon' THEN
      RAISE EXCEPTION 'UNAUTHENTICATED: Anonymous users cannot record score.';
    END IF;
  END IF;

  -- 3. Match Lifecycle
  IF v_match.status NOT IN ('LIVE', 'WARMUP') THEN
    RAISE EXCEPTION 'INVALID_MATCH_STATE: Match is not in an active scoring state (status: %).', v_match.status;
  END IF;

  -- Auto-transition from WARMUP to LIVE
  IF v_match.status = 'WARMUP' THEN
    UPDATE public.matches
    SET status = 'LIVE', actual_start = COALESCE(actual_start, NOW()), updated_at = NOW()
    WHERE id = p_match_id;
  END IF;

  -- 4. Idempotency Check
  SELECT * INTO v_existing_event
  FROM public.basketball_events
  WHERE match_id = p_match_id AND client_event_id = p_client_event_id;

  IF FOUND THEN
    IF v_existing_event.voided_at IS NOT NULL THEN
      RAISE EXCEPTION 'IDEMPOTENCY_CONFLICT: Event already exists but is voided.';
    END IF;

    SELECT side_a_score, side_b_score INTO v_new_side_a, v_new_side_b
    FROM public.basketball_periods WHERE id = p_period_id;

    SELECT COALESCE(SUM(side_a_score), 0), COALESCE(SUM(side_b_score), 0) INTO v_total_a, v_total_b
    FROM public.basketball_periods WHERE match_id = p_match_id;

    RETURN jsonb_build_object(
      'status', 'idempotent_replay',
      'event_id', v_existing_event.id,
      'match_id', p_match_id,
      'period_id', p_period_id,
      'sequence_number', v_existing_event.sequence_number,
      'scoring_type', v_existing_event.scoring_type,
      'points', v_existing_event.points,
      'side', v_existing_event.side,
      'participant_id', v_existing_event.participant_id,
      'period_score_side_a', v_new_side_a,
      'period_score_side_b', v_new_side_b,
      'total_score_side_a', v_total_a,
      'total_score_side_b', v_total_b,
      'game_clock_seconds', v_existing_event.game_clock_seconds
    );
  END IF;

  -- 5. Lock and Verify Period
  SELECT * INTO v_period
  FROM public.basketball_periods
  WHERE id = p_period_id AND match_id = p_match_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'NOT_FOUND: Basketball period not found.';
  END IF;

  IF v_period.is_completed THEN
    RAISE EXCEPTION 'INVALID_PERIOD: Period is already completed.';
  END IF;

  -- 6. Validate Side & Competitor
  IF p_side NOT IN ('SIDE_A', 'SIDE_B') THEN
    RAISE EXCEPTION 'INVALID_SIDE: Side must be SIDE_A or SIDE_B.';
  END IF;

  SELECT * INTO v_comp
  FROM public.match_competitors
  WHERE match_id = p_match_id AND side = p_side;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'NOT_FOUND: Competitor for % not found.', p_side;
  END IF;

  -- 7. Validate Participant belongs to team
  SELECT * INTO v_part
  FROM public.match_participants
  WHERE id = p_participant_id AND match_id = p_match_id AND competitor_id = v_comp.id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'INVALID_PLAYER: Participant does not belong to team %.', p_side;
  END IF;

  -- 8. Validate Lineup: Player must be on-court and not fouled out
  SELECT * INTO v_lineup
  FROM public.basketball_lineups
  WHERE match_id = p_match_id AND participant_id = p_participant_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'INVALID_PLAYER: Participant is not registered in match lineup.';
  END IF;

  IF v_lineup.is_fouled_out THEN
    RAISE EXCEPTION 'PLAYER_FOULED_OUT: Fouled out player cannot score.';
  END IF;

  IF NOT v_lineup.is_on_court THEN
    RAISE EXCEPTION 'PLAYER_NOT_ACTIVE: Inactive (bench) player cannot score.';
  END IF;

  -- 9. Determine Points Server-Side
  CASE p_scoring_type
    WHEN 'FREE_THROW_1PT' THEN v_points := 1;
    WHEN 'FIELD_GOAL_2PT' THEN v_points := 2;
    WHEN 'FIELD_GOAL_3PT' THEN v_points := 3;
    ELSE RAISE EXCEPTION 'INVALID_SCORING_TYPE: Unsupported scoring type: %.', p_scoring_type;
  END CASE;

  -- 10. Compute Current Game Clock
  v_clock := public.calc_basketball_current_clock(
    v_period.time_remaining_seconds,
    v_period.clock_status,
    v_period.clock_last_started_at
  );

  -- 11. Next Sequence Number
  SELECT COALESCE(MAX(sequence_number), 0) + 1 INTO v_seq
  FROM public.basketball_events
  WHERE period_id = p_period_id;

  -- 12. Insert Authoritative Event
  INSERT INTO public.basketball_events (
    match_id,
    period_id,
    sequence_number,
    client_event_id,
    side,
    competitor_id,
    participant_id,
    event_type,
    scoring_type,
    points,
    foul_type,
    game_clock_seconds,
    metadata,
    created_by
  ) VALUES (
    p_match_id,
    p_period_id,
    v_seq,
    p_client_event_id,
    p_side,
    v_comp.id,
    p_participant_id,
    'SCORE',
    p_scoring_type,
    v_points,
    NULL,
    v_clock,
    p_metadata,
    auth.uid()
  ) RETURNING id INTO v_event_id;

  -- 13. Atomically Update Period Score Projection
  IF p_side = 'SIDE_A' THEN
    UPDATE public.basketball_periods
    SET side_a_score = side_a_score + v_points,
        updated_at = NOW()
    WHERE id = p_period_id
    RETURNING side_a_score, side_b_score INTO v_new_side_a, v_new_side_b;
  ELSE
    UPDATE public.basketball_periods
    SET side_b_score = side_b_score + v_points,
        updated_at = NOW()
    WHERE id = p_period_id
    RETURNING side_a_score, side_b_score INTO v_new_side_a, v_new_side_b;
  END IF;

  -- 14. Atomically Update Player Projection
  UPDATE public.basketball_lineups
  SET points_projection = points_projection + v_points,
      updated_at = NOW()
  WHERE id = v_lineup.id;

  -- 15. Compute Total Scores
  SELECT COALESCE(SUM(side_a_score), 0), COALESCE(SUM(side_b_score), 0) INTO v_total_a, v_total_b
  FROM public.basketball_periods
  WHERE match_id = p_match_id;

  RETURN jsonb_build_object(
    'status', 'created',
    'event_id', v_event_id,
    'match_id', p_match_id,
    'period_id', p_period_id,
    'sequence_number', v_seq,
    'scoring_type', p_scoring_type,
    'points', v_points,
    'side', p_side,
    'participant_id', p_participant_id,
    'period_score_side_a', v_new_side_a,
    'period_score_side_b', v_new_side_b,
    'total_score_side_a', v_total_a,
    'total_score_side_b', v_total_b,
    'game_clock_seconds', v_clock
  );
END;
$$;


-- 3. RECORD BASKETBALL FOUL RPC
-- Records personal, technical, flagrant, or offensive foul.
-- Updates personal fouls and period team fouls; checks BONUS and FOUL-OUT.
-- On foul-out, marks player disqualified and removes them from active lineup.
CREATE OR REPLACE FUNCTION public.record_basketball_foul(
  p_match_id UUID,
  p_period_id UUID,
  p_client_event_id UUID,
  p_side TEXT,
  p_participant_id UUID,
  p_foul_type public.basketball_foul_type,
  p_metadata JSONB DEFAULT '{}'::jsonb
) RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_match RECORD;
  v_existing_event public.basketball_events;
  v_period public.basketball_periods;
  v_comp public.match_competitors;
  v_part public.match_participants;
  v_lineup public.basketball_lineups;
  v_clock INTEGER;
  v_seq INTEGER;
  v_foul_limit INTEGER;
  v_bonus_threshold INTEGER;
  v_new_personal_fouls INTEGER;
  v_new_team_fouls INTEGER;
  v_is_fouled_out BOOLEAN := false;
  v_is_bonus BOOLEAN := false;
  v_event_id UUID;
BEGIN
  -- 1. Lock and Verify Match
  SELECT m.*, s.slug AS sport_slug
  INTO v_match
  FROM public.matches m
  JOIN public.sports s ON s.id = m.sport_id
  WHERE m.id = p_match_id
  FOR UPDATE OF m;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'NOT_FOUND: Match not found.';
  END IF;

  IF v_match.sport_slug != 'basketball' THEN
    RAISE EXCEPTION 'INVALID_SPORT: Match is not a Basketball match (sport is %).', v_match.sport_slug;
  END IF;

  -- 2. Authorization Verification
  IF auth.uid() IS NOT NULL THEN
    IF NOT (
      public.is_super_admin()
      OR (v_match.organization_id IS NOT NULL AND public.has_org_role(v_match.organization_id, ARRAY['OWNER'::public.app_role, 'MANAGER'::public.app_role]))
      OR v_match.created_by = auth.uid()
      OR v_match.scorer_user_id = auth.uid()
    ) THEN
      RAISE EXCEPTION 'FORBIDDEN: You do not have permission to score this match.';
    END IF;
  ELSE
    IF current_user = 'anon' THEN
      RAISE EXCEPTION 'UNAUTHENTICATED: Anonymous users cannot record fouls.';
    END IF;
  END IF;

  -- 3. Match Lifecycle
  IF v_match.status NOT IN ('LIVE', 'WARMUP') THEN
    RAISE EXCEPTION 'INVALID_MATCH_STATE: Match is not in an active scoring state (status: %).', v_match.status;
  END IF;

  IF v_match.status = 'WARMUP' THEN
    UPDATE public.matches
    SET status = 'LIVE', actual_start = COALESCE(actual_start, NOW()), updated_at = NOW()
    WHERE id = p_match_id;
  END IF;

  -- 4. Idempotency Check
  SELECT * INTO v_existing_event
  FROM public.basketball_events
  WHERE match_id = p_match_id AND client_event_id = p_client_event_id;

  IF FOUND THEN
    IF v_existing_event.voided_at IS NOT NULL THEN
      RAISE EXCEPTION 'IDEMPOTENCY_CONFLICT: Event already exists but is voided.';
    END IF;

    SELECT fouls_projection, is_fouled_out INTO v_new_personal_fouls, v_is_fouled_out
    FROM public.basketball_lineups WHERE match_id = p_match_id AND participant_id = p_participant_id;

    SELECT CASE WHEN p_side = 'SIDE_A' THEN side_a_fouls ELSE side_b_fouls END INTO v_new_team_fouls
    FROM public.basketball_periods WHERE id = p_period_id;

    RETURN jsonb_build_object(
      'status', 'idempotent_replay',
      'event_id', v_existing_event.id,
      'match_id', p_match_id,
      'period_id', p_period_id,
      'sequence_number', v_existing_event.sequence_number,
      'foul_type', v_existing_event.foul_type,
      'side', v_existing_event.side,
      'participant_id', v_existing_event.participant_id,
      'personal_fouls', v_new_personal_fouls,
      'team_fouls', v_new_team_fouls,
      'is_fouled_out', v_is_fouled_out,
      'is_bonus', (v_new_team_fouls >= 5)
    );
  END IF;

  -- 5. Lock and Verify Period
  SELECT * INTO v_period
  FROM public.basketball_periods
  WHERE id = p_period_id AND match_id = p_match_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'NOT_FOUND: Basketball period not found.';
  END IF;

  IF v_period.is_completed THEN
    RAISE EXCEPTION 'INVALID_PERIOD: Period is already completed.';
  END IF;

  -- 6. Validate Side & Competitor
  IF p_side NOT IN ('SIDE_A', 'SIDE_B') THEN
    RAISE EXCEPTION 'INVALID_SIDE: Side must be SIDE_A or SIDE_B.';
  END IF;

  SELECT * INTO v_comp
  FROM public.match_competitors
  WHERE match_id = p_match_id AND side = p_side;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'NOT_FOUND: Competitor for % not found.', p_side;
  END IF;

  -- 7. Validate Participant
  SELECT * INTO v_part
  FROM public.match_participants
  WHERE id = p_participant_id AND match_id = p_match_id AND competitor_id = v_comp.id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'INVALID_PLAYER: Participant does not belong to team %.', p_side;
  END IF;

  -- 8. Validate Lineup
  SELECT * INTO v_lineup
  FROM public.basketball_lineups
  WHERE match_id = p_match_id AND participant_id = p_participant_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'INVALID_PLAYER: Participant is not registered in match lineup.';
  END IF;

  IF v_lineup.is_fouled_out THEN
    RAISE EXCEPTION 'PLAYER_FOULED_OUT: Fouled out player cannot commit further fouls.';
  END IF;

  IF NOT v_lineup.is_on_court THEN
    RAISE EXCEPTION 'PLAYER_NOT_ACTIVE: Inactive player cannot commit on-court foul.';
  END IF;

  -- 9. Whistle Stops the Game Clock
  IF v_period.clock_status = 'RUNNING' AND v_period.clock_last_started_at IS NOT NULL THEN
    v_clock := GREATEST(0, v_period.time_remaining_seconds - FLOOR(EXTRACT(EPOCH FROM (NOW() - v_period.clock_last_started_at)))::INTEGER);
    UPDATE public.basketball_periods
    SET time_remaining_seconds = v_clock,
        clock_status = 'STOPPED',
        clock_last_started_at = NULL,
        updated_at = NOW()
    WHERE id = p_period_id;
  ELSE
    v_clock := v_period.time_remaining_seconds;
  END IF;

  -- 10. Read Configuration Limits
  v_foul_limit := COALESCE(
    (v_match.metadata->'basketball_config'->>'foul_out_limit')::INTEGER,
    5
  );
  v_bonus_threshold := COALESCE(
    (v_match.metadata->'basketball_config'->>'team_foul_penalty_threshold')::INTEGER,
    5
  );

  -- 11. Sequence Number
  SELECT COALESCE(MAX(sequence_number), 0) + 1 INTO v_seq
  FROM public.basketball_events
  WHERE period_id = p_period_id;

  -- 12. Insert Foul Event
  INSERT INTO public.basketball_events (
    match_id,
    period_id,
    sequence_number,
    client_event_id,
    side,
    competitor_id,
    participant_id,
    event_type,
    scoring_type,
    points,
    foul_type,
    game_clock_seconds,
    metadata,
    created_by
  ) VALUES (
    p_match_id,
    p_period_id,
    v_seq,
    p_client_event_id,
    p_side,
    v_comp.id,
    p_participant_id,
    'FOUL',
    NULL,
    0,
    p_foul_type,
    v_clock,
    p_metadata,
    auth.uid()
  ) RETURNING id INTO v_event_id;

  -- 13. Update Player Personal Fouls Projection & Check Foul-Out
  v_new_personal_fouls := v_lineup.fouls_projection + 1;
  v_is_fouled_out := (v_new_personal_fouls >= v_foul_limit);

  UPDATE public.basketball_lineups
  SET fouls_projection = v_new_personal_fouls,
      is_fouled_out = v_is_fouled_out,
      is_on_court = CASE WHEN v_is_fouled_out THEN false ELSE is_on_court END,
      updated_at = NOW()
  WHERE id = v_lineup.id;

  -- 14. Update Period Team Fouls Projection & Check Bonus
  IF p_side = 'SIDE_A' THEN
    UPDATE public.basketball_periods
    SET side_a_fouls = side_a_fouls + 1,
        updated_at = NOW()
    WHERE id = p_period_id
    RETURNING side_a_fouls INTO v_new_team_fouls;
  ELSE
    UPDATE public.basketball_periods
    SET side_b_fouls = side_b_fouls + 1,
        updated_at = NOW()
    WHERE id = p_period_id
    RETURNING side_b_fouls INTO v_new_team_fouls;
  END IF;

  v_is_bonus := (v_new_team_fouls >= v_bonus_threshold);

  RETURN jsonb_build_object(
    'status', 'created',
    'event_id', v_event_id,
    'match_id', p_match_id,
    'period_id', p_period_id,
    'sequence_number', v_seq,
    'foul_type', p_foul_type,
    'side', p_side,
    'participant_id', p_participant_id,
    'personal_fouls', v_new_personal_fouls,
    'team_fouls', v_new_team_fouls,
    'is_fouled_out', v_is_fouled_out,
    'is_bonus', v_is_bonus,
    'game_clock_seconds', v_clock
  );
END;
$$;


-- 4. UPDATE BASKETBALL CLOCK RPC
-- Controls START, PAUSE, and SET_TIME operations.
-- Server maintains authoritative remaining seconds and start anchor timestamp.
CREATE OR REPLACE FUNCTION public.update_basketball_clock(
  p_match_id UUID,
  p_period_id UUID,
  p_action TEXT,
  p_seconds INTEGER DEFAULT NULL,
  p_client_event_id UUID DEFAULT NULL
) RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_match RECORD;
  v_period public.basketball_periods;
  v_elapsed INTEGER;
  v_new_remaining INTEGER;
  v_new_status public.basketball_clock_status;
  v_event_id UUID;
  v_seq INTEGER;
  v_comp_a RECORD;
BEGIN
  -- 1. Lock and Verify Match
  SELECT m.*, s.slug AS sport_slug
  INTO v_match
  FROM public.matches m
  JOIN public.sports s ON s.id = m.sport_id
  WHERE m.id = p_match_id
  FOR UPDATE OF m;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'NOT_FOUND: Match not found.';
  END IF;

  IF v_match.sport_slug != 'basketball' THEN
    RAISE EXCEPTION 'INVALID_SPORT: Match is not a Basketball match (sport is %).', v_match.sport_slug;
  END IF;

  -- 2. Authorization Verification
  IF auth.uid() IS NOT NULL THEN
    IF NOT (
      public.is_super_admin()
      OR (v_match.organization_id IS NOT NULL AND public.has_org_role(v_match.organization_id, ARRAY['OWNER'::public.app_role, 'MANAGER'::public.app_role]))
      OR v_match.created_by = auth.uid()
      OR v_match.scorer_user_id = auth.uid()
    ) THEN
      RAISE EXCEPTION 'FORBIDDEN: You do not have permission to control the clock for this match.';
    END IF;
  ELSE
    IF current_user = 'anon' THEN
      RAISE EXCEPTION 'UNAUTHENTICATED: Anonymous users cannot control the game clock.';
    END IF;
  END IF;

  -- 3. Match Lifecycle
  IF v_match.status NOT IN ('LIVE', 'WARMUP', 'PAUSED') THEN
    RAISE EXCEPTION 'INVALID_MATCH_STATE: Match is not in an active clock state (status: %).', v_match.status;
  END IF;

  -- 4. Lock Period Row
  SELECT * INTO v_period
  FROM public.basketball_periods
  WHERE id = p_period_id AND match_id = p_match_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'NOT_FOUND: Basketball period not found.';
  END IF;

  IF v_period.is_completed THEN
    RAISE EXCEPTION 'INVALID_PERIOD: Period is already completed.';
  END IF;

  SELECT * INTO v_comp_a FROM public.match_competitors WHERE match_id = p_match_id AND side = 'SIDE_A';

  -- 5. Process Actions
  CASE p_action
    WHEN 'START' THEN
      IF v_period.clock_status = 'RUNNING' THEN
        RAISE EXCEPTION 'CLOCK_ALREADY_RUNNING: Game clock is already running.';
      END IF;

      IF v_period.time_remaining_seconds <= 0 THEN
        RAISE EXCEPTION 'CLOCK_EXPIRED: Cannot start game clock when time is expired.';
      END IF;

      UPDATE public.basketball_periods
      SET clock_status = 'RUNNING',
          clock_last_started_at = NOW(),
          updated_at = NOW()
      WHERE id = p_period_id
      RETURNING * INTO v_period;

      v_new_remaining := v_period.time_remaining_seconds;
      v_new_status := 'RUNNING';

    WHEN 'PAUSE' THEN
      IF v_period.clock_status = 'RUNNING' AND v_period.clock_last_started_at IS NOT NULL THEN
        v_elapsed := GREATEST(0, FLOOR(EXTRACT(EPOCH FROM (NOW() - v_period.clock_last_started_at)))::INTEGER);
        v_new_remaining := GREATEST(0, v_period.time_remaining_seconds - v_elapsed);
        v_new_status := CASE WHEN v_new_remaining = 0 THEN 'EXPIRED'::public.basketball_clock_status ELSE 'STOPPED'::public.basketball_clock_status END;

        UPDATE public.basketball_periods
        SET time_remaining_seconds = v_new_remaining,
            clock_status = v_new_status,
            clock_last_started_at = NULL,
            updated_at = NOW()
        WHERE id = p_period_id
        RETURNING * INTO v_period;
      ELSE
        v_new_remaining := v_period.time_remaining_seconds;
        v_new_status := v_period.clock_status;
      END IF;

    WHEN 'SET_TIME' THEN
      IF p_seconds IS NULL OR p_seconds < 0 OR p_seconds > v_period.duration_seconds THEN
        RAISE EXCEPTION 'INVALID_TIME: Target time must be between 0 and % seconds.', v_period.duration_seconds;
      END IF;

      v_new_remaining := p_seconds;
      v_new_status := CASE
        WHEN p_seconds = 0 THEN 'EXPIRED'::public.basketball_clock_status
        WHEN v_period.clock_status = 'RUNNING' THEN 'RUNNING'::public.basketball_clock_status
        ELSE 'STOPPED'::public.basketball_clock_status
      END;

      UPDATE public.basketball_periods
      SET time_remaining_seconds = v_new_remaining,
          clock_status = v_new_status,
          clock_last_started_at = CASE WHEN v_new_status = 'RUNNING' THEN NOW() ELSE NULL END,
          updated_at = NOW()
      WHERE id = p_period_id
      RETURNING * INTO v_period;

    ELSE
      RAISE EXCEPTION 'INVALID_ACTION: Unknown clock action: %.', p_action;
  END CASE;

  -- 6. Log Clock Event if Client Event ID provided
  IF p_client_event_id IS NOT NULL THEN
    SELECT COALESCE(MAX(sequence_number), 0) + 1 INTO v_seq
    FROM public.basketball_events
    WHERE period_id = p_period_id;

    INSERT INTO public.basketball_events (
      match_id,
      period_id,
      sequence_number,
      client_event_id,
      side,
      competitor_id,
      participant_id,
      event_type,
      scoring_type,
      points,
      foul_type,
      game_clock_seconds,
      metadata,
      created_by
    ) VALUES (
      p_match_id,
      p_period_id,
      v_seq,
      p_client_event_id,
      'SIDE_A',
      v_comp_a.id,
      NULL,
      'CLOCK',
      NULL,
      0,
      NULL,
      v_new_remaining,
      jsonb_build_object('action', p_action, 'seconds', p_seconds),
      auth.uid()
    ) ON CONFLICT (match_id, client_event_id) DO NOTHING
    RETURNING id INTO v_event_id;
  END IF;

  RETURN jsonb_build_object(
    'status', 'clock_updated',
    'period_id', p_period_id,
    'action', p_action,
    'clock_status', v_new_status,
    'time_remaining_seconds', v_new_remaining,
    'clock_last_started_at', v_period.clock_last_started_at
  );
END;
$$;


-- 5. SUBSTITUTE BASKETBALL PLAYER RPC
-- Atomically swaps an active on-court player with an eligible bench substitute.
-- Dead-ball enforced (clock must be STOPPED). Guarantees exactly 5 on-court players.
CREATE OR REPLACE FUNCTION public.substitute_basketball_player(
  p_match_id UUID,
  p_period_id UUID,
  p_client_event_id UUID,
  p_side TEXT,
  p_outgoing_participant_id UUID,
  p_incoming_participant_id UUID,
  p_metadata JSONB DEFAULT '{}'::jsonb
) RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_match RECORD;
  v_existing_event public.basketball_events;
  v_period public.basketball_periods;
  v_comp public.match_competitors;
  v_lineup_out public.basketball_lineups;
  v_lineup_in public.basketball_lineups;
  v_court_count INTEGER;
  v_seq INTEGER;
  v_event_id UUID;
BEGIN
  -- 1. Lock and Verify Match
  SELECT m.*, s.slug AS sport_slug
  INTO v_match
  FROM public.matches m
  JOIN public.sports s ON s.id = m.sport_id
  WHERE m.id = p_match_id
  FOR UPDATE OF m;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'NOT_FOUND: Match not found.';
  END IF;

  IF v_match.sport_slug != 'basketball' THEN
    RAISE EXCEPTION 'INVALID_SPORT: Match is not a Basketball match (sport is %).', v_match.sport_slug;
  END IF;

  -- 2. Authorization Verification
  IF auth.uid() IS NOT NULL THEN
    IF NOT (
      public.is_super_admin()
      OR (v_match.organization_id IS NOT NULL AND public.has_org_role(v_match.organization_id, ARRAY['OWNER'::public.app_role, 'MANAGER'::public.app_role]))
      OR v_match.created_by = auth.uid()
      OR v_match.scorer_user_id = auth.uid()
    ) THEN
      RAISE EXCEPTION 'FORBIDDEN: You do not have permission to substitute players.';
    END IF;
  ELSE
    IF current_user = 'anon' THEN
      RAISE EXCEPTION 'UNAUTHENTICATED: Anonymous users cannot make substitutions.';
    END IF;
  END IF;

  -- 3. Match Lifecycle
  IF v_match.status NOT IN ('LIVE', 'WARMUP', 'PAUSED') THEN
    RAISE EXCEPTION 'INVALID_MATCH_STATE: Match is not in an active state (status: %).', v_match.status;
  END IF;

  -- 4. Idempotency Check
  SELECT * INTO v_existing_event
  FROM public.basketball_events
  WHERE match_id = p_match_id AND client_event_id = p_client_event_id;

  IF FOUND THEN
    IF v_existing_event.voided_at IS NOT NULL THEN
      RAISE EXCEPTION 'IDEMPOTENCY_CONFLICT: Event already exists but is voided.';
    END IF;

    RETURN jsonb_build_object(
      'status', 'idempotent_replay',
      'event_id', v_existing_event.id,
      'match_id', p_match_id,
      'period_id', p_period_id,
      'sequence_number', v_existing_event.sequence_number,
      'outgoing_participant_id', p_outgoing_participant_id,
      'incoming_participant_id', p_incoming_participant_id
    );
  END IF;

  -- 5. Lock and Verify Period
  SELECT * INTO v_period
  FROM public.basketball_periods
  WHERE id = p_period_id AND match_id = p_match_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'NOT_FOUND: Basketball period not found.';
  END IF;

  IF v_period.is_completed THEN
    RAISE EXCEPTION 'INVALID_PERIOD: Period is already completed.';
  END IF;

  -- 6. Dead-Ball Invariant (Clock must be STOPPED)
  IF v_period.clock_status = 'RUNNING' THEN
    RAISE EXCEPTION 'CLOCK_NOT_STOPPED: Substitutions can only be performed when the game clock is stopped.';
  END IF;

  -- 7. Validate Side & Competitor
  IF p_side NOT IN ('SIDE_A', 'SIDE_B') THEN
    RAISE EXCEPTION 'INVALID_SIDE: Side must be SIDE_A or SIDE_B.';
  END IF;

  SELECT * INTO v_comp
  FROM public.match_competitors
  WHERE match_id = p_match_id AND side = p_side;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'NOT_FOUND: Competitor for % not found.', p_side;
  END IF;

  IF p_outgoing_participant_id = p_incoming_participant_id THEN
    RAISE EXCEPTION 'INVALID_SUBSTITUTION: Outgoing and incoming players must be different.';
  END IF;

  -- 8. Lock Lineup Rows
  SELECT * INTO v_lineup_out
  FROM public.basketball_lineups
  WHERE match_id = p_match_id AND competitor_id = v_comp.id AND participant_id = p_outgoing_participant_id
  FOR UPDATE;

  SELECT * INTO v_lineup_in
  FROM public.basketball_lineups
  WHERE match_id = p_match_id AND competitor_id = v_comp.id AND participant_id = p_incoming_participant_id
  FOR UPDATE;

  IF v_lineup_out.id IS NULL THEN
    RAISE EXCEPTION 'INVALID_SUBSTITUTION: Outgoing participant does not belong to team %.', p_side;
  END IF;

  IF v_lineup_in.id IS NULL THEN
    RAISE EXCEPTION 'INVALID_SUBSTITUTION: Incoming participant does not belong to team %.', p_side;
  END IF;

  -- Incoming player cannot be fouled out
  IF v_lineup_in.is_fouled_out THEN
    RAISE EXCEPTION 'PLAYER_FOULED_OUT: Fouled-out player cannot enter the court.';
  END IF;

  -- Incoming player cannot already be on court
  IF v_lineup_in.is_on_court THEN
    RAISE EXCEPTION 'INVALID_SUBSTITUTION: Incoming player is already on the court.';
  END IF;

  -- Outgoing player must be on court OR must have just fouled out (leaving court vacant)
  IF NOT v_lineup_out.is_on_court AND NOT v_lineup_out.is_fouled_out THEN
    RAISE EXCEPTION 'PLAYER_NOT_ACTIVE: Outgoing player is not currently active on court.';
  END IF;

  -- 9. Perform Swap Atomically
  UPDATE public.basketball_lineups
  SET is_on_court = false, updated_at = NOW()
  WHERE id = v_lineup_out.id;

  UPDATE public.basketball_lineups
  SET is_on_court = true, updated_at = NOW()
  WHERE id = v_lineup_in.id;

  -- 10. Enforce Exactly 5 On-Court Players Invariant
  SELECT COUNT(*) INTO v_court_count
  FROM public.basketball_lineups
  WHERE match_id = p_match_id AND competitor_id = v_comp.id AND is_on_court = true;

  IF v_court_count != 5 THEN
    RAISE EXCEPTION 'INVALID_SUBSTITUTION: Exactly 5 players must be on court (found %).', v_court_count;
  END IF;

  -- 11. Sequence Number
  SELECT COALESCE(MAX(sequence_number), 0) + 1 INTO v_seq
  FROM public.basketball_events
  WHERE period_id = p_period_id;

  -- 12. Insert Substitution Event
  INSERT INTO public.basketball_events (
    match_id,
    period_id,
    sequence_number,
    client_event_id,
    side,
    competitor_id,
    participant_id,
    event_type,
    scoring_type,
    points,
    foul_type,
    game_clock_seconds,
    metadata,
    created_by
  ) VALUES (
    p_match_id,
    p_period_id,
    v_seq,
    p_client_event_id,
    p_side,
    v_comp.id,
    p_incoming_participant_id,
    'SUBSTITUTION',
    NULL,
    0,
    NULL,
    v_period.time_remaining_seconds,
    p_metadata || jsonb_build_object(
      'outgoing_participant_id', p_outgoing_participant_id,
      'incoming_participant_id', p_incoming_participant_id
    ),
    auth.uid()
  ) RETURNING id INTO v_event_id;

  RETURN jsonb_build_object(
    'status', 'substituted',
    'event_id', v_event_id,
    'match_id', p_match_id,
    'period_id', p_period_id,
    'sequence_number', v_seq,
    'outgoing_participant_id', p_outgoing_participant_id,
    'incoming_participant_id', p_incoming_participant_id
  );
END;
$$;


-- 6. RECORD BASKETBALL TIMEOUT RPC
-- Deducts timeout from available allocation (default 4 for regulation, 1 for OT).
-- Stops game clock and appends TIMEOUT event.
CREATE OR REPLACE FUNCTION public.record_basketball_timeout(
  p_match_id UUID,
  p_period_id UUID,
  p_client_event_id UUID,
  p_side TEXT,
  p_metadata JSONB DEFAULT '{}'::jsonb
) RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_match RECORD;
  v_existing_event public.basketball_events;
  v_period public.basketball_periods;
  v_comp public.match_competitors;
  v_clock INTEGER;
  v_seq INTEGER;
  v_used_timeouts INTEGER;
  v_max_timeouts INTEGER;
  v_event_id UUID;
BEGIN
  -- 1. Lock and Verify Match
  SELECT m.*, s.slug AS sport_slug
  INTO v_match
  FROM public.matches m
  JOIN public.sports s ON s.id = m.sport_id
  WHERE m.id = p_match_id
  FOR UPDATE OF m;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'NOT_FOUND: Match not found.';
  END IF;

  IF v_match.sport_slug != 'basketball' THEN
    RAISE EXCEPTION 'INVALID_SPORT: Match is not a Basketball match (sport is %).', v_match.sport_slug;
  END IF;

  -- 2. Authorization Verification
  IF auth.uid() IS NOT NULL THEN
    IF NOT (
      public.is_super_admin()
      OR (v_match.organization_id IS NOT NULL AND public.has_org_role(v_match.organization_id, ARRAY['OWNER'::public.app_role, 'MANAGER'::public.app_role]))
      OR v_match.created_by = auth.uid()
      OR v_match.scorer_user_id = auth.uid()
    ) THEN
      RAISE EXCEPTION 'FORBIDDEN: You do not have permission to call timeout.';
    END IF;
  ELSE
    IF current_user = 'anon' THEN
      RAISE EXCEPTION 'UNAUTHENTICATED: Anonymous users cannot call timeout.';
    END IF;
  END IF;

  -- 3. Match Lifecycle
  IF v_match.status NOT IN ('LIVE', 'WARMUP') THEN
    RAISE EXCEPTION 'INVALID_MATCH_STATE: Match is not in an active scoring state (status: %).', v_match.status;
  END IF;

  -- 4. Idempotency Check
  SELECT * INTO v_existing_event
  FROM public.basketball_events
  WHERE match_id = p_match_id AND client_event_id = p_client_event_id;

  IF FOUND THEN
    IF v_existing_event.voided_at IS NOT NULL THEN
      RAISE EXCEPTION 'IDEMPOTENCY_CONFLICT: Event already exists but is voided.';
    END IF;

    RETURN jsonb_build_object(
      'status', 'idempotent_replay',
      'event_id', v_existing_event.id,
      'match_id', p_match_id,
      'period_id', p_period_id,
      'sequence_number', v_existing_event.sequence_number,
      'side', p_side
    );
  END IF;

  -- 5. Lock and Verify Period
  SELECT * INTO v_period
  FROM public.basketball_periods
  WHERE id = p_period_id AND match_id = p_match_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'NOT_FOUND: Basketball period not found.';
  END IF;

  IF v_period.is_completed THEN
    RAISE EXCEPTION 'INVALID_PERIOD: Period is already completed.';
  END IF;

  -- 6. Validate Competitor
  IF p_side NOT IN ('SIDE_A', 'SIDE_B') THEN
    RAISE EXCEPTION 'INVALID_SIDE: Side must be SIDE_A or SIDE_B.';
  END IF;

  SELECT * INTO v_comp
  FROM public.match_competitors
  WHERE match_id = p_match_id AND side = p_side;

  -- 7. Timeout Balance Validation
  IF v_period.period_type = 'REGULAR' THEN
    SELECT COUNT(*) INTO v_used_timeouts
    FROM public.basketball_events e
    JOIN public.basketball_periods p ON p.id = e.period_id
    WHERE e.match_id = p_match_id
      AND e.competitor_id = v_comp.id
      AND e.event_type = 'TIMEOUT'
      AND e.voided_at IS NULL
      AND p.period_type = 'REGULAR';

    v_max_timeouts := COALESCE(
      (v_match.metadata->'basketball_config'->>'timeouts_per_team_regulation')::INTEGER,
      (v_match.metadata->'basketball_config'->>'timeouts_per_regulation')::INTEGER,
      4
    );
  ELSE
    SELECT COUNT(*) INTO v_used_timeouts
    FROM public.basketball_events
    WHERE match_id = p_match_id
      AND period_id = p_period_id
      AND competitor_id = v_comp.id
      AND event_type = 'TIMEOUT'
      AND voided_at IS NULL;

    v_max_timeouts := COALESCE(
      (v_match.metadata->'basketball_config'->>'timeouts_per_team_overtime')::INTEGER,
      (v_match.metadata->'basketball_config'->>'timeouts_per_overtime')::INTEGER,
      1
    );
  END IF;

  IF v_used_timeouts >= v_max_timeouts THEN
    RAISE EXCEPTION 'TIMEOUT_EXHAUSTED: Team % has no timeouts remaining (used % of %).', p_side, v_used_timeouts, v_max_timeouts;
  END IF;

  -- 8. Timeout Stops the Game Clock
  IF v_period.clock_status = 'RUNNING' AND v_period.clock_last_started_at IS NOT NULL THEN
    v_clock := GREATEST(0, v_period.time_remaining_seconds - FLOOR(EXTRACT(EPOCH FROM (NOW() - v_period.clock_last_started_at)))::INTEGER);
    UPDATE public.basketball_periods
    SET time_remaining_seconds = v_clock,
        clock_status = 'STOPPED',
        clock_last_started_at = NULL,
        updated_at = NOW()
    WHERE id = p_period_id;
  ELSE
    v_clock := v_period.time_remaining_seconds;
  END IF;

  -- 9. Sequence Number
  SELECT COALESCE(MAX(sequence_number), 0) + 1 INTO v_seq
  FROM public.basketball_events
  WHERE period_id = p_period_id;

  -- 10. Insert Timeout Event
  INSERT INTO public.basketball_events (
    match_id,
    period_id,
    sequence_number,
    client_event_id,
    side,
    competitor_id,
    participant_id,
    event_type,
    scoring_type,
    points,
    foul_type,
    game_clock_seconds,
    metadata,
    created_by
  ) VALUES (
    p_match_id,
    p_period_id,
    v_seq,
    p_client_event_id,
    p_side,
    v_comp.id,
    NULL,
    'TIMEOUT',
    NULL,
    0,
    NULL,
    v_clock,
    p_metadata,
    auth.uid()
  ) RETURNING id INTO v_event_id;

  RETURN jsonb_build_object(
    'status', 'timeout_recorded',
    'event_id', v_event_id,
    'match_id', p_match_id,
    'period_id', p_period_id,
    'sequence_number', v_seq,
    'side', p_side,
    'remaining_timeouts', v_max_timeouts - (v_used_timeouts + 1),
    'game_clock_seconds', v_clock
  );
END;
$$;


-- 7. UNDO BASKETBALL EVENT RPC
-- Reverses the latest active event in current match.
-- Sets voided_at = NOW() (soft undo) and rolls back points, fouls, or lineups atomically.
CREATE OR REPLACE FUNCTION public.undo_basketball_event(
  p_match_id UUID,
  p_event_id UUID DEFAULT NULL
) RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_match RECORD;
  v_latest_event public.basketball_events;
  v_period public.basketball_periods;
  v_out_id UUID;
  v_in_id UUID;
  v_foul_limit INTEGER;
  v_new_personal_fouls INTEGER;
BEGIN
  -- 1. Lock and Verify Match
  SELECT m.*, s.slug AS sport_slug
  INTO v_match
  FROM public.matches m
  JOIN public.sports s ON s.id = m.sport_id
  WHERE m.id = p_match_id
  FOR UPDATE OF m;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'NOT_FOUND: Match not found.';
  END IF;

  IF v_match.sport_slug != 'basketball' THEN
    RAISE EXCEPTION 'INVALID_SPORT: Match is not a Basketball match.';
  END IF;

  -- 2. Authorization Verification
  IF auth.uid() IS NOT NULL THEN
    IF NOT (
      public.is_super_admin()
      OR (v_match.organization_id IS NOT NULL AND public.has_org_role(v_match.organization_id, ARRAY['OWNER'::public.app_role, 'MANAGER'::public.app_role]))
      OR v_match.created_by = auth.uid()
      OR v_match.scorer_user_id = auth.uid()
    ) THEN
      RAISE EXCEPTION 'FORBIDDEN: You do not have permission to undo events on this match.';
    END IF;
  ELSE
    IF current_user = 'anon' THEN
      RAISE EXCEPTION 'UNAUTHENTICATED: Anonymous users cannot undo events.';
    END IF;
  END IF;

  -- 3. Match Lifecycle
  IF v_match.status IN ('COMPLETED', 'ABANDONED', 'CANCELLED') THEN
    RAISE EXCEPTION 'INVALID_MATCH_STATE: Match is already in a terminal state (status: %).', v_match.status;
  END IF;

  -- 4. Find Latest Active Event
  SELECT * INTO v_latest_event
  FROM public.basketball_events
  WHERE match_id = p_match_id AND voided_at IS NULL
  ORDER BY sequence_number DESC, created_at DESC
  LIMIT 1
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'NO_ACTIVE_EVENT: No active event found to undo.';
  END IF;

  IF p_event_id IS NOT NULL AND v_latest_event.id != p_event_id THEN
    RAISE EXCEPTION 'INVALID_UNDO: Only the most recent active event can be undone (latest ID is %).', v_latest_event.id;
  END IF;

  -- 5. Lock Period Row
  SELECT * INTO v_period
  FROM public.basketball_periods
  WHERE id = v_latest_event.period_id
  FOR UPDATE;

  IF v_period.is_completed THEN
    RAISE EXCEPTION 'PERIOD_COMPLETED: Cannot undo events from a completed period.';
  END IF;

  -- 6. Soft Undo (Void Event)
  UPDATE public.basketball_events
  SET voided_at = NOW(), updated_at = NOW()
  WHERE id = v_latest_event.id;

  -- 7. Reverse Authoritative Effects
  CASE v_latest_event.event_type
    WHEN 'SCORE' THEN
      -- Revert period score
      IF v_latest_event.side = 'SIDE_A' THEN
        UPDATE public.basketball_periods
        SET side_a_score = GREATEST(0, side_a_score - v_latest_event.points), updated_at = NOW()
        WHERE id = v_period.id;
      ELSE
        UPDATE public.basketball_periods
        SET side_b_score = GREATEST(0, side_b_score - v_latest_event.points), updated_at = NOW()
        WHERE id = v_period.id;
      END IF;

      -- Revert player points projection
      IF v_latest_event.participant_id IS NOT NULL THEN
        UPDATE public.basketball_lineups
        SET points_projection = GREATEST(0, points_projection - v_latest_event.points), updated_at = NOW()
        WHERE match_id = p_match_id AND participant_id = v_latest_event.participant_id;
      END IF;

    WHEN 'FOUL' THEN
      -- Revert period team fouls
      IF v_latest_event.side = 'SIDE_A' THEN
        UPDATE public.basketball_periods
        SET side_a_fouls = GREATEST(0, side_a_fouls - 1), updated_at = NOW()
        WHERE id = v_period.id;
      ELSE
        UPDATE public.basketball_periods
        SET side_b_fouls = GREATEST(0, side_b_fouls - 1), updated_at = NOW()
        WHERE id = v_period.id;
      END IF;

      -- Revert player personal fouls
      IF v_latest_event.participant_id IS NOT NULL THEN
        v_foul_limit := COALESCE(
          (v_match.metadata->'basketball_config'->>'foul_out_limit')::INTEGER,
          5
        );

        UPDATE public.basketball_lineups
        SET fouls_projection = GREATEST(0, fouls_projection - 1),
            is_fouled_out = CASE WHEN (fouls_projection - 1) < v_foul_limit THEN false ELSE is_fouled_out END,
            updated_at = NOW()
        WHERE match_id = p_match_id AND participant_id = v_latest_event.participant_id
        RETURNING fouls_projection INTO v_new_personal_fouls;
      END IF;

    WHEN 'SUBSTITUTION' THEN
      -- Revert lineup swap
      v_out_id := (v_latest_event.metadata->>'outgoing_participant_id')::UUID;
      v_in_id := (v_latest_event.metadata->>'incoming_participant_id')::UUID;

      IF v_out_id IS NOT NULL AND v_in_id IS NOT NULL THEN
        UPDATE public.basketball_lineups
        SET is_on_court = false, updated_at = NOW()
        WHERE match_id = p_match_id AND participant_id = v_in_id;

        UPDATE public.basketball_lineups
        SET is_on_court = true, updated_at = NOW()
        WHERE match_id = p_match_id AND participant_id = v_out_id AND is_fouled_out = false;
      END IF;

    WHEN 'TIMEOUT' THEN
      -- Voiding event automatically restores timeout balance.
      NULL;

    WHEN 'CLOCK' THEN
      -- Voided clock audit entry.
      NULL;

    WHEN 'PERIOD' THEN
      -- Handled via period progression.
      NULL;
  END CASE;

  RETURN jsonb_build_object(
    'status', 'undone',
    'undone_event_id', v_latest_event.id,
    'event_type', v_latest_event.event_type,
    'period_id', v_period.id,
    'sequence_number', v_latest_event.sequence_number,
    'match_id', p_match_id
  );
END;
$$;


-- 8. PROGRESS BASKETBALL PERIOD RPC
-- Controls progression: Q1 -> Q2 -> Q3 -> Q4 -> OT1 -> OT2...
-- Resets period team fouls, initializes clock to duration, checks regulation winner or overtime tie.
CREATE OR REPLACE FUNCTION public.progress_basketball_period(
  p_match_id UUID
) RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_match RECORD;
  v_current_period public.basketball_periods;
  v_next_period public.basketball_periods;
  v_reg_count INTEGER;
  v_period_dur INTEGER;
  v_ot_dur INTEGER;
  v_ot_enabled BOOLEAN;
  v_total_a INTEGER;
  v_total_b INTEGER;
  v_next_num INTEGER;
  v_cur_clock INTEGER;
  v_winner_side TEXT;
  v_comp_winner RECORD;
  v_summary TEXT;
BEGIN
  -- 1. Lock and Verify Match
  SELECT m.*, s.slug AS sport_slug
  INTO v_match
  FROM public.matches m
  JOIN public.sports s ON s.id = m.sport_id
  WHERE m.id = p_match_id
  FOR UPDATE OF m;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'NOT_FOUND: Match not found.';
  END IF;

  IF v_match.sport_slug != 'basketball' THEN
    RAISE EXCEPTION 'INVALID_SPORT: Match is not a Basketball match (sport is %).', v_match.sport_slug;
  END IF;

  -- 2. Authorization Verification
  IF auth.uid() IS NOT NULL THEN
    IF NOT (
      public.is_super_admin()
      OR (v_match.organization_id IS NOT NULL AND public.has_org_role(v_match.organization_id, ARRAY['OWNER'::public.app_role, 'MANAGER'::public.app_role]))
      OR v_match.created_by = auth.uid()
      OR v_match.scorer_user_id = auth.uid()
    ) THEN
      RAISE EXCEPTION 'FORBIDDEN: You do not have permission to progress this match.';
    END IF;
  ELSE
    IF current_user = 'anon' THEN
      RAISE EXCEPTION 'UNAUTHENTICATED: Anonymous users cannot progress periods.';
    END IF;
  END IF;

  -- 3. Check Lifecycle
  IF v_match.status = 'COMPLETED' THEN
    RETURN jsonb_build_object(
      'status', 'match_already_completed',
      'match_id', p_match_id,
      'winner_side', v_match.winner_side,
      'result_summary', v_match.result_summary
    );
  END IF;

  IF v_match.status NOT IN ('LIVE', 'WARMUP', 'PAUSED') THEN
    RAISE EXCEPTION 'INVALID_MATCH_STATE: Match is not active (status: %).', v_match.status;
  END IF;

  -- 4. Find Active Period
  SELECT * INTO v_current_period
  FROM public.basketball_periods
  WHERE match_id = p_match_id AND is_completed = false
  ORDER BY period_number DESC
  LIMIT 1
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'NO_ACTIVE_PERIOD: No active period found to progress.';
  END IF;

  -- 5. Clock Validation: Cannot progress while clock is still actively ticking down with remaining time
  IF v_current_period.clock_status = 'RUNNING' THEN
    v_cur_clock := GREATEST(0, v_current_period.time_remaining_seconds - FLOOR(EXTRACT(EPOCH FROM (NOW() - v_current_period.clock_last_started_at)))::INTEGER);
    IF v_cur_clock > 0 THEN
      RAISE EXCEPTION 'CLOCK_NOT_STOPPED: Cannot progress period while game clock is actively running (%s remaining).', v_cur_clock;
    END IF;
  END IF;

  -- 6. Mark Current Period Completed
  UPDATE public.basketball_periods
  SET is_completed = true,
      clock_status = 'EXPIRED',
      time_remaining_seconds = 0,
      clock_last_started_at = NULL,
      completed_at = NOW(),
      updated_at = NOW()
  WHERE id = v_current_period.id;

  -- 7. Configuration Parameters
  v_reg_count := COALESCE(
    (v_match.metadata->'basketball_config'->>'regulation_period_count')::INTEGER,
    4
  );
  v_period_dur := COALESCE(
    (v_match.metadata->'basketball_config'->>'period_duration_seconds')::INTEGER,
    600
  );
  v_ot_dur := COALESCE(
    (v_match.metadata->'basketball_config'->>'overtime_duration_seconds')::INTEGER,
    300
  );
  v_ot_enabled := COALESCE(
    (v_match.metadata->'basketball_config'->>'overtime_enabled')::BOOLEAN,
    true
  );

  -- 8. Compute Total Aggregate Scores Across All Periods
  SELECT COALESCE(SUM(side_a_score), 0), COALESCE(SUM(side_b_score), 0) INTO v_total_a, v_total_b
  FROM public.basketball_periods
  WHERE match_id = p_match_id;

  -- 9. Check Regulation Progression vs Overtime / Completion
  IF v_current_period.period_number < v_reg_count THEN
    -- Progress to next Regulation Quarter (Q2, Q3, Q4)
    v_next_num := v_current_period.period_number + 1;

    INSERT INTO public.basketball_periods (
      match_id,
      period_number,
      period_type,
      duration_seconds,
      time_remaining_seconds,
      clock_status,
      clock_last_started_at,
      side_a_score,
      side_b_score,
      side_a_fouls,
      side_b_fouls,
      is_completed
    ) VALUES (
      p_match_id,
      v_next_num,
      'REGULAR',
      v_period_dur,
      v_period_dur,
      'STOPPED',
      NULL,
      0,
      0,
      0,
      0,
      false
    ) RETURNING * INTO v_next_period;

    RETURN jsonb_build_object(
      'status', 'period_progressed',
      'match_id', p_match_id,
      'period_id', v_next_period.id,
      'period_number', v_next_num,
      'period_type', 'REGULAR',
      'duration_seconds', v_period_dur,
      'total_score_side_a', v_total_a,
      'total_score_side_b', v_total_b
    );

  ELSE
    -- End of Regulation (Q4) or End of Overtime
    IF v_total_a != v_total_b THEN
      -- Clear winner exists! Finalize match!
      v_winner_side := CASE WHEN v_total_a > v_total_b THEN 'SIDE_A' ELSE 'SIDE_B' END;

      SELECT * INTO v_comp_winner FROM public.match_competitors WHERE match_id = p_match_id AND side = v_winner_side;
      v_summary := format('%s won %s - %s', COALESCE(v_comp_winner.competitor_name, v_winner_side), GREATEST(v_total_a, v_total_b), LEAST(v_total_a, v_total_b));

      UPDATE public.matches
      SET status = 'COMPLETED',
          winner_side = v_winner_side,
          result_summary = v_summary,
          actual_end = NOW(),
          updated_at = NOW()
      WHERE id = p_match_id;

      RETURN jsonb_build_object(
        'status', 'match_completed',
        'match_id', p_match_id,
        'winner_side', v_winner_side,
        'total_score_side_a', v_total_a,
        'total_score_side_b', v_total_b,
        'result_summary', v_summary
      );

    ELSE
      -- Scores are tied!
      IF v_ot_enabled THEN
        -- Progress to Overtime (OT1, OT2...)
        v_next_num := v_current_period.period_number + 1;

        INSERT INTO public.basketball_periods (
          match_id,
          period_number,
          period_type,
          duration_seconds,
          time_remaining_seconds,
          clock_status,
          clock_last_started_at,
          side_a_score,
          side_b_score,
          side_a_fouls,
          side_b_fouls,
          is_completed
        ) VALUES (
          p_match_id,
          v_next_num,
          'OVERTIME',
          v_ot_dur,
          v_ot_dur,
          'STOPPED',
          NULL,
          0,
          0,
          0,
          0,
          false
        ) RETURNING * INTO v_next_period;

        RETURN jsonb_build_object(
          'status', 'overtime_created',
          'match_id', p_match_id,
          'period_id', v_next_period.id,
          'period_number', v_next_num,
          'period_type', 'OVERTIME',
          'duration_seconds', v_ot_dur,
          'total_score_side_a', v_total_a,
          'total_score_side_b', v_total_b
        );
      ELSE
        -- Overtime disabled -> Finalize as DRAW
        v_summary := format('Match ended in a DRAW %s - %s', v_total_a, v_total_b);

        UPDATE public.matches
        SET status = 'COMPLETED',
            winner_side = 'DRAW',
            result_summary = v_summary,
            actual_end = NOW(),
            updated_at = NOW()
        WHERE id = p_match_id;

        RETURN jsonb_build_object(
          'status', 'match_completed',
          'match_id', p_match_id,
          'winner_side', 'DRAW',
          'total_score_side_a', v_total_a,
          'total_score_side_b', v_total_b,
          'result_summary', v_summary
        );
      END IF;
    END IF;
  END IF;
END;
$$;


-- 9. COMPLETE BASKETBALL MATCH RPC
-- Authoritatively finalizes a Basketball match from score totals.
-- Sets winner_side, result_summary, and marks status = COMPLETED.
CREATE OR REPLACE FUNCTION public.complete_basketball_match(
  p_match_id UUID
) RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_match RECORD;
  v_active_period public.basketball_periods;
  v_total_a INTEGER;
  v_total_b INTEGER;
  v_winner_side TEXT;
  v_comp_winner RECORD;
  v_summary TEXT;
  v_ot_enabled BOOLEAN;
BEGIN
  -- 1. Lock and Verify Match
  SELECT m.*, s.slug AS sport_slug
  INTO v_match
  FROM public.matches m
  JOIN public.sports s ON s.id = m.sport_id
  WHERE m.id = p_match_id
  FOR UPDATE OF m;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'NOT_FOUND: Match not found.';
  END IF;

  IF v_match.sport_slug != 'basketball' THEN
    RAISE EXCEPTION 'INVALID_SPORT: Match is not a Basketball match (sport is %).', v_match.sport_slug;
  END IF;

  -- 2. Authorization Verification
  IF auth.uid() IS NOT NULL THEN
    IF NOT (
      public.is_super_admin()
      OR (v_match.organization_id IS NOT NULL AND public.has_org_role(v_match.organization_id, ARRAY['OWNER'::public.app_role, 'MANAGER'::public.app_role]))
      OR v_match.created_by = auth.uid()
      OR v_match.scorer_user_id = auth.uid()
    ) THEN
      RAISE EXCEPTION 'FORBIDDEN: You do not have permission to complete this match.';
    END IF;
  ELSE
    IF current_user = 'anon' THEN
      RAISE EXCEPTION 'UNAUTHENTICATED: Anonymous users cannot complete matches.';
    END IF;
  END IF;

  -- 3. Match Lifecycle
  IF v_match.status = 'COMPLETED' THEN
    RETURN jsonb_build_object(
      'status', 'match_already_completed',
      'match_id', p_match_id,
      'winner_side', v_match.winner_side,
      'result_summary', v_match.result_summary
    );
  END IF;

  IF v_match.status NOT IN ('LIVE', 'WARMUP', 'PAUSED') THEN
    RAISE EXCEPTION 'INVALID_MATCH_STATE: Match is not in an active state (status: %).', v_match.status;
  END IF;

  -- 4. Check Clock on Active Period
  SELECT * INTO v_active_period
  FROM public.basketball_periods
  WHERE match_id = p_match_id AND is_completed = false
  ORDER BY period_number DESC
  LIMIT 1
  FOR UPDATE;

  IF FOUND THEN
    IF v_active_period.clock_status = 'RUNNING' THEN
      IF public.calc_basketball_current_clock(v_active_period.time_remaining_seconds, v_active_period.clock_status, v_active_period.clock_last_started_at) > 0 THEN
        RAISE EXCEPTION 'CLOCK_RUNNING: Cannot complete match while game clock is actively running.';
      END IF;
    END IF;

    UPDATE public.basketball_periods
    SET is_completed = true,
        clock_status = 'EXPIRED',
        time_remaining_seconds = 0,
        clock_last_started_at = NULL,
        completed_at = NOW(),
        updated_at = NOW()
    WHERE id = v_active_period.id;
  END IF;

  -- 5. Total Aggregate Scores
  SELECT COALESCE(SUM(side_a_score), 0), COALESCE(SUM(side_b_score), 0) INTO v_total_a, v_total_b
  FROM public.basketball_periods
  WHERE match_id = p_match_id;

  v_ot_enabled := COALESCE(
    (v_match.metadata->'basketball_config'->>'overtime_enabled')::BOOLEAN,
    true
  );

  -- 6. Determine Winner
  IF v_total_a > v_total_b THEN
    v_winner_side := 'SIDE_A';
    SELECT * INTO v_comp_winner FROM public.match_competitors WHERE match_id = p_match_id AND side = 'SIDE_A';
    v_summary := format('%s won %s - %s', COALESCE(v_comp_winner.competitor_name, 'Side A'), v_total_a, v_total_b);
  ELSIF v_total_b > v_total_a THEN
    v_winner_side := 'SIDE_B';
    SELECT * INTO v_comp_winner FROM public.match_competitors WHERE match_id = p_match_id AND side = 'SIDE_B';
    v_summary := format('%s won %s - %s', COALESCE(v_comp_winner.competitor_name, 'Side B'), v_total_b, v_total_a);
  ELSE
    IF v_ot_enabled THEN
      RAISE EXCEPTION 'TIED_SCORE: Scores are tied (% - %). Overtime is enabled; please progress to Overtime.', v_total_a, v_total_b;
    ELSE
      v_winner_side := 'DRAW';
      v_summary := format('Match ended in a DRAW %s - %s', v_total_a, v_total_b);
    END IF;
  END IF;

  -- 7. Finalize Match
  UPDATE public.matches
  SET status = 'COMPLETED',
      winner_side = v_winner_side,
      result_summary = v_summary,
      actual_end = NOW(),
      updated_at = NOW()
  WHERE id = p_match_id;

  RETURN jsonb_build_object(
    'status', 'match_completed',
    'match_id', p_match_id,
    'winner_side', v_winner_side,
    'total_score_side_a', v_total_a,
    'total_score_side_b', v_total_b,
    'result_summary', v_summary
  );
END;
$$;


-- 10. GET BASKETBALL MATCH STATE RPC
-- Comprehensive read helper for scorers and tests to fetch authoritative match snapshot.
CREATE OR REPLACE FUNCTION public.get_basketball_match_state(
  p_match_id UUID
) RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_match RECORD;
  v_active_period public.basketball_periods;
  v_cur_clock INTEGER;
  v_total_a INTEGER;
  v_total_b INTEGER;
  v_periods JSONB;
  v_lineups_a JSONB;
  v_lineups_b JSONB;
  v_comp_a RECORD;
  v_comp_b RECORD;
  v_timeouts_a INTEGER := 0;
  v_timeouts_b INTEGER := 0;
  v_max_timeouts INTEGER := 4;
BEGIN
  SELECT m.*, s.slug AS sport_slug
  INTO v_match
  FROM public.matches m
  JOIN public.sports s ON s.id = m.sport_id
  WHERE m.id = p_match_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'NOT_FOUND: Match not found.';
  END IF;

  IF v_match.sport_slug != 'basketball' THEN
    RAISE EXCEPTION 'INVALID_SPORT: Match is not a Basketball match.';
  END IF;

  SELECT * INTO v_comp_a FROM public.match_competitors WHERE match_id = p_match_id AND side = 'SIDE_A';
  SELECT * INTO v_comp_b FROM public.match_competitors WHERE match_id = p_match_id AND side = 'SIDE_B';

  -- Total score
  SELECT COALESCE(SUM(side_a_score), 0), COALESCE(SUM(side_b_score), 0)
  INTO v_total_a, v_total_b
  FROM public.basketball_periods
  WHERE match_id = p_match_id;

  -- Active period
  SELECT * INTO v_active_period
  FROM public.basketball_periods
  WHERE match_id = p_match_id AND is_completed = false
  ORDER BY period_number DESC
  LIMIT 1;

  IF v_active_period.id IS NOT NULL THEN
    v_cur_clock := public.calc_basketball_current_clock(
      v_active_period.time_remaining_seconds,
      v_active_period.clock_status,
      v_active_period.clock_last_started_at
    );
  END IF;

  -- Periods list
  SELECT COALESCE(jsonb_agg(jsonb_build_object(
    'id', p.id,
    'period_number', p.period_number,
    'period_type', p.period_type,
    'side_a_score', p.side_a_score,
    'side_b_score', p.side_b_score,
    'side_a_fouls', p.side_a_fouls,
    'side_b_fouls', p.side_b_fouls,
    'duration_seconds', p.duration_seconds,
    'time_remaining_seconds', p.time_remaining_seconds,
    'clock_status', p.clock_status,
    'clock_last_started_at', p.clock_last_started_at,
    'is_completed', p.is_completed
  ) ORDER BY p.period_number ASC), '[]'::jsonb) INTO v_periods
  FROM public.basketball_periods p
  WHERE p.match_id = p_match_id;

  -- Lineups Side A
  SELECT COALESCE(jsonb_agg(jsonb_build_object(
    'lineup_id', l.id,
    'participant_id', l.participant_id,
    'display_name', mp.display_name,
    'jersey_number', mp.jersey_number,
    'is_starter', l.is_starter,
    'is_on_court', l.is_on_court,
    'points', l.points_projection,
    'fouls', l.fouls_projection,
    'is_fouled_out', l.is_fouled_out
  ) ORDER BY l.is_on_court DESC, mp.jersey_number ASC), '[]'::jsonb) INTO v_lineups_a
  FROM public.basketball_lineups l
  JOIN public.match_participants mp ON mp.id = l.participant_id
  WHERE l.match_id = p_match_id AND l.competitor_id = v_comp_a.id;

  -- Lineups Side B
  SELECT COALESCE(jsonb_agg(jsonb_build_object(
    'lineup_id', l.id,
    'participant_id', l.participant_id,
    'display_name', mp.display_name,
    'jersey_number', mp.jersey_number,
    'is_starter', l.is_starter,
    'is_on_court', l.is_on_court,
    'points', l.points_projection,
    'fouls', l.fouls_projection,
    'is_fouled_out', l.is_fouled_out
  ) ORDER BY l.is_on_court DESC, mp.jersey_number ASC), '[]'::jsonb) INTO v_lineups_b
  FROM public.basketball_lineups l
  JOIN public.match_participants mp ON mp.id = l.participant_id
  WHERE l.match_id = p_match_id AND l.competitor_id = v_comp_b.id;

  -- Timeouts remaining calculation
  v_max_timeouts := COALESCE(
    (v_match.metadata->'basketball_config'->>'timeouts_per_team_regulation')::INTEGER,
    (v_match.metadata->'basketball_config'->>'timeouts_per_regulation')::INTEGER,
    4
  );

  SELECT COUNT(*) INTO v_timeouts_a
  FROM public.basketball_events e
  JOIN public.basketball_periods p ON p.id = e.period_id
  WHERE e.match_id = p_match_id
    AND e.competitor_id = v_comp_a.id
    AND e.event_type = 'TIMEOUT'
    AND e.voided_at IS NULL
    AND p.period_type = 'REGULAR';

  SELECT COUNT(*) INTO v_timeouts_b
  FROM public.basketball_events e
  JOIN public.basketball_periods p ON p.id = e.period_id
  WHERE e.match_id = p_match_id
    AND e.competitor_id = v_comp_b.id
    AND e.event_type = 'TIMEOUT'
    AND e.voided_at IS NULL
    AND p.period_type = 'REGULAR';

  RETURN jsonb_build_object(
    'match_id', p_match_id,
    'match_status', v_match.status,
    'winner_side', v_match.winner_side,
    'result_summary', v_match.result_summary,
    'total_score_side_a', v_total_a,
    'total_score_side_b', v_total_b,
    'active_period', CASE WHEN v_active_period.id IS NOT NULL THEN jsonb_build_object(
      'id', v_active_period.id,
      'period_number', v_active_period.period_number,
      'period_type', v_active_period.period_type,
      'time_remaining_seconds', v_active_period.time_remaining_seconds,
      'current_remaining_seconds', v_cur_clock,
      'clock_status', v_active_period.clock_status,
      'clock_last_started_at', v_active_period.clock_last_started_at,
      'side_a_score', v_active_period.side_a_score,
      'side_b_score', v_active_period.side_b_score,
      'side_a_fouls', v_active_period.side_a_fouls,
      'side_b_fouls', v_active_period.side_b_fouls
    ) ELSE NULL END,
    'periods', v_periods,
    'lineups_side_a', v_lineups_a,
    'lineups_side_b', v_lineups_b,
    'timeouts_remaining_side_a', GREATEST(0, v_max_timeouts - v_timeouts_a),
    'timeouts_remaining_side_b', GREATEST(0, v_max_timeouts - v_timeouts_b)
  );
END;
$$;


-- 11. Security Grants
GRANT EXECUTE ON FUNCTION public.calc_basketball_current_clock TO authenticated, service_role, anon;
GRANT EXECUTE ON FUNCTION public.init_basketball_match TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.record_basketball_score TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.record_basketball_foul TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.update_basketball_clock TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.substitute_basketball_player TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.record_basketball_timeout TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.undo_basketball_event TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.progress_basketball_period TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.complete_basketball_match TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.get_basketball_match_state TO authenticated, service_role, anon;

REVOKE EXECUTE ON FUNCTION public.init_basketball_match FROM anon, public;
REVOKE EXECUTE ON FUNCTION public.record_basketball_score FROM anon, public;
REVOKE EXECUTE ON FUNCTION public.record_basketball_foul FROM anon, public;
REVOKE EXECUTE ON FUNCTION public.update_basketball_clock FROM anon, public;
REVOKE EXECUTE ON FUNCTION public.substitute_basketball_player FROM anon, public;
REVOKE EXECUTE ON FUNCTION public.record_basketball_timeout FROM anon, public;
REVOKE EXECUTE ON FUNCTION public.undo_basketball_event FROM anon, public;
REVOKE EXECUTE ON FUNCTION public.progress_basketball_period FROM anon, public;
REVOKE EXECUTE ON FUNCTION public.complete_basketball_match FROM anon, public;
