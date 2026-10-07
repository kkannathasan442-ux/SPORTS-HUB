-- ============================================================================
-- Migration: 031_badminton_scoring_rpc.sql
-- Description: STEP 17C — Badminton Atomic Scoring RPC & Game Rules
-- Functions: public.record_badminton_rally, public.undo_badminton_rally
-- ============================================================================

-- 1. RECORD BADMINTON RALLY RPC
CREATE OR REPLACE FUNCTION public.record_badminton_rally(
  p_match_id UUID,
  p_game_id UUID,
  p_client_event_id UUID,
  p_winner_side TEXT,
  p_winning_participant_id UUID DEFAULT NULL,
  p_rally_type public.badminton_rally_type DEFAULT 'NORMAL',
  p_server_participant_id UUID DEFAULT NULL,
  p_receiver_participant_id UUID DEFAULT NULL,
  p_sequence_number INTEGER DEFAULT NULL
) RETURNS JSONB
LANGUAGE plpgsql
SECURITY INVOKER
AS $$
DECLARE
  v_match RECORD;
  v_game public.badminton_games;
  v_existing_rally public.badminton_rallies;
  v_expected_seq INTEGER;
  v_sequence_number INTEGER;
  v_new_side_a INTEGER;
  v_new_side_b INTEGER;
  v_is_game_completed BOOLEAN := false;
  v_game_winner TEXT := NULL;
  v_next_serving_side TEXT;
  v_next_server_participant_id UUID := NULL;
  v_next_receiver_participant_id UUID := NULL;
  v_win_part RECORD;
  v_server_comp_id UUID;
  v_recv_comp_id UUID;
  v_rally_id UUID;
