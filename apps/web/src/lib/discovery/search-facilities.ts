import { createSupabaseServerClient } from '../supabase/server';
import { venueSearchParamsSchema } from '@sportshub/validation';
import type {
  VenueSearchParams,
  PublicFacilityDetail,
  Booking,
  FacilityAvailabilityResult
} from '@sportshub/types';
import { calculateHaversineDistance } from './distance';
import { isSupabaseConfigured } from '../supabase/env';
import { generateFacilitySlots } from '../bookings/slot-generation';

export interface FacilitySearchResults {
  items: PublicFacilityDetail[];
  totalCount: number;
  page: number;
  pageSize: number;
  totalPages: number;
  appliedParams: VenueSearchParams;
}

export async function searchFacilities(
  rawParams: VenueSearchParams
): Promise<FacilitySearchResults> {
  const parsed = venueSearchParamsSchema.safeParse(rawParams);
  const params: VenueSearchParams = parsed.success ? parsed.data : { sort: 'distance', page: 1, pageSize: 12 };

  if (!isSupabaseConfigured()) {
    return {
      items: [],
      totalCount: 0,
      page: params.page || 1,
      pageSize: params.pageSize || 12,
      totalPages: 0,
      appliedParams: params,
    };
  }

  const supabase = await createSupabaseServerClient();

  // 1. Fetch active venues with their relations
  let query = supabase
    .from('venues')
    .select(`
      id,
      name,
      slug,
      city,
      district,
      address_line_1,
      latitude,
      longitude,
      status,
      organization:organizations(id, currency, status),
      venue_operating_hours(
        id,
        venue_id,
        day_of_week,
        open_time,
        close_time,
        is_closed
      ),
      facilities(
        id,
        venue_id,
        sport_id,
        name,
        slug,
        description,
        facility_type,
        capacity,
        status,
        is_bookable,
        default_duration_minutes,
        buffer_minutes,
        sport:sports(
          id,
          name,
          slug,
          icon,
          is_active,
          supports_booking
        )
      ),
      pricing_rules(
        id,
        organization_id,
        venue_id,
        facility_id,
        name,
        pricing_type,
        day_of_week,
        start_time,
        end_time,
        price_per_hour,
        member_price,
        priority,
        valid_from,
        valid_until,
        is_active
      ),
      maintenance_blocks(
        id,
        venue_id,
        facility_id,
        start_at,
        end_at,
        status
      )
    `)
    .eq('status', 'ACTIVE');

  if (params.locationText) {
    const term = `%${params.locationText.trim()}%`;
    query = query.or(
      `name.ilike.${term},city.ilike.${term},district.ilike.${term},address_line_1.ilike.${term},postal_code.ilike.${term}`
    );
  }

  const { data, error } = await query;
  if (error || !data) {
    return {
      items: [],
      totalCount: 0,
      page: params.page || 1,
      pageSize: params.pageSize || 12,
      totalPages: 0,
      appliedParams: params,
    };
  }

  // If date is provided, fetch existing bookings for real availability
  let existingBookings: Booking[] = [];
  if (params.date) {
    const { data: bookingsData } = await supabase
      .from('bookings')
      .select('*')
      .eq('booking_date', params.date)
      .in('status', ['HOLD', 'CONFIRMED']);
    if (bookingsData) {
      existingBookings = bookingsData as Booking[];
    }
  }

  const results: PublicFacilityDetail[] = [];

  for (const row of data as any[]) {
    if (row.organization?.status && row.organization.status !== 'ACTIVE') {
      continue;
    }

    const orgCurrency = row.organization?.currency || 'LKR';
    const operatingHours = row.venue_operating_hours || [];
    const maintenanceBlocks = row.maintenance_blocks || [];
    const pricingRules = row.pricing_rules || [];

    let distanceKm: number | null = null;
    if (params.latitude !== undefined && params.longitude !== undefined && row.latitude !== null && row.longitude !== null) {
      distanceKm = calculateHaversineDistance(params.latitude, params.longitude, Number(row.latitude), Number(row.longitude));
      if (params.radiusKm !== undefined && distanceKm > params.radiusKm) {
        continue;
      }
    }

    const publicFacilities = (row.facilities || []).filter(
      (f: any) => f.status !== 'ARCHIVED' && f.status !== 'CLOSED' && f.is_bookable && f.sport?.is_active
    );

    for (const fac of publicFacilities) {
      // Sport Filter
      if (params.sportId) {
        if (fac.sport_id !== params.sportId && fac.sport?.slug !== params.sportId) {
          continue;
        }
      }

      // Facility Type Filter
      if (params.facilityType) {
        const typeTerm = params.facilityType.toLowerCase().trim();
        if (
          (!fac.facility_type || !fac.facility_type.toLowerCase().includes(typeTerm)) &&
          !fac.name.toLowerCase().includes(typeTerm)
        ) {
          continue;
        }
      }

      let isAvailable = true;
      let slotStatus: FacilityAvailabilityResult = {
        facility_id: fac.id,
        facility_name: fac.name,
        status: 'AVAILABLE',
        is_available: true,
      };

      let startingPrice: number | null = null;

      // If specific date/time requested, check exact slot availability
      if (params.date && params.startTime) {
        // Calculate Day of Week
        const dateObj = new Date(`${params.date}T12:00:00Z`);
        const dayOfWeek = dateObj.getUTCDay();
        const dayHours = operatingHours.find((h: any) => h.day_of_week === dayOfWeek) || null;

        const duration = params.durationMinutes || fac.default_duration_minutes || 60;

        const slots = generateFacilitySlots({
          date: params.date,
          operatingHours: dayHours,
          facility: fac,
          durationMinutes: duration,
          intervalMinutes: duration, // Only generate exact requested slot size steps
          maintenanceBlocks,
          existingBookings,
          pricingRules,
          currency: orgCurrency,
        });

        // The slot could start at params.startTime. We need an exact match for the requested time.
        // Or if we don't use generateFacilitySlots, we could just evaluate that one slot.
        // Wait, generateFacilitySlots generates based on operating hours and steps.
        // If the requested time is not aligned with the intervals, it won't be found.
        // So let's look for a slot that covers it or starts with it.
        const requestedSlot = slots.find(s => s.startTime === params.startTime);

        if (!requestedSlot) {
          isAvailable = false;
          slotStatus = {
            facility_id: fac.id,
            facility_name: fac.name,
            status: 'OUTSIDE_OPERATING_HOURS',
            is_available: false,
          };
        } else if (!requestedSlot.isAvailable) {
          isAvailable = false;
          slotStatus = {
            facility_id: fac.id,
            facility_name: fac.name,
            status: requestedSlot.unavailableReason === 'MAINTENANCE' ? 'MAINTENANCE' : 'UNAVAILABLE',
            is_available: false,
            reason: requestedSlot.unavailableReason,
          };
        } else {
          startingPrice = requestedSlot.price;
          slotStatus = {
            facility_id: fac.id,
            facility_name: fac.name,
            status: 'AVAILABLE',
            is_available: true,
            slot_start: requestedSlot.startTime,
            slot_end: requestedSlot.endTime,
            price_per_hour: requestedSlot.price || undefined,
            calculated_price: requestedSlot.price ? {
              price_per_hour: requestedSlot.price,
              pricing_type: 'BASE',
              currency: orgCurrency
            } : null
          };
        }
      }

      if (params.availability === 'available' && !isAvailable) {
        continue;
      }

      if (params.minPrice !== undefined && startingPrice !== null && startingPrice < params.minPrice) continue;
      if (params.maxPrice !== undefined && startingPrice !== null && startingPrice > params.maxPrice) continue;

      results.push({
        id: fac.id,
        venue_id: fac.venue_id,
        sport_id: fac.sport_id,
        sport: fac.sport,
        name: fac.name,
        slug: fac.slug,
        description: fac.description,
        facility_type: fac.facility_type,
        capacity: fac.capacity,
        status: fac.status,
        is_bookable: fac.is_bookable,
        default_duration_minutes: fac.default_duration_minutes,
        buffer_minutes: fac.buffer_minutes,
        currency: orgCurrency,
        availability: slotStatus,
        starting_price_per_hour: startingPrice,
        pricing_rules: pricingRules.filter((r: any) => !r.facility_id || r.facility_id === fac.id),
        venue: {
          id: row.id,
          name: row.name,
          slug: row.slug,
          city: row.city,
          district: row.district,
          address_line_1: row.address_line_1,
          operating_hours: operatingHours,
        },
        ...((distanceKm !== null ? { _distance_km: distanceKm } : {}) as any)
      });
    }
  }

  // Sort
  const sort = params.sort || 'distance';
  results.sort((a: any, b: any) => {
    if (sort === 'price') {
      if (a.starting_price_per_hour === null) return 1;
      if (b.starting_price_per_hour === null) return -1;
      return a.starting_price_per_hour - b.starting_price_per_hour;
    }
    if (sort === 'distance') {
      if (a._distance_km !== undefined && b._distance_km !== undefined) return a._distance_km - b._distance_km;
      if (a._distance_km !== undefined) return -1;
      if (b._distance_km !== undefined) return 1;
    }
    return a.venue.name.localeCompare(b.venue.name);
  });

  // Clean up temporary field
  results.forEach((r: any) => { delete r._distance_km; });

  const page = params.page || 1;
  const pageSize = params.pageSize || 12;
  const totalCount = results.length;
  const totalPages = Math.ceil(totalCount / pageSize);
  const startIndex = (page - 1) * pageSize;
  const paginatedItems = results.slice(startIndex, startIndex + pageSize);

  return {
    items: paginatedItems,
    totalCount,
    page,
    pageSize,
    totalPages,
    appliedParams: params,
  };
}
