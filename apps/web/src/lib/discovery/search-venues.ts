/**
 * Customer Discovery & Venue Search Service
 *
 * Safe server-side discovery search querying strictly ACTIVE venues and public facilities.
 * Computes geographic distances, starting hourly prices, and slot availability.
 */

import { createSupabaseServerClient } from '../supabase/server';
import { venueSearchParamsSchema } from '@sportshub/validation';
import type {
  VenueSearchParams,
  PublicVenueSearchResult,
  DiscoverySearchResults,
  Sport,
  VenueStatus,
  FacilityAvailabilityStatus,
} from '@sportshub/types';
import { calculateHaversineDistance } from './distance';
import { calculateStartingPrice } from './pricing';
import { checkFacilityAvailability } from './availability';
import { isSupabaseConfigured } from '../supabase/env';

export async function searchPublicVenues(
  rawParams: VenueSearchParams
): Promise<DiscoverySearchResults> {
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

  // 1. Base Query: Only ACTIVE venues for public discovery
  let query = supabase
    .from('venues')
    .select(`
      id,
      organization_id,
      name,
      slug,
      description,
      address_line_1,
      address_line_2,
      city,
      district,
      postal_code,
      latitude,
      longitude,
      status,
      timezone,
      cover_image_url,
      created_at,
      updated_at,
      organization:organizations(id, name, currency, timezone, status),
      venue_sports(
        id,
        is_active,
        sport:sports(
          id,
          name,
          slug,
          description,
          icon,
          image_url,
          is_active,
          supports_booking
        )
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
        buffer_minutes
      ),
      venue_operating_hours(
        id,
        venue_id,
        day_of_week,
        open_time,
        close_time,
        is_closed
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

  // Text location filter on venue level
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

  // 2. Process and Filter in Memory (Sport, Availability, Pricing, Distance)
  const results: PublicVenueSearchResult[] = [];

  for (const row of data as any[]) {
    // Check organization status (must be ACTIVE)
    if (row.organization?.status && row.organization.status !== 'ACTIVE') {
      continue;
    }

    const orgCurrency = row.organization?.currency || 'LKR';

    // Extract active sports
    const activeVenueSports = (row.venue_sports || [])
      .filter((vs: any) => vs.is_active && vs.sport && vs.sport.is_active)
      .map((vs: any) => vs.sport as Sport);

    // If sportId filter is applied, venue must support this sport
    if (params.sportId) {
      const supportsSport = activeVenueSports.some(
        (s: Sport) => s.id === params.sportId || s.slug === params.sportId
      );
      if (!supportsSport) {
        continue;
      }
    }

    // Public facilities (exclude ARCHIVED and CLOSED)
    const publicFacilities = (row.facilities || []).filter(
      (f: any) => f.status !== 'ARCHIVED' && f.status !== 'CLOSED'
    );

    // Facility Type filter
    if (params.facilityType) {
      const typeTerm = params.facilityType.toLowerCase().trim();
      const hasMatchingType = publicFacilities.some(
        (f: any) =>
          (f.facility_type && f.facility_type.toLowerCase().includes(typeTerm)) ||
          f.name.toLowerCase().includes(typeTerm)
      );
      if (!hasMatchingType) {
        continue;
      }
    }

    // Calculate Availability for each facility
    const operatingHours = row.venue_operating_hours || [];
    const maintenanceBlocks = row.maintenance_blocks || [];
    const pricingRules = row.pricing_rules || [];

    let availableFacilitiesCount = 0;
    let bestAvailabilityStatus: FacilityAvailabilityStatus = 'UNAVAILABLE';

    for (const fac of publicFacilities) {
      const avail = checkFacilityAvailability({
        facility: fac,
        venueOperatingHours: operatingHours,
        maintenanceBlocks,
        pricingRules,
        currency: orgCurrency,
        dateStr: params.date,
        timeStr: params.startTime,
        durationMinutes: params.durationMinutes,
      });

      if (avail.is_available) {
        availableFacilitiesCount++;
        bestAvailabilityStatus = 'AVAILABLE';
      } else if (bestAvailabilityStatus !== 'AVAILABLE') {
        bestAvailabilityStatus = avail.status;
      }
    }

    // Availability Filter
    if (params.availability === 'available' && availableFacilitiesCount === 0) {
      continue;
    }

    // Calculate Starting Price
    const startingPrice = calculateStartingPrice(
      pricingRules,
      null,
      undefined,
      params.startTime
    );

    // Price Filter
    if (params.minPrice !== undefined && startingPrice !== null) {
      if (startingPrice < params.minPrice) {
        continue;
      }
    }
    if (params.maxPrice !== undefined && startingPrice !== null) {
      if (startingPrice > params.maxPrice) {
        continue;
      }
    }

    // Calculate Geo Distance if search coordinates and venue coordinates are present
    let distanceKm: number | null = null;
    if (
      params.latitude !== undefined &&
      params.longitude !== undefined &&
      row.latitude !== null &&
      row.longitude !== null
    ) {
      distanceKm = calculateHaversineDistance(
        params.latitude,
        params.longitude,
        Number(row.latitude),
        Number(row.longitude)
      );

      // Radius Filter
      if (params.radiusKm !== undefined && distanceKm > params.radiusKm) {
        continue;
      }
    }

    // Format address
    const addressFormatted = [
      row.address_line_1,
      row.address_line_2,
      row.city,
      row.district,
    ]
      .filter(Boolean)
      .join(', ');

    results.push({
      venue_id: row.id,
      venue_name: row.name,
      slug: row.slug,
      description: row.description,
      cover_image_url: row.cover_image_url,
      address: addressFormatted || null,
      city: row.city,
      district: row.district,
      latitude: row.latitude ? Number(row.latitude) : null,
      longitude: row.longitude ? Number(row.longitude) : null,
      distance_km: distanceKm,
      status: row.status as VenueStatus,
      currency: orgCurrency,
      sports: activeVenueSports,
      total_facilities_count: publicFacilities.length,
      available_facilities_count: availableFacilitiesCount,
      starting_price_per_hour: startingPrice,
      overall_availability_status: bestAvailabilityStatus,
    });
  }

  // 3. Sorting
  const sort = params.sort || 'distance';

  results.sort((a, b) => {
    if (sort === 'price') {
      if (a.starting_price_per_hour === null) return 1;
      if (b.starting_price_per_hour === null) return -1;
      return a.starting_price_per_hour - b.starting_price_per_hour;
    }

    if (sort === 'availability') {
      return b.available_facilities_count - a.available_facilities_count;
    }

    // Default 'distance' sort
    if (a.distance_km !== null && b.distance_km !== null) {
      return a.distance_km - b.distance_km;
    }
    if (a.distance_km !== null) return -1;
    if (b.distance_km !== null) return 1;

    return a.venue_name.localeCompare(b.venue_name);
  });

  // 4. Pagination
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