BEGIN
  -- 1. Verify Match Exists and Sport is Badminton
  SELECT m.*, s.slug as sport_slug
  INTO v_match
  FROM public.matches m
  JOIN public.sports s ON s.id = m.sport_id
  WHERE m.id = p_match_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'NOT_FOUND: Match not found.';
  END IF;

  IF v_match.sport_slug != 'badminton' THEN
    RAISE EXCEPTION 'INVALID_SPORT: Match is not a Badminton match (sport is %).', v_match.sport_slug;
  END IF;

  -- 2. Authorization Verification
  IF auth.uid() IS NOT NULL THEN
    IF NOT (
      public.is_super_admin()
      OR (v_match.organization_id IS NOT NULL AND public.has_org_role(v_match.organization_id, ARRAY['OWNER'::public.app_role, 'MANAGER'::public.app_role]))
      OR v_match.created_by = auth.uid()
      OR v_match.scorer_user_id = auth.uid()
    ) THEN
      RAISE EXCEPTION 'UNAUTHORIZED: You do not have permission to score this match.';
    END IF;
  ELSE
    IF current_user = 'anon' THEN
      RAISE EXCEPTION 'UNAUTHORIZED: Anonymous users cannot record scoring events.';
    END IF;
  END IF;

  -- 3. Verify Match Lifecycle State
  IF v_match.status IN ('DRAFT', 'SCHEDULED', 'COMPLETED', 'ABANDONED', 'CANCELLED') THEN
    RAISE EXCEPTION 'INVALID_MATCH_STATE: Match is not in a scoreable state (status: %).', v_match.status;
  END IF;

  -- 4. Check Idempotency First (Before locking to avoid blocking retries)
  SELECT * INTO v_existing_rally
  FROM public.badminton_rallies
  WHERE game_id = p_game_id AND client_event_id = p_client_event_id;

  IF FOUND THEN
    IF v_existing_rally.voided_at IS NOT NULL THEN
      RAISE EXCEPTION 'IDEMPOTENCY_CONFLICT: Event exists but is voided.';
    END IF;

    -- Validate payload matches existing event
    IF v_existing_rally.winner_side != p_winner_side THEN
      RAISE EXCEPTION 'IDEMPOTENCY_CONFLICT: Event ID reused with conflicting winner side.';
    END IF;

    IF p_winning_participant_id IS NOT NULL AND v_existing_rally.winning_participant_id != p_winning_participant_id THEN
      RAISE EXCEPTION 'IDEMPOTENCY_CONFLICT: Event ID reused with conflicting winning participant.';
    END IF;

    -- Fetch current game snapshot for response
    SELECT * INTO v_game FROM public.badminton_games WHERE id = p_game_id;

    RETURN jsonb_build_object(
      'rally_id', v_existing_rally.id,
      'match_id', p_match_id,
      'game_id', p_game_id,
      'sequence_number', v_existing_rally.sequence_number,
      'winner_side', v_existing_rally.winner_side,
      'score_after_side_a', v_existing_rally.score_after_side_a,
      'score_after_side_b', v_existing_rally.score_after_side_b,
      'serving_side', v_game.serving_side,
      'is_game_completed', v_game.is_completed,
      'game_winner', v_game.winner_side,
      'status', 'existing'
    );
  END IF;

  -- 5. Lock Game Row (Serializes all concurrent scoring for this game)
  SELECT * INTO v_game
  FROM public.badminton_games
  WHERE id = p_game_id AND match_id = p_match_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'NOT_FOUND: Badminton game not found.';
  END IF;

  IF v_game.is_completed THEN
    RAISE EXCEPTION 'GAME_COMPLETED: Badminton game is already completed.';
  END IF;

  -- 6. Validate Winner Side
  IF p_winner_side NOT IN ('SIDE_A', 'SIDE_B') THEN
    RAISE EXCEPTION 'INVALID_SIDE: Winner side must be SIDE_A or SIDE_B.';
  END IF;

  -- 7. Validate Participants
  IF p_winning_participant_id IS NOT NULL THEN
    SELECT mp.*, mc.side INTO v_win_part
    FROM public.match_participants mp
    JOIN public.match_competitors mc ON mc.id = mp.competitor_id
    WHERE mp.id = p_winning_participant_id AND mp.match_id = p_match_id;

    IF NOT FOUND THEN
      RAISE EXCEPTION 'INVALID_PARTICIPANT: Winning participant does not belong to this match.';
    END IF;

    IF v_win_part.side != p_winner_side THEN
      RAISE EXCEPTION 'INVALID_PARTICIPANT: Winning participant side (%) does not match winner side (%).', v_win_part.side, p_winner_side;
    END IF;

    v_next_server_participant_id := p_winning_participant_id;
  END IF;

  IF p_server_participant_id IS NOT NULL THEN
    IF NOT EXISTS (SELECT 1 FROM public.match_participants WHERE id = p_server_participant_id AND match_id = p_match_id) THEN
      RAISE EXCEPTION 'INVALID_SERVER: Server participant does not belong to this match.';
    END IF;
  END IF;

  IF p_receiver_participant_id IS NOT NULL THEN
    IF NOT EXISTS (SELECT 1 FROM public.match_participants WHERE id = p_receiver_participant_id AND match_id = p_match_id) THEN
      RAISE EXCEPTION 'INVALID_RECEIVER: Receiver participant does not belong to this match.';
    END IF;

    IF p_server_participant_id IS NOT NULL THEN
      SELECT competitor_id INTO v_server_comp_id FROM public.match_participants WHERE id = p_server_participant_id;
      SELECT competitor_id INTO v_recv_comp_id FROM public.match_participants WHERE id = p_receiver_participant_id;
      IF v_server_comp_id = v_recv_comp_id THEN
        RAISE EXCEPTION 'INVALID_RECEIVER: Server and receiver cannot belong to the same competitor side.';
      END IF;
    END IF;
  END IF;

  -- 8. Sequential Sequence Number Calculation & Validation
  SELECT COALESCE(MAX(sequence_number), 0) + 1 INTO v_expected_seq
  FROM public.badminton_rallies
  WHERE game_id = p_game_id;

  IF p_sequence_number IS NOT NULL AND p_sequence_number != v_expected_seq THEN
    RAISE EXCEPTION 'INVALID_SEQUENCE: Expected sequence %, got %', v_expected_seq, p_sequence_number;
  END IF;
  v_sequence_number := v_expected_seq;

  -- 9. Authoritative Score Calculation
  IF p_winner_side = 'SIDE_A' THEN
    v_new_side_a := v_game.side_a_points + 1;
    v_new_side_b := v_game.side_b_points;
  ELSE
    v_new_side_a := v_game.side_a_points;
    v_new_side_b := v_game.side_b_points + 1;
  END IF;

  IF v_new_side_a > v_game.max_points OR v_new_side_b > v_game.max_points THEN
    RAISE EXCEPTION 'INVALID_SCORE_STATE: Score cannot exceed maximum points (%).', v_game.max_points;
  END IF;

  -- 10. Evaluate BWF Game Completion Rules
  IF (v_new_side_a >= v_game.points_to_win AND (v_new_side_a - v_new_side_b >= v_game.win_by OR v_new_side_a = v_game.max_points)) THEN
    v_is_game_completed := true;
    v_game_winner := 'SIDE_A';
  ELSIF (v_new_side_b >= v_game.points_to_win AND (v_new_side_b - v_new_side_a >= v_game.win_by OR v_new_side_b = v_game.max_points)) THEN
    v_is_game_completed := true;
    v_game_winner := 'SIDE_B';
  END IF;

  -- 11. Next Serving Side
  v_next_serving_side := p_winner_side;

  -- 12. Insert Authoritative Rally Event
  INSERT INTO public.badminton_rallies (
    match_id,
    game_id,
    sequence_number,
    winner_side,
    winning_participant_id,
    server_side,
    server_participant_id,
    receiver_participant_id,
    rally_type,
    score_after_side_a,
    score_after_side_b,
    client_event_id
  ) VALUES (
    p_match_id,
    p_game_id,
    v_sequence_number,
    p_winner_side,
    p_winning_participant_id,
    v_game.serving_side,
    COALESCE(p_server_participant_id, v_game.server_participant_id),
    COALESCE(p_receiver_participant_id, v_game.receiver_participant_id),
    COALESCE(p_rally_type, 'NORMAL'::public.badminton_rally_type),
    v_new_side_a,
    v_new_side_b,
    p_client_event_id
  ) RETURNING id INTO v_rally_id;

  -- 13. Update Game Snapshot
  UPDATE public.badminton_games
  SET
    side_a_points = v_new_side_a,
    side_b_points = v_new_side_b,
    serving_side = v_next_serving_side,
    server_participant_id = COALESCE(v_next_server_participant_id, server_participant_id),
    receiver_participant_id = COALESCE(v_next_receiver_participant_id, receiver_participant_id),
    is_completed = v_is_game_completed,
    winner_side = v_game_winner,
    completed_at = CASE WHEN v_is_game_completed THEN NOW() ELSE NULL END,
    updated_at = NOW()
  WHERE id = p_game_id;

  -- 14. If match is WARMUP, transition to LIVE
  IF v_match.status = 'WARMUP' THEN
    UPDATE public.matches
    SET status = 'LIVE', actual_start = COALESCE(actual_start, NOW()), updated_at = NOW()
    WHERE id = p_match_id;
  END IF;

  -- 15. Return Transactional Result
  RETURN jsonb_build_object(
    'rally_id', v_rally_id,
    'match_id', p_match_id,
    'game_id', p_game_id,
    'sequence_number', v_sequence_number,
    'winner_side', p_winner_side,
    'score_after_side_a', v_new_side_a,
    'score_after_side_b', v_new_side_b,
    'serving_side', v_next_serving_side,
    'is_game_completed', v_is_game_completed,
    'game_winner', v_game_winner,
    'status', 'created'
  );
