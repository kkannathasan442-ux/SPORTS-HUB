import { SupabaseClient } from '@supabase/supabase-js';
import { confirmBookingSchema, type ConfirmBookingSchema } from '@sportshub/validation';
import type { Booking, ConfirmBookingResult } from '@sportshub/types';
import { BOOKING_ERRORS } from './types';
import { defaultNotificationDispatcher } from '../notifications/dispatcher';

/**
 * Confirms an active booking hold before it expires.
 */
export async function confirmBooking(
  supabase: SupabaseClient,
  input: ConfirmBookingSchema
): Promise<ConfirmBookingResult> {
  const validated = confirmBookingSchema.parse(input);

  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser();

  if (authError || !user) {
    return {
      success: false,
      error: { code: BOOKING_ERRORS.UNAUTHORIZED, message: 'You must be signed in to confirm a booking' },
    };
  }

  const nowIso = new Date().toISOString();

  // Atomically update only if status is 'HOLD', belongs to customer, and hold hasn't expired
  const { data: booking, error } = await supabase
    .from('bookings')
    .update({
      status: 'CONFIRMED',
      confirmed_at: nowIso,
    })
    .eq('id', validated.bookingId)
    .eq('customer_user_id', user.id)
    .eq('status', 'HOLD')
    .gt('hold_expires_at', nowIso)
    .select(`
      *,
      facility:facilities(name),
      venue:venues(name)
    `)
    .single();

  if (error || !booking) {
    // Check if booking exists but expired or already confirmed
    const { data: existing } = await supabase
      .from('bookings')
      .select('id, status, hold_expires_at')
      .eq('id', validated.bookingId)
      .eq('customer_user_id', user.id)
      .maybeSingle();

    if (!existing) {
      return {
        success: false,
        error: { code: BOOKING_ERRORS.BOOKING_NOT_FOUND, message: 'Booking reservation not found' },
      };
    }

    if (existing.status === 'CONFIRMED') {
      return {
        success: true,
        booking: existing as Booking,
      };
    }

    if (existing.hold_expires_at && existing.hold_expires_at <= nowIso) {
      return {
        success: false,
        error: {
          code: BOOKING_ERRORS.HOLD_EXPIRED,
          message: 'Your 10-minute hold has expired. Please select a time slot again.',
        },
      };
    }

    return {
      success: false,
      error: {
        code: BOOKING_ERRORS.INVALID_STATUS_TRANSITION,
        message: 'Unable to confirm booking. It may have already been processed.',
      },
    };
  }

  // Safe isolated notification trigger
  try {
    defaultNotificationDispatcher
      .dispatchBookingConfirmed(supabase, booking as any, user.email)
      .catch((e: any) => console.warn('Failed to dispatch booking confirmed notification:', e));
  } catch (e: any) {
    console.warn('Notification trigger error:', e);
  }

  return {
    success: true,
    booking: booking as Booking,
  };
}


