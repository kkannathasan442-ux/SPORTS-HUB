-- ============================================================================
-- Migration: 027_cricket_scoring_rpc.sql
-- Description: STEP 16C — Live Cricket Scoring Authoritative API/RPC
-- Functions: public.record_cricket_delivery, public.undo_cricket_delivery
-- ============================================================================

-- 1. RECORD CRICKET DELIVERY RPC
CREATE OR REPLACE FUNCTION public.record_cricket_delivery(
  p_match_id UUID,
  p_innings_id UUID,
  p_sequence_number INTEGER,
  p_over_number INTEGER,
  p_ball_number INTEGER,
  p_striker_participant_id UUID,
  p_non_striker_participant_id UUID,
  p_bowler_participant_id UUID,
  p_runs_off_bat INTEGER,
  p_extras_amount INTEGER,
  p_extras_type public.cricket_extras_type,
  p_is_legal_delivery BOOLEAN,
  p_is_wicket BOOLEAN,
  p_dismissal_type public.cricket_dismissal_type,
  p_dismissed_participant_id UUID,
  p_fielder_participant_id UUID,
  p_client_event_id UUID
) RETURNS JSONB
LANGUAGE plpgsql
SECURITY INVOKER
AS $$
DECLARE
  v_innings public.cricket_innings;
  v_match_status public.match_status;
  v_delivery_id UUID;
  v_expected_seq INTEGER;
  v_existing_delivery public.cricket_deliveries;
BEGIN
  -- 1. Check Idempotency First
  SELECT * INTO v_existing_delivery 
  FROM public.cricket_deliveries 
  WHERE match_id = p_match_id AND client_event_id = p_client_event_id;
  
  IF FOUND THEN
    IF v_existing_delivery.voided_at IS NOT NULL THEN
      RAISE EXCEPTION 'IDEMPOTENCY_CONFLICT: Event exists but is voided.';
    END IF;
    -- Return existing delivery result gracefully
    RETURN jsonb_build_object(
      'delivery_id', v_existing_delivery.id,
      'status', 'existing'
    );
  END IF;

  -- 2. Verify Match Status
  SELECT status INTO v_match_status FROM public.matches WHERE id = p_match_id;
  IF v_match_status IN ('DRAFT', 'SCHEDULED', 'COMPLETED', 'ABANDONED', 'CANCELLED') THEN
    RAISE EXCEPTION 'INVALID_MATCH_STATE: Match is not in a scoreable state (%)', v_match_status;
  END IF;

  -- 3. Lock Innings (For UPDATE serializes concurrent scoring for this innings)
  SELECT * INTO v_innings 
  FROM public.cricket_innings 
  WHERE id = p_innings_id AND match_id = p_match_id
  FOR UPDATE;
  
  IF NOT FOUND THEN
    RAISE EXCEPTION 'NOT_FOUND: Innings not found or unauthorized.';
  END IF;
  
  IF v_innings.is_completed THEN
    RAISE EXCEPTION 'INNINGS_COMPLETED: Innings is already completed.';
  END IF;

  -- 4. Sequence Validation
  SELECT COALESCE(MAX(sequence_number), 0) + 1 INTO v_expected_seq
  FROM public.cricket_deliveries
  WHERE innings_id = p_innings_id AND voided_at IS NULL;
  
  IF p_sequence_number != v_expected_seq THEN
    RAISE EXCEPTION 'INVALID_SEQUENCE: Expected %, got %', v_expected_seq, p_sequence_number;
  END IF;

  -- 5. Insert Delivery (RLS and constraints handle complex validation)
  INSERT INTO public.cricket_deliveries (
    match_id, innings_id, sequence_number, over_number, ball_number,
    striker_participant_id, non_striker_participant_id, bowler_participant_id,
    runs_off_bat, extras_amount, extras_type, is_legal_delivery,
    is_wicket, dismissal_type, dismissed_participant_id, fielder_participant_id,
    client_event_id
  ) VALUES (
    p_match_id, p_innings_id, p_sequence_number, p_over_number, p_ball_number,
    p_striker_participant_id, p_non_striker_participant_id, p_bowler_participant_id,
    p_runs_off_bat, p_extras_amount, p_extras_type, p_is_legal_delivery,
    p_is_wicket, p_dismissal_type, p_dismissed_participant_id, p_fielder_participant_id,
    p_client_event_id
  ) RETURNING id INTO v_delivery_id;
  
  -- 6. Update Snapshot Atomically
  UPDATE public.cricket_innings
  SET 
    total_runs = total_runs + p_runs_off_bat + p_extras_amount,
    total_wickets = total_wickets + CASE WHEN p_is_wicket THEN 1 ELSE 0 END,
    legal_balls = legal_balls + CASE WHEN p_is_legal_delivery THEN 1 ELSE 0 END
  WHERE id = p_innings_id
  RETURNING * INTO v_innings;
  
  -- 7. Transition Match to LIVE if currently WARMUP
  IF v_match_status = 'WARMUP' THEN
    -- Ensure the user can actually update the match status. If they are a scorer, the match RLS must allow it.
    UPDATE public.matches SET status = 'LIVE', updated_at = NOW() WHERE id = p_match_id;
    v_match_status := 'LIVE';
  END IF;

  -- 8. Return Authoritative State
  RETURN jsonb_build_object(
    'delivery_id', v_delivery_id,
    'innings_id', p_innings_id,
    'sequence_number', p_sequence_number,
    'current_total_runs', v_innings.total_runs,
    'current_total_wickets', v_innings.total_wickets,
    'current_legal_balls', v_innings.legal_balls,
    'current_over', p_over_number,
    'current_ball', p_ball_number,
    'match_status', v_match_status,
    'status', 'created'
  );
