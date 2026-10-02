-- ============================================================================
-- Migration: 018_booking_rpc.sql
-- Description: RPCs for atomic booking operations (hold, confirm, cleanup)
-- ============================================================================

-- Function to clean up expired holds for a specific facility
CREATE OR REPLACE FUNCTION public.cleanup_expired_holds(p_facility_id UUID)
RETURNS VOID AS $$
BEGIN
  UPDATE public.bookings
  SET status = 'EXPIRED',
      updated_at = NOW()
  WHERE facility_id = p_facility_id
    AND status = 'HOLD'
    AND hold_expires_at <= NOW();
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to create a booking hold
-- It first cleans up expired holds, then attempts to insert the new hold.
-- If the exclude constraint is violated, it will throw an exception (duplicate_object/exclusion_violation)
CREATE OR REPLACE FUNCTION public.create_booking_hold(
  p_booking_reference VARCHAR(50),
  p_customer_user_id UUID,
  p_organization_id UUID,
  p_venue_id UUID,
  p_facility_id UUID,
  p_sport_id UUID,
  p_booking_date DATE,
  p_start_time TIME,
  p_end_time TIME,
  p_duration_minutes INTEGER,
  p_protected_time_range TSTZRANGE,
  p_subtotal NUMERIC,
  p_currency VARCHAR(3),
  p_price_snapshot JSONB,
  p_hold_expires_at TIMESTAMPTZ
)
RETURNS public.bookings AS $$
DECLARE
  v_booking public.bookings;
BEGIN
  -- 1. Cleanup expired holds for this facility first to free up slots
  PERFORM public.cleanup_expired_holds(p_facility_id);

  -- 2. Insert the new hold (will throw if double booked due to EXCLUDE constraint)
  INSERT INTO public.bookings (
    booking_reference,
    customer_user_id,
    organization_id,
    venue_id,
    facility_id,
    sport_id,
    booking_date,
    start_time,
    end_time,
    duration_minutes,
    protected_time_range,
    status,
    subtotal,
    total_amount,
    currency,
    price_snapshot,
    hold_expires_at
  ) VALUES (
    p_booking_reference,
    p_customer_user_id,
    p_organization_id,
    p_venue_id,
    p_facility_id,
    p_sport_id,
    p_booking_date,
    p_start_time,
    p_end_time,
    p_duration_minutes,
    p_protected_time_range,
    'HOLD',
    p_subtotal,
    p_subtotal,
    p_currency,
    p_price_snapshot,
    p_hold_expires_at
  )
  RETURNING * INTO v_booking;

  RETURN v_booking;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
