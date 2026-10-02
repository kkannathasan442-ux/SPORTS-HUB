import { SupabaseClient } from '@supabase/supabase-js';
import { facilitySlotQuerySchema, type FacilitySlotQuerySchema } from '@sportshub/validation';
import type { FacilitySlot, PublicFacilityDetail, VenueOperatingHours } from '@sportshub/types';
import { generateFacilitySlots } from './slot-generation';

export interface FacilityAvailabilityResult {
  success: boolean;
  facility?: {
    id: string;
    venue_id: string;
    name: string;
    sport_id: string;
    buffer_minutes: number;
    default_duration_minutes: number;
    capacity: number;
    currency: string;
    venue_name: string;
    venue_slug: string;
    venue_currency: string;
  };
  operatingHours?: VenueOperatingHours | null;
  slots: FacilitySlot[];
  error?: string;
}

/**
 * Fetches real-time availability slots for a facility on a specific date.
 */
export async function getFacilityAvailability(
  supabase: SupabaseClient,
  query: FacilitySlotQuerySchema
): Promise<FacilityAvailabilityResult> {
  const validated = facilitySlotQuerySchema.parse(query);

  // 1. Fetch facility details with venue info
  const { data: facility, error: facilityError } = await supabase
    .from('facilities')
    .select(`
      id,
      venue_id,
      sport_id,
      name,
      slug,
      facility_type,
      capacity,
      status,
      is_bookable,
      buffer_minutes,
      default_duration_minutes,
      venues (
        id,
        name,
        slug,
        status,
        currency
      )
    `)
    .eq('id', validated.facilityId)
    .single();

  if (facilityError || !facility) {
    return { success: false, slots: [], error: 'Facility not found' };
  }

  const venue = Array.isArray(facility.venues) ? facility.venues[0] : facility.venues;
  if (!venue || venue.status !== 'ACTIVE') {
    return { success: false, slots: [], error: 'Venue is currently not available for public bookings' };
  }

  // 2. Fetch venue operating hours
  const dateObj = new Date(`${validated.date}T12:00:00Z`);
  const dayOfWeek = dateObj.getUTCDay();

  const { data: operatingHours } = await supabase
    .from('venue_operating_hours')
    .select('*')
    .eq('venue_id', facility.venue_id)
    .eq('day_of_week', dayOfWeek)
    .maybeSingle();

  // 3. Fetch active maintenance blocks
  const { data: maintenanceBlocks } = await supabase
    .from('maintenance_blocks')
    .select('*')
    .eq('facility_id', facility.id)
    .eq('status', 'ACTIVE');

  // 4. Fetch pricing rules for venue and facility
  const { data: pricingRules } = await supabase
    .from('pricing_rules')
    .select('*')
    .eq('venue_id', facility.venue_id)
    .eq('is_active', true);

  // 5. Fetch existing active bookings (HOLD or CONFIRMED)
  const { data: existingBookings } = await supabase
    .from('bookings')
    .select('*')
    .eq('facility_id', facility.id)
    .eq('booking_date', validated.date)
    .in('status', ['HOLD', 'CONFIRMED']);

  const currency = venue.currency || 'LKR';

  // 6. Generate slots
  const slots = generateFacilitySlots({
    date: validated.date,
    operatingHours: operatingHours || null,
    facility: {
      id: facility.id,
      buffer_minutes: facility.buffer_minutes || 0,
      default_duration_minutes: facility.default_duration_minutes || 60,
      is_bookable: facility.is_bookable,
      status: facility.status,
    },
    durationMinutes: validated.durationMinutes || 60,
    maintenanceBlocks: maintenanceBlocks || [],
    existingBookings: existingBookings || [],
    pricingRules: pricingRules || [],
    currency,
  });

  return {
    success: true,
    facility: {
      id: facility.id,
      venue_id: facility.venue_id,
      name: facility.name,
      sport_id: facility.sport_id,
      buffer_minutes: facility.buffer_minutes || 0,
      default_duration_minutes: facility.default_duration_minutes || 60,
      capacity: facility.capacity,
      currency,
      venue_name: venue.name,
      venue_slug: venue.slug,
      venue_currency: currency,
    },
    operatingHours: operatingHours || null,
    slots,
  };
}
