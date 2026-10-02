import { SupabaseClient } from '@supabase/supabase-js';
import type { BookingWithDetails, BookingStatus, WalkInBookingInput } from '@sportshub/types';
import { generateBookingReference } from './create-hold';
import { calculateBookingPriceSnapshot } from './pricing';
import { BOOKING_CONFIG } from '@sportshub/config';

export interface GetCustomerBookingsOptions {
  status?: BookingStatus | 'UPCOMING' | 'HISTORY';
  limit?: number;
  offset?: number;
}

/**
 * Retrieves all bookings for a customer with joined venue, facility, and sport details.
 */
export async function getCustomerBookings(
  supabase: SupabaseClient,
  customerUserId: string,
  options: GetCustomerBookingsOptions = {}
): Promise<BookingWithDetails[]> {
  let query = supabase
    .from('bookings')
    .select(`
      *,
      venues (
        id,
        name,
        slug,
        address_line_1,
        city,
        phone
      ),
      facilities (
        id,
        name,
        slug,
        facility_type
      ),
      sports (
        id,
        name,
        icon_name
      )
    `)
    .eq('customer_user_id', customerUserId)
    .order('booking_date', { ascending: false })
    .order('start_time', { ascending: false });

  if (options.status) {
    if (options.status === 'UPCOMING') {
      const todayStr = new Date().toISOString().split('T')[0];
      query = query
        .in('status', ['HOLD', 'CONFIRMED'])
        .gte('booking_date', todayStr);
    } else if (options.status === 'HISTORY') {
      const todayStr = new Date().toISOString().split('T')[0];
      query = query.or(`status.in.(COMPLETED,CANCELLED,EXPIRED,NO_SHOW),booking_date.lt.${todayStr}`);
    } else {
      query = query.eq('status', options.status);
    }
  }

  if (options.limit) {
    query = query.limit(options.limit);
  }

  const { data, error } = await query;
  if (error || !data) return [];

  return data.map((b: any) => ({
    ...b,
    venue: Array.isArray(b.venues) ? b.venues[0] : b.venues,
    facility: Array.isArray(b.facilities) ? b.facilities[0] : b.facilities,
    sport: Array.isArray(b.sports) ? b.sports[0] : b.sports,
  }));
}

/**
 * Retrieves single booking detail with verified permissions.
 */
export async function getBookingDetails(
  supabase: SupabaseClient,
  bookingId: string,
  userId?: string
): Promise<BookingWithDetails | null> {
  const query = supabase
    .from('bookings')
    .select(`
      *,
      venues (
        id,
        name,
        slug,
        address_line_1,
        city,
        phone
      ),
      facilities (
        id,
        name,
        slug,
        facility_type
      ),
      sports (
        id,
        name,
        icon_name
      )
    `)
    .eq('id', bookingId)
    .single();

  const { data, error } = await query;
  if (error || !data) return null;

  // If userId provided, check ownership unless staff
  if (userId && data.customer_user_id !== userId) {
    // Check staff membership
    const { data: member } = await supabase
      .from('organization_members')
      .select('id, role')
      .eq('organization_id', data.organization_id)
      .eq('user_id', userId)
      .eq('status', 'ACTIVE')
      .maybeSingle();

    if (!member) return null;
  }

  return {
    ...data,
    venue: Array.isArray(data.venues) ? data.venues[0] : data.venues,
    facility: Array.isArray(data.facilities) ? data.facilities[0] : data.facilities,
    sport: Array.isArray(data.sports) ? data.sports[0] : data.sports,
  };
}

/**
 * Retrieves venue booking ledger for owner/staff calendar.
 */
