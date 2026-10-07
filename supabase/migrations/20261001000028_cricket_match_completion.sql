-- ============================================================================
-- Migration: 028_cricket_match_completion.sql
-- Description: STEP 16G — Cricket Match Completion RPCs
-- ============================================================================

-- Complete Innings RPC
CREATE OR REPLACE FUNCTION public.complete_cricket_innings(
  p_match_id UUID,
  p_innings_id UUID
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY INVOKER
AS $$
DECLARE
  v_match_status public.match_status;
  v_innings RECORD;
BEGIN
  -- 1. Check match status
  SELECT status INTO v_match_status
  FROM public.matches
  WHERE id = p_match_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'NOT_FOUND: Match not found';
  END IF;

  IF v_match_status NOT IN ('WARMUP', 'LIVE') THEN
    RAISE EXCEPTION 'INVALID_MATCH_STATE: Match is not active';
  END IF;

  -- 2. Lock innings
  SELECT * INTO v_innings
  FROM public.cricket_innings
  WHERE id = p_innings_id AND match_id = p_match_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'NOT_FOUND: Innings not found';
  END IF;

  IF v_innings.is_completed THEN
    RAISE EXCEPTION 'ALREADY_COMPLETED: Innings already completed';
  END IF;

  -- 3. Mark completed
  UPDATE public.cricket_innings
  SET is_completed = true, updated_at = NOW()
  WHERE id = p_innings_id;

  RETURN jsonb_build_object(
    'success', true,
    'innings_id', p_innings_id
  );
END;
$$;

-- Complete Match RPC
CREATE OR REPLACE FUNCTION public.complete_cricket_match(
  p_match_id UUID
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY INVOKER
AS $$
DECLARE
  v_match_status public.match_status;
BEGIN
  -- 1. Check match status
  SELECT status INTO v_match_status
  FROM public.matches
  WHERE id = p_match_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'NOT_FOUND: Match not found';
  END IF;

  IF v_match_status IN ('COMPLETED', 'ABANDONED', 'CANCELLED') THEN
    RAISE EXCEPTION 'INVALID_MATCH_STATE: Match is already finished';
  END IF;

  -- 2. Mark match completed
  UPDATE public.matches
  SET status = 'COMPLETED', updated_at = NOW()
  WHERE id = p_match_id;

  RETURN jsonb_build_object(
    'success', true,
    'match_id', p_match_id
  );
END;
$$;
