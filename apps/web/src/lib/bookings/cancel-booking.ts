import { SupabaseClient } from '@supabase/supabase-js';
import { cancelBookingSchema, type CancelBookingSchema } from '@sportshub/validation';
import type { Booking, CancelBookingResult } from '@sportshub/types';
import { BOOKING_ERRORS } from './types';
import { defaultNotificationDispatcher } from '../notifications/dispatcher';

/**
 * Cancels an active or confirmed booking.
 * Can be performed by the customer who owns the booking or by organization staff.
 */
export async function cancelBooking(
  supabase: SupabaseClient,
  input: CancelBookingSchema
): Promise<CancelBookingResult> {
  const validated = cancelBookingSchema.parse(input);

  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser();

  if (authError || !user) {
    return {
      success: false,
      error: { code: BOOKING_ERRORS.UNAUTHORIZED, message: 'You must be signed in to cancel a booking' },
    };
  }

  // 1. Fetch booking to check permissions
  const { data: booking, error: fetchError } = await supabase
    .from('bookings')
    .select('id, customer_user_id, organization_id, status, booking_date, start_time, booking_reference')
    .eq('id', validated.bookingId)
    .single();

  if (fetchError || !booking) {
    return {
      success: false,
      error: { code: BOOKING_ERRORS.BOOKING_NOT_FOUND, message: 'Booking not found' },
    };
  }

  if (booking.status === 'CANCELLED') {
    return {
      success: true,
      booking: booking as Booking,
    };
  }

  if (booking.status !== 'HOLD' && booking.status !== 'CONFIRMED') {
    return {
      success: false,
      error: {
        code: BOOKING_ERRORS.INVALID_STATUS_TRANSITION,
        message: `Cannot cancel a booking with status '${booking.status}'`,
      },
    };
  }

  // Check customer ownership or staff membership
  const isOwnerCustomer = booking.customer_user_id === user.id;
  let isStaff = false;

  if (!isOwnerCustomer) {
    const { data: member } = await supabase
      .from('organization_members')
      .select('id, role')
      .eq('organization_id', booking.organization_id)
      .eq('user_id', user.id)
      .eq('status', 'ACTIVE')
      .maybeSingle();

    if (member && ['OWNER', 'MANAGER', 'RECEPTIONIST', 'SUPER_ADMIN'].includes(member.role)) {
      isStaff = true;
    }
  }

  if (!isOwnerCustomer && !isStaff) {
    return {
      success: false,
      error: { code: BOOKING_ERRORS.UNAUTHORIZED, message: 'You do not have permission to cancel this booking' },
    };
  }

  const nowIso = new Date().toISOString();

  const { data: updatedBooking, error: updateError } = await supabase
    .from('bookings')
    .update({
      status: 'CANCELLED',
      cancelled_at: nowIso,
      cancellation_reason: validated.reason || (isStaff ? 'Cancelled by staff' : 'Cancelled by customer'),
    })
    .eq('id', validated.bookingId)
    .select(`
      *,
      facility:facilities(name),
      venue:venues(name)
    `)
    .single();

  if (updateError || !updatedBooking) {
    return {
      success: false,
      error: { code: BOOKING_ERRORS.INVALID_STATUS_TRANSITION, message: 'Failed to update booking status' },
    };
  }

  // Safe isolated notification trigger
  try {
    defaultNotificationDispatcher
      .dispatchBookingCancelled(supabase, updatedBooking as any, user.email)
      .catch((e: any) => console.warn('Failed to dispatch booking cancelled notification:', e));
  } catch (e: any) {
    console.warn('Notification trigger error:', e);
  }

  return {
    success: true,
    booking: updatedBooking as Booking,
  };
}


