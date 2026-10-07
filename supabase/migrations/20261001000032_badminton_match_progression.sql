-- ============================================================================
-- Migration: 032_badminton_match_progression.sql
-- Description: STEP 17E — Badminton Best-of-3 Progression & Match Completion
-- Functions: public.progress_badminton_match, public.get_badminton_match_scorecard
-- ============================================================================

-- 1. Realtime Publication: Include matches table
DO $$ BEGIN
  ALTER PUBLICATION supabase_realtime ADD TABLE public.matches;
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

-- 2. PROGRESS BADMINTON MATCH RPC
-- Handles Best-of-3 game progression, automatic game initialization,
-- and authoritative match completion.
CREATE OR REPLACE FUNCTION public.progress_badminton_match(
  p_match_id UUID
) RETURNS JSONB
LANGUAGE plpgsql
SECURITY INVOKER
AS $$
DECLARE
  v_match RECORD;
  v_sport_slug TEXT;
  v_latest_game public.badminton_games;
  v_new_game public.badminton_games;
  v_side_a_wins INTEGER := 0;
  v_side_b_wins INTEGER := 0;
  v_total_completed INTEGER := 0;
  v_next_game_number INTEGER := 1;
  v_next_serving_side TEXT := 'SIDE_A';
  v_next_server_id UUID := NULL;
  v_next_receiver_id UUID := NULL;
  v_comp_a RECORD;
  v_comp_b RECORD;
  v_scores_text TEXT := '';
  v_result_summary TEXT;
  v_winner_side TEXT := NULL;
  v_is_match_completed BOOLEAN := false;
  g RECORD;
