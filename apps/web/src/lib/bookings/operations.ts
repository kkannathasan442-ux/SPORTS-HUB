import type { SupabaseClient } from '@supabase/supabase-js';
import { createBookingHold } from './create-hold';
import { confirmBooking } from './confirm-booking';
import type { CreateBookingHoldSchema } from '@sportshub/validation';

export type BookingStatusTransition = 'CHECK_IN' | 'NO_SHOW' | 'COMPLETE';

export async function createWalkInBooking(
  supabase: SupabaseClient<any, any, any>,
  input: CreateBookingHoldSchema & { walkInCustomerName: string }
) {
  // 1. Reuse existing booking engine for validation, availability, pricing, holds
  const holdResult = await createBookingHold(supabase, input);

  if (!holdResult.success || !holdResult.booking) {
    throw new Error(holdResult.error?.message || 'Failed to create walk-in hold');
  }

  // 2. Mark as walk-in
  const { error: updateError } = await supabase
    .from('bookings')
    .update({
      is_walk_in: true,
      walk_in_customer_name: input.walkInCustomerName,
    })
    .eq('id', holdResult.booking.id);

  if (updateError) {
    // Attempt cleanup if the update failed
    await supabase.from('bookings').delete().eq('id', holdResult.booking.id);
    throw new Error('Failed to flag walk-in status');
  }

  // 3. Automatically confirm the booking for the walk-in (assumes payment handled on-site)
  const confirmResult = await confirmBooking(supabase, { bookingId: holdResult.booking.id });

  if (!confirmResult.success) {
    throw new Error(confirmResult.error?.message || 'Failed to confirm walk-in booking');
  }

  return { success: true, bookingId: holdResult.booking.id };
}

export async function checkInBooking(
  supabase: SupabaseClient<any, any, any>,
  bookingId: string
) {
  // Check current status and permissions via RLS
  const { data: booking, error: fetchError } = await supabase
    .from('bookings')
    .select('id, status, organization_id, checked_in_at')
    .eq('id', bookingId)
    .single();

  if (fetchError || !booking) {
    throw new Error('Booking not found or access denied');
  }

  if (booking.status !== 'CONFIRMED') {
    throw new Error('Only CONFIRMED bookings can be checked in');
  }
  if (booking.checked_in_at) {
    throw new Error('Booking is already checked in');
  }

  const { data: user } = await supabase.auth.getUser();
  if (!user.user) throw new Error('Not authenticated');

  // Perform update
  const { error: updateError } = await supabase
    .from('bookings')
    .update({
      checked_in_at: new Date().toISOString(),
      checked_in_by: user.user.id,
      // Status remains CONFIRMED to preserve EXCLUDE constraint
    })
    .eq('id', bookingId)
    .eq('status', 'CONFIRMED');

  if (updateError) {
    throw new Error(`Failed to check in booking: ${updateError.message}`);
  }

  return { success: true };
}

export async function markBookingNoShow(
  supabase: SupabaseClient<any, any, any>,
  bookingId: string
) {
  const { data: booking, error: fetchError } = await supabase
    .from('bookings')
    .select('id, status')
    .eq('id', bookingId)
    .single();

  if (fetchError || !booking) {
    throw new Error('Booking not found or access denied');
  }

  if (booking.status !== 'CONFIRMED') {
    throw new Error('Only CONFIRMED bookings can be marked as NO_SHOW');
  }

  const { error: updateError } = await supabase
    .from('bookings')
    .update({
      status: 'NO_SHOW',
    })
    .eq('id', bookingId)
    .eq('status', 'CONFIRMED');

  if (updateError) {
    throw new Error(`Failed to mark NO_SHOW: ${updateError.message}`);
  }

  return { success: true };
}

export async function completeBooking(
  supabase: SupabaseClient<any, any, any>,
  bookingId: string
) {
  const { data: booking, error: fetchError } = await supabase
    .from('bookings')
    .select('id, status, checked_in_at')
    .eq('id', bookingId)
    .single();

  if (fetchError || !booking) {
    throw new Error('Booking not found or access denied');
  }

  if (booking.status !== 'CONFIRMED') {
    throw new Error('Only CONFIRMED bookings can be completed');
  }

  const { error: updateError } = await supabase
    .from('bookings')
    .update({
      status: 'COMPLETED',
    })
    .eq('id', bookingId)
    .eq('status', 'CONFIRMED');

  if (updateError) {
    throw new Error(`Failed to complete booking: ${updateError.message}`);
  }

  return { success: true };
}