END;
$$;


-- 2. UNDO BADMINTON RALLY RPC
CREATE OR REPLACE FUNCTION public.undo_badminton_rally(
  p_match_id UUID,
  p_game_id UUID,
  p_rally_id UUID DEFAULT NULL
) RETURNS JSONB
LANGUAGE plpgsql
SECURITY INVOKER
AS $$
DECLARE
  v_match RECORD;
  v_game public.badminton_games;
  v_latest_rally public.badminton_rallies;
  v_prev_rally public.badminton_rallies;
  v_new_side_a INTEGER;
  v_new_side_b INTEGER;
  v_restored_serving_side TEXT := 'SIDE_A';
  v_restored_server_id UUID := NULL;
  v_restored_receiver_id UUID := NULL;
BEGIN
  -- 1. Verify Match Exists and Sport is Badminton
  SELECT m.*, s.slug as sport_slug
  INTO v_match
  FROM public.matches m
  JOIN public.sports s ON s.id = m.sport_id
  WHERE m.id = p_match_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'NOT_FOUND: Match not found.';
  END IF;

  IF v_match.sport_slug != 'badminton' THEN
    RAISE EXCEPTION 'INVALID_SPORT: Match is not a Badminton match.';
  END IF;

  -- 2. Authorization Verification
  IF auth.uid() IS NOT NULL THEN
    IF NOT (
      public.is_super_admin()
      OR (v_match.organization_id IS NOT NULL AND public.has_org_role(v_match.organization_id, ARRAY['OWNER'::public.app_role, 'MANAGER'::public.app_role]))
      OR v_match.created_by = auth.uid()
      OR v_match.scorer_user_id = auth.uid()
    ) THEN
      RAISE EXCEPTION 'UNAUTHORIZED: You do not have permission to score this match.';
    END IF;
  ELSE
    IF current_user = 'anon' THEN
      RAISE EXCEPTION 'UNAUTHORIZED: Anonymous users cannot undo scoring events.';
    END IF;
  END IF;

  -- 3. Verify Match Lifecycle State
  IF v_match.status IN ('CANCELLED', 'ABANDONED') THEN
    RAISE EXCEPTION 'INVALID_MATCH_STATE: Match is not in an active scoring state (status: %).', v_match.status;
  END IF;

  -- 4. Lock Game Row
  SELECT * INTO v_game
  FROM public.badminton_games
  WHERE id = p_game_id AND match_id = p_match_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'NOT_FOUND: Badminton game not found.';
  END IF;

  -- 5. Identify the Most Recent Active Rally
  SELECT * INTO v_latest_rally
  FROM public.badminton_rallies
  WHERE game_id = p_game_id AND voided_at IS NULL
  ORDER BY sequence_number DESC
  LIMIT 1
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'INVALID_UNDO: No active rally to undo in this game.';
  END IF;

  IF p_rally_id IS NOT NULL AND v_latest_rally.id != p_rally_id THEN
    RAISE EXCEPTION 'INVALID_UNDO: Can only undo the most recent active rally (id: %).', v_latest_rally.id;
  END IF;

  -- 6. Soft Undo (Never Hard DELETE)
  UPDATE public.badminton_rallies
  SET voided_at = NOW(), updated_at = NOW()
  WHERE id = v_latest_rally.id;

  -- 7. Restore Score and Service State from Previous Active Rally
  SELECT * INTO v_prev_rally
  FROM public.badminton_rallies
  WHERE game_id = p_game_id AND voided_at IS NULL
  ORDER BY sequence_number DESC
  LIMIT 1;

  IF FOUND THEN
    v_new_side_a := v_prev_rally.score_after_side_a;
    v_new_side_b := v_prev_rally.score_after_side_b;
    v_restored_serving_side := v_prev_rally.winner_side;
    v_restored_server_id := v_prev_rally.server_participant_id;
    v_restored_receiver_id := v_prev_rally.receiver_participant_id;
  ELSE
    -- Score is back to 0-0
    v_new_side_a := 0;
    v_new_side_b := 0;
    v_restored_serving_side := 'SIDE_A';
    v_restored_server_id := NULL;
    v_restored_receiver_id := NULL;
  END IF;

  -- 9. Update Game Snapshot & Revert Completion If Applicable
  UPDATE public.badminton_games
  SET
    side_a_points = v_new_side_a,
    side_b_points = v_new_side_b,
    serving_side = v_restored_serving_side,
    server_participant_id = COALESCE(v_restored_server_id, server_participant_id),
    receiver_participant_id = COALESCE(v_restored_receiver_id, receiver_participant_id),
    is_completed = false,
    winner_side = NULL,
    completed_at = NULL,
    updated_at = NOW()
  WHERE id = p_game_id;

  -- 10. Revert Match Completion if Match was Marked Completed
  IF v_match.status = 'COMPLETED' THEN
    UPDATE public.matches
    SET status = 'LIVE', winner_side = NULL, result_summary = NULL, actual_end = NULL, updated_at = NOW()
    WHERE id = p_match_id;
  END IF;

  -- 11. Return Authoritative Reconciled State
  RETURN jsonb_build_object(
    'undone_rally_id', v_latest_rally.id,
    'game_id', p_game_id,
    'score_after_side_a', v_new_side_a,
    'score_after_side_b', v_new_side_b,
    'serving_side', v_restored_serving_side,
    'is_game_completed', false,
    'status', 'voided'
  );
END;
$$;