BEGIN
  -- 1. Lock and Verify Match
  SELECT m.*, s.slug as sport_slug
  INTO v_match
  FROM public.matches m
  JOIN public.sports s ON s.id = m.sport_id
  WHERE m.id = p_match_id
  FOR UPDATE OF m;

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
      RAISE EXCEPTION 'UNAUTHORIZED: You do not have permission to score or progress this match.';
    END IF;
  ELSE
    IF current_user = 'anon' THEN
      RAISE EXCEPTION 'UNAUTHORIZED: Anonymous users cannot progress matches.';
    END IF;
  END IF;

  -- 3. Idempotent check if match already terminal
  IF v_match.status = 'COMPLETED' THEN
    -- Return existing completed match details
    SELECT COUNT(*) INTO v_side_a_wins FROM public.badminton_games WHERE match_id = p_match_id AND is_completed = true AND winner_side = 'SIDE_A';
    SELECT COUNT(*) INTO v_side_b_wins FROM public.badminton_games WHERE match_id = p_match_id AND is_completed = true AND winner_side = 'SIDE_B';
    
    RETURN jsonb_build_object(
      'status', 'match_completed',
      'match_id', p_match_id,
      'is_match_completed', true,
      'match_winner', v_match.winner_side,
      'result_summary', v_match.result_summary,
      'side_a_games_won', v_side_a_wins,
      'side_b_games_won', v_side_b_wins
    );
  END IF;

  IF v_match.status NOT IN ('WARMUP', 'LIVE') THEN
    RAISE EXCEPTION 'INVALID_MATCH_STATE: Match is not active (status: %).', v_match.status;
  END IF;

  -- Fetch Competitors for summary building and participant mapping
  SELECT * INTO v_comp_a FROM public.match_competitors WHERE match_id = p_match_id AND side = 'SIDE_A';
  SELECT * INTO v_comp_b FROM public.match_competitors WHERE match_id = p_match_id AND side = 'SIDE_B';

  -- 4. Analyze Existing Games
  FOR g IN
    SELECT * FROM public.badminton_games
    WHERE match_id = p_match_id
    ORDER BY game_number ASC
  LOOP
    IF g.is_completed THEN
      v_total_completed := v_total_completed + 1;
      IF g.winner_side = 'SIDE_A' THEN
        v_side_a_wins := v_side_a_wins + 1;
      ELSIF g.winner_side = 'SIDE_B' THEN
        v_side_b_wins := v_side_b_wins + 1;
      END IF;

      IF v_scores_text != '' THEN
        v_scores_text := v_scores_text || ', ';
      END IF;
      v_scores_text := v_scores_text || format('%s-%s', g.side_a_points, g.side_b_points);
    END IF;
    v_latest_game := g;
  END LOOP;

  -- 5. Case: No games exist yet -> Initialize Game 1
  IF v_latest_game.id IS NULL THEN
    -- Pick initial participants for singles if available
    SELECT id INTO v_next_server_id FROM public.match_participants WHERE match_id = p_match_id AND competitor_id = v_comp_a.id LIMIT 1;
    SELECT id INTO v_next_receiver_id FROM public.match_participants WHERE match_id = p_match_id AND competitor_id = v_comp_b.id LIMIT 1;

    INSERT INTO public.badminton_games (
      match_id,
      game_number,
      side_a_points,
      side_b_points,
      serving_side,
      server_participant_id,
      receiver_participant_id,
      is_completed
    ) VALUES (
      p_match_id,
      1,
      0,
      0,
      'SIDE_A',
      v_next_server_id,
      v_next_receiver_id,
      false
    ) RETURNING * INTO v_new_game;

    RETURN jsonb_build_object(
      'status', 'game_created',
      'match_id', p_match_id,
      'is_match_completed', false,
      'game', row_to_json(v_new_game),
      'game_number', 1,
      'serving_side', 'SIDE_A',
      'side_a_games_won', 0,
      'side_b_games_won', 0
    );
  END IF;

  -- 6. Case: Latest game is still in progress -> Idempotent return
  IF NOT v_latest_game.is_completed THEN
    RETURN jsonb_build_object(
      'status', 'game_in_progress',
      'match_id', p_match_id,
      'is_match_completed', false,
      'game', row_to_json(v_latest_game),
      'game_number', v_latest_game.game_number,
      'serving_side', v_latest_game.serving_side,
      'side_a_games_won', v_side_a_wins,
      'side_b_games_won', v_side_b_wins
    );
  END IF;

  -- 7. Case: Latest game is completed -> Check Best-of-3 Victory Condition
  IF v_side_a_wins >= 2 THEN
    v_winner_side := 'SIDE_A';
    v_is_match_completed := true;
  ELSIF v_side_b_wins >= 2 THEN
    v_winner_side := 'SIDE_B';
    v_is_match_completed := true;
  END IF;

  -- 8. If Match is Won -> Complete Match
  IF v_is_match_completed THEN
    IF v_winner_side = 'SIDE_A' THEN
      v_result_summary := format('%s won %s-%s (%s)', COALESCE(v_comp_a.competitor_name, 'Side A'), v_side_a_wins, v_side_b_wins, v_scores_text);
    ELSE
      v_result_summary := format('%s won %s-%s (%s)', COALESCE(v_comp_b.competitor_name, 'Side B'), v_side_b_wins, v_side_a_wins, v_scores_text);
    END IF;

    -- Update Match to COMPLETED
    UPDATE public.matches
    SET
      status = 'COMPLETED',
      winner_side = v_winner_side,
      result_summary = v_result_summary,
      actual_end = NOW(),
      updated_at = NOW()
    WHERE id = p_match_id;

    -- Update Competitors
    UPDATE public.match_competitors
    SET
      is_winner = (side = v_winner_side),
      score_summary = CASE WHEN side = 'SIDE_A' THEN format('%s games', v_side_a_wins) ELSE format('%s games', v_side_b_wins) END
    WHERE match_id = p_match_id;

    RETURN jsonb_build_object(
      'status', 'match_completed',
      'match_id', p_match_id,
      'is_match_completed', true,
      'match_winner', v_winner_side,
      'result_summary', v_result_summary,
      'side_a_games_won', v_side_a_wins,
      'side_b_games_won', v_side_b_wins
    );
  END IF;

  -- 9. If Match is NOT Won -> Advance to Next Game (Game 2 or Game 3)
  v_next_game_number := v_latest_game.game_number + 1;
  IF v_next_game_number > 3 THEN
    RAISE EXCEPTION 'INVALID_GAME_STATE: Maximum 3 games allowed in Best-of-3 format.';
  END IF;

  -- BWF Rule: Winner of the previous game serves first in the next game
  v_next_serving_side := COALESCE(v_latest_game.winner_side, 'SIDE_A');

  -- Assign server and receiver
  IF v_next_serving_side = 'SIDE_A' THEN
    SELECT id INTO v_next_server_id FROM public.match_participants WHERE match_id = p_match_id AND competitor_id = v_comp_a.id LIMIT 1;
    SELECT id INTO v_next_receiver_id FROM public.match_participants WHERE match_id = p_match_id AND competitor_id = v_comp_b.id LIMIT 1;
  ELSE
    SELECT id INTO v_next_server_id FROM public.match_participants WHERE match_id = p_match_id AND competitor_id = v_comp_b.id LIMIT 1;
    SELECT id INTO v_next_receiver_id FROM public.match_participants WHERE match_id = p_match_id AND competitor_id = v_comp_a.id LIMIT 1;
  END IF;

  INSERT INTO public.badminton_games (
    match_id,
    game_number,
    side_a_points,
    side_b_points,
    serving_side,
    server_participant_id,
    receiver_participant_id,
    is_completed
  ) VALUES (
    p_match_id,
    v_next_game_number,
    0,
    0,
    v_next_serving_side,
    v_next_server_id,
    v_next_receiver_id,
    false
  ) RETURNING * INTO v_new_game;

  RETURN jsonb_build_object(
    'status', 'game_created',
    'match_id', p_match_id,
    'is_match_completed', false,
    'game', row_to_json(v_new_game),
    'game_number', v_next_game_number,
    'serving_side', v_next_serving_side,
    'side_a_games_won', v_side_a_wins,
    'side_b_games_won', v_side_b_wins
  );