export async function getVenueBookings(
  supabase: SupabaseClient,
  venueId: string,
  dateStr?: string,
  status?: BookingStatus
): Promise<BookingWithDetails[]> {
  let query = supabase
    .from('bookings')
    .select(`
      *,
      facilities (
        id,
        name,
        slug,
        facility_type
      ),
      sports (
        id,
        name,
        icon_name
      )
    `)
    .eq('venue_id', venueId)
    .order('start_time', { ascending: true });

  if (dateStr) {
    query = query.eq('booking_date', dateStr);
  }

  if (status) {
    query = query.eq('status', status);
  }

  const { data, error } = await query;
  if (error || !data) return [];

  return data.map((b: any) => ({
    ...b,
    facility: Array.isArray(b.facilities) ? b.facilities[0] : b.facilities,
    sport: Array.isArray(b.sports) ? b.sports[0] : b.sports,
  }));
}

/**
 * Creates an immediate confirmed walk-in / desk booking by staff.
 */
export async function createWalkInBooking(
  supabase: SupabaseClient,
  staffUserId: string,
  input: WalkInBookingInput
) {
  // 1. Fetch venue & facility
  const { data: facility } = await supabase
    .from('facilities')
    .select(`
      id,
      venue_id,
      buffer_minutes,
      venues (
        id,
        organization_id,
        currency
      )
    `)
    .eq('id', input.facilityId)
    .single();

  if (!facility) {
    throw new Error('Facility not found');
  }

  const venue = Array.isArray(facility.venues) ? facility.venues[0] : facility.venues;

  // 2. Pricing snapshot
  const { data: pricingRules } = await supabase
    .from('pricing_rules')
    .select('*')
    .eq('venue_id', venue.id)
    .eq('is_active', true);

  const currency = venue.currency || BOOKING_CONFIG.DEFAULT_CURRENCY;
  const priceSnapshot = calculateBookingPriceSnapshot(
    pricingRules || [],
    facility.id,
    input.bookingDate,
    input.startTime,
    input.durationMinutes,
    currency
  );

  const subtotal = input.amountPaid !== undefined ? input.amountPaid : (priceSnapshot?.subtotal || 0);

  const startDateTime = new Date(`${input.bookingDate}T${input.startTime.substring(0, 5)}:00+05:30`);
  const endDateTime = new Date(startDateTime.getTime() + input.durationMinutes * 60000);
  const bufferMins = facility.buffer_minutes || 0;
  const bufferedEndDateTime = new Date(endDateTime.getTime() + bufferMins * 60000);

  const bookingRef = generateBookingReference(input.bookingDate);
  const nowIso = new Date().toISOString();

  const customerNote = [
    `Walk-In Guest: ${input.customerName} (${input.customerPhone})`,
    input.customerEmail ? `Email: ${input.customerEmail}` : null,
    input.paymentMethod ? `Payment: ${input.paymentMethod}` : null,
    input.notes ? `Notes: ${input.notes}` : null,
  ]
    .filter(Boolean)
    .join(' | ');

  const { data: booking, error } = await supabase
    .from('bookings')
    .insert({
      booking_reference: bookingRef,
      customer_user_id: staffUserId, // Registered under staff actor
      organization_id: venue.organization_id,
      venue_id: venue.id,
      facility_id: facility.id,
      sport_id: input.sportId || null,
      booking_date: input.bookingDate,
      start_time: input.startTime.substring(0, 5),
      end_time: endDateTime.toISOString().split('T')[1].substring(0, 5),
      duration_minutes: input.durationMinutes,
      protected_time_range: `[${startDateTime.toISOString()}, ${bufferedEndDateTime.toISOString()})`,
      status: 'CONFIRMED',
      subtotal,
      discount_amount: 0,
      total_amount: subtotal,
      currency,
      price_snapshot: priceSnapshot || { walkInSubtotal: subtotal },
      customer_note: customerNote,
      confirmed_at: nowIso,
    })
    .select()
    .single();

  if (error) {
    if (error.message.includes('prevent_double_booking')) {
      throw new Error('This time slot is already booked or overlaps an existing reservation.');
    }
    throw error;
  }

  return booking;
}
