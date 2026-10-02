import { SupabaseClient } from '@supabase/supabase-js';
import { createBookingHoldSchema, type CreateBookingHoldSchema } from '@sportshub/validation';
import type { Booking, CreateBookingHoldResult } from '@sportshub/types';
import { BOOKING_CONFIG } from '@sportshub/config';
import { BOOKING_ERRORS } from './types';
import { calculateBookingPriceSnapshot } from './pricing';
import { defaultNotificationDispatcher } from '../notifications/dispatcher';

/**
 * Generates human-readable unique booking reference format: SPH-YYYYMMDD-XXXXXX
 */
export function generateBookingReference(dateStr: string): string {
  const cleanDate = dateStr.replace(/-/g, '');
  const randomSuffix = Math.floor(100000 + Math.random() * 900000).toString();
  return `${BOOKING_CONFIG.REFERENCE_PREFIX}-${cleanDate}-${randomSuffix}`;
}

/**
 * Creates an atomic temporary booking hold (10 minutes) for an authenticated customer.
 */
export async function createBookingHold(
  supabase: SupabaseClient,
  input: CreateBookingHoldSchema
): Promise<CreateBookingHoldResult> {
  const validated = createBookingHoldSchema.parse(input);

  // 1. Verify user session
  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser();

  if (authError || !user) {
    return {
      success: false,
      error: { code: BOOKING_ERRORS.UNAUTHORIZED, message: 'You must be signed in to create a booking hold' },
    };
  }

  // 2. Fetch facility with venue and organization info
  const { data: facility, error: facilityError } = await supabase
    .from('facilities')
    .select(`
      id,
      venue_id,
      sport_id,
      name,
      status,
      is_bookable,
      buffer_minutes,
      venues (
        id,
        organization_id,
        name,
        status,
        currency
      )
    `)
    .eq('id', validated.facilityId)
    .single();

  if (facilityError || !facility) {
    return {
      success: false,
      error: { code: BOOKING_ERRORS.FACILITY_NOT_FOUND, message: 'Facility not found' },
    };
  }

  const venue = Array.isArray(facility.venues) ? facility.venues[0] : facility.venues;
  if (!venue || venue.status !== 'ACTIVE' || !facility.is_bookable || facility.status !== 'AVAILABLE') {
    return {
      success: false,
      error: { code: BOOKING_ERRORS.FACILITY_NOT_BOOKABLE, message: 'This facility is not available for bookings' },
    };
  }

  // 3. Calculate time intervals
  const startDateTime = new Date(`${validated.date}T${validated.startTime.substring(0, 5)}:00+05:30`);
  const endDateTime = new Date(startDateTime.getTime() + validated.durationMinutes * 60000);
  const bufferMinutes = facility.buffer_minutes || 0;
  const bufferedEndDateTime = new Date(endDateTime.getTime() + bufferMinutes * 60000);

  // 4. Fetch pricing rules and calculate verified price snapshot
  const { data: pricingRules } = await supabase
    .from('pricing_rules')
    .select('*')
    .eq('venue_id', facility.venue_id)
    .eq('is_active', true);

  const currency = venue.currency || BOOKING_CONFIG.DEFAULT_CURRENCY;
  const priceSnapshot = calculateBookingPriceSnapshot(
    pricingRules || [],
    facility.id,
    validated.date,
    validated.startTime,
    validated.durationMinutes,
    currency
  );

  if (!priceSnapshot) {
    return {
      success: false,
      error: { code: BOOKING_ERRORS.PRICE_CALCULATION_FAILED, message: 'No pricing rules available for the requested time' },
    };
  }

  const bookingReference = generateBookingReference(validated.date);
  const holdExpiresAt = new Date(Date.now() + BOOKING_CONFIG.DEFAULT_HOLD_DURATION_MINUTES * 60000).toISOString();
  const protectedTimeRange = `[${startDateTime.toISOString()}, ${bufferedEndDateTime.toISOString()})`;

  // 5. Try calling the PostgreSQL RPC if available, or direct INSERT
  const { data: booking, error: insertError } = await supabase
    .from('bookings')
    .insert({
      booking_reference: bookingReference,
      customer_user_id: user.id,
      organization_id: venue.organization_id,
      venue_id: venue.id,
      facility_id: facility.id,
      sport_id: facility.sport_id || null,
      booking_date: validated.date,
      start_time: validated.startTime.substring(0, 5),
      end_time: endDateTime.toISOString().split('T')[1].substring(0, 5),
      duration_minutes: validated.durationMinutes,
      protected_time_range: protectedTimeRange,
      status: 'HOLD',
      subtotal: priceSnapshot.subtotal,
      discount_amount: 0,
      total_amount: priceSnapshot.subtotal,
      currency,
      price_snapshot: priceSnapshot,
      customer_note: validated.customerNote || null,
      hold_expires_at: holdExpiresAt,
    })
    .select()
    .single();

  if (insertError) {
    // Check exclusion constraint violation (double booking)
    if (
      insertError.message.includes('prevent_double_booking') ||
      insertError.message.includes('exclusion_violation') ||
      insertError.code === '23P01'
    ) {
      return {
        success: false,
        error: {
          code: BOOKING_ERRORS.SLOT_UNAVAILABLE,
          message: 'The selected time slot was just taken by another customer. Please choose a different slot.',
        },
      };
    }

    return {
      success: false,
      error: { code: BOOKING_ERRORS.SLOT_UNAVAILABLE, message: insertError.message },
    };
  }

  // Safe isolated notification trigger (does not block or affect booking hold creation)
  try {
    defaultNotificationDispatcher
      .dispatchBookingHoldCreated(supabase, {
        ...(booking as any),
        facility: { name: facility.name },
        venue: { name: venue.name },
      })
      .catch((e: any) => console.warn('Failed to dispatch hold created notification:', e));
  } catch (e: any) {
    console.warn('Notification trigger error:', e);
  }

  return {
    success: true,
    booking: booking as Booking,
  };
}