END;
$$;


-- 2. UNDO CRICKET DELIVERY RPC
CREATE OR REPLACE FUNCTION public.undo_cricket_delivery(
  p_match_id UUID,
  p_innings_id UUID,
  p_delivery_id UUID
) RETURNS JSONB
LANGUAGE plpgsql
SECURITY INVOKER
AS $$
DECLARE
  v_innings public.cricket_innings;
  v_delivery public.cricket_deliveries;
  v_latest_active_delivery_id UUID;
  v_match_status public.match_status;
  v_new_runs INTEGER;
  v_new_wickets INTEGER;
  v_new_legal_balls INTEGER;
BEGIN
  -- 1. Verify Match Status
  SELECT status INTO v_match_status FROM public.matches WHERE id = p_match_id;
  IF v_match_status IN ('COMPLETED', 'ABANDONED', 'CANCELLED') THEN
    RAISE EXCEPTION 'INVALID_MATCH_STATE: Match is not in a scoreable state (%)', v_match_status;
  END IF;

  -- 2. Lock Innings
  SELECT * INTO v_innings 
  FROM public.cricket_innings 
  WHERE id = p_innings_id AND match_id = p_match_id
  FOR UPDATE;
  
  IF NOT FOUND THEN
    RAISE EXCEPTION 'NOT_FOUND: Innings not found or unauthorized.';
  END IF;

  -- 3. Identify latest active delivery
  SELECT id INTO v_latest_active_delivery_id
  FROM public.cricket_deliveries
  WHERE innings_id = p_innings_id AND voided_at IS NULL
  ORDER BY sequence_number DESC
  LIMIT 1;
  
  IF v_latest_active_delivery_id IS NULL THEN
    RAISE EXCEPTION 'INVALID_UNDO: No active delivery to undo.';
  END IF;
  
  IF v_latest_active_delivery_id != p_delivery_id THEN
    RAISE EXCEPTION 'INVALID_UNDO: Can only undo the most recent active delivery.';
  END IF;
  
  -- 4. Set voided_at instead of DELETE
  UPDATE public.cricket_deliveries
  SET voided_at = NOW()
  WHERE id = p_delivery_id
  RETURNING * INTO v_delivery;
  
  -- 5. Recalculate authoritative snapshot from event log
  SELECT 
    COALESCE(SUM(runs_off_bat + extras_amount), 0),
    COALESCE(SUM(CASE WHEN is_wicket THEN 1 ELSE 0 END), 0),
    COALESCE(SUM(CASE WHEN is_legal_delivery THEN 1 ELSE 0 END), 0)
  INTO v_new_runs, v_new_wickets, v_new_legal_balls
  FROM public.cricket_deliveries
  WHERE innings_id = p_innings_id AND voided_at IS NULL;
  
  -- 6. Update snapshot
  UPDATE public.cricket_innings
  SET 
    total_runs = v_new_runs,
    total_wickets = v_new_wickets,
    legal_balls = v_new_legal_balls
  WHERE id = p_innings_id
  RETURNING * INTO v_innings;
  
  -- 7. Return Authoritative State
  RETURN jsonb_build_object(
    'delivery_id', p_delivery_id,
    'innings_id', p_innings_id,
    'current_total_runs', v_innings.total_runs,
    'current_total_wickets', v_innings.total_wickets,
    'current_legal_balls', v_innings.legal_balls,
    'status', 'voided'
  );
END;
$$;