END;
$$;


-- 3. GET BADMINTON MATCH SCORECARD RPC (Public Spectator Read Model)
CREATE OR REPLACE FUNCTION public.get_badminton_match_scorecard(
  p_match_id UUID
) RETURNS JSONB
LANGUAGE plpgsql
SECURITY INVOKER
AS $$
DECLARE
  v_match RECORD;
  v_comp_a RECORD;
  v_comp_b RECORD;
  v_games JSONB := '[]'::jsonb;
  v_recent_rallies JSONB := '[]'::jsonb;
  v_side_a_wins INTEGER := 0;
  v_side_b_wins INTEGER := 0;
  v_current_game RECORD;
  g RECORD;
BEGIN
  -- 1. Fetch Match
  SELECT m.*, s.name as sport_name, s.slug as sport_slug
  INTO v_match
  FROM public.matches m
  JOIN public.sports s ON s.id = m.sport_id
  WHERE m.id = p_match_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'NOT_FOUND: Match not found.';
  END IF;

  -- 2. Fetch Competitors
  SELECT * INTO v_comp_a FROM public.match_competitors WHERE match_id = p_match_id AND side = 'SIDE_A';
  SELECT * INTO v_comp_b FROM public.match_competitors WHERE match_id = p_match_id AND side = 'SIDE_B';

  -- 3. Fetch Games Summary
  FOR g IN
    SELECT
      bg.*,
      sp.display_name as server_name,
      rp.display_name as receiver_name
    FROM public.badminton_games bg
    LEFT JOIN public.match_participants sp ON sp.id = bg.server_participant_id
    LEFT JOIN public.match_participants rp ON rp.id = bg.receiver_participant_id
    WHERE bg.match_id = p_match_id
    ORDER BY bg.game_number ASC
  LOOP
    IF g.is_completed THEN
      IF g.winner_side = 'SIDE_A' THEN
        v_side_a_wins := v_side_a_wins + 1;
      ELSIF g.winner_side = 'SIDE_B' THEN
        v_side_b_wins := v_side_b_wins + 1;
      END IF;
    END IF;

    v_games := v_games || jsonb_build_array(row_to_json(g)::jsonb);
    v_current_game := g;
  END LOOP;

  -- 4. If there is a current game, fetch recent active rallies
  IF v_current_game.id IS NOT NULL THEN
    SELECT COALESCE(jsonb_agg(row_to_json(r)::jsonb ORDER BY r.sequence_number DESC), '[]'::jsonb)
    INTO v_recent_rallies
    FROM (
      SELECT
        br.id,
        br.sequence_number,
        br.winner_side,
        br.score_after_side_a,
        br.score_after_side_b,
        br.rally_type,
        br.voided_at,
        p.display_name as winning_participant_name
      FROM public.badminton_rallies br
      LEFT JOIN public.match_participants p ON p.id = br.winning_participant_id
      WHERE br.game_id = v_current_game.id
      ORDER BY br.sequence_number DESC
      LIMIT 10
    ) r;
  END IF;

  RETURN jsonb_build_object(
    'match', jsonb_build_object(
      'id', v_match.id,
      'title', v_match.title,
      'match_reference', v_match.match_reference,
      'status', v_match.status,
      'match_format', v_match.match_format,
      'sport_name', v_match.sport_name,
      'sport_slug', v_match.sport_slug,
      'winner_side', v_match.winner_side,
      'result_summary', v_match.result_summary,
      'actual_start', v_match.actual_start,
      'actual_end', v_match.actual_end
    ),
    'competitor_a', jsonb_build_object(
      'id', v_comp_a.id,
      'name', v_comp_a.competitor_name,
      'side', 'SIDE_A',
      'is_winner', v_comp_a.is_winner,
      'score_summary', v_comp_a.score_summary,
      'games_won', v_side_a_wins
    ),
    'competitor_b', jsonb_build_object(
      'id', v_comp_b.id,
      'name', v_comp_b.competitor_name,
      'side', 'SIDE_B',
      'is_winner', v_comp_b.is_winner,
      'score_summary', v_comp_b.score_summary,
      'games_won', v_side_b_wins
    ),
    'games', v_games,
    'current_game', CASE WHEN v_current_game.id IS NOT NULL THEN row_to_json(v_current_game)::jsonb ELSE NULL END,
    'recent_rallies', v_recent_rallies,
    'summary', jsonb_build_object(
      'side_a_games_won', v_side_a_wins,
      'side_b_games_won', v_side_b_wins,
      'is_match_completed', (v_match.status = 'COMPLETED'),
      'match_winner', v_match.winner_side,
      'result_summary', v_match.result_summary
    )
  );
END;
$$;
