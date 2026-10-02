/**
 * Public Venue & Facility Discovery Fetchers
 *
 * Provides safe, sanitized queries for public venue and facility pages.
 * Never exposes private tenant data (staff, member profiles, internal financial records, private maintenance notes).
 */

import { createSupabaseServerClient } from '../supabase/server';
import type {
  PublicVenueDetail,
  PublicFacilityDetail,
  Sport,
  VenueStatus,
  VenueOperatingHours,
  VenueSearchParams,
} from '@sportshub/types';
import { isSupabaseConfigured } from '../supabase/env';
import { INITIAL_SPORTS } from '@sportshub/config';
import { checkFacilityAvailability } from './availability';
import { calculateStartingPrice } from './pricing';

/**
 * Retrieves global active sports for public search dropdowns.
 */
export async function getActivePlatformSports(): Promise<Sport[]> {
  if (!isSupabaseConfigured()) {
    return Object.values(INITIAL_SPORTS).map((s) => ({
      id: s.id,
      name: s.name,
      slug: s.id,
      description: s.description,
      icon: null,
      image_url: null,
      is_active: true,
      supports_booking: true,
      supports_team: true,
      supports_tournament: true,
      supports_live_scoring: true,
      created_at: '2026-01-01',
      updated_at: '2026-01-01',
    }));
  }

  const supabase = await createSupabaseServerClient();

  const { data, error } = await supabase
    .from('sports')
    .select('*')
    .eq('is_active', true)
    .order('name', { ascending: true });

  if (error || !data || data.length === 0) {
    return Object.values(INITIAL_SPORTS).map((s) => ({
      id: s.id,
      name: s.name,
      slug: s.id,
      description: s.description,
      icon: null,
      image_url: null,
      is_active: true,
      supports_booking: true,
      supports_team: true,
      supports_tournament: true,
      supports_live_scoring: true,
      created_at: '2026-01-01',
      updated_at: '2026-01-01',
    }));
  }
  return data as Sport[];
}

/**
 * Retrieves public details for a single venue by ID or slug.
 */
export async function getPublicVenueById(
  venueIdOrSlug: string,
  searchParams?: VenueSearchParams
): Promise<PublicVenueDetail | null> {
  if (!isSupabaseConfigured()) {
    return null;
  }

  const supabase = await createSupabaseServerClient();

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
      phone,
      email,
      status,
      timezone,
      cover_image_url,
      organization:organizations(id, name, currency, status),
      venue_sports(
        id,
        is_active,
        sport:sports(*)
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
        sport:sports(*)
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

  // Query by ID or slug
  const isUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(venueIdOrSlug);
  if (isUuid) {
    query = query.eq('id', venueIdOrSlug);
  } else {
    query = query.eq('slug', venueIdOrSlug);
  }

  const { data, error } = await query.maybeSingle();
  if (error || !data) return null;

  const row = data as any;
  const currency = row.organization?.currency || 'LKR';

  const sports: Sport[] = (row.venue_sports || [])
    .filter((vs: any) => vs.is_active && vs.sport && vs.sport.is_active)
    .map((vs: any) => vs.sport as Sport);

  const operatingHours: VenueOperatingHours[] = (row.venue_operating_hours || []).sort(
    (a: any, b: any) => a.day_of_week - b.day_of_week
  );

  const pricingRules = row.pricing_rules || [];
  const maintenanceBlocks = row.maintenance_blocks || [];

  // Filter public facilities
  const publicFacilities: PublicFacilityDetail[] = (row.facilities || [])
    .filter((f: any) => f.status !== 'ARCHIVED' && f.status !== 'CLOSED')
    .map((f: any) => {
      const avail = checkFacilityAvailability({
        facility: f,
        venueOperatingHours: operatingHours,
        maintenanceBlocks,
        pricingRules,
        currency,
        dateStr: searchParams?.date,
        timeStr: searchParams?.startTime,
        durationMinutes: searchParams?.durationMinutes,
      });

      const startingPrice = calculateStartingPrice(
        pricingRules,
        f.id,
        undefined,
        searchParams?.startTime
      );

      const facilityPricingRules = pricingRules.filter(
        (pr: any) => !pr.facility_id || pr.facility_id === f.id
      );

      return {
        id: f.id,
        venue_id: f.venue_id,
        sport_id: f.sport_id,
        sport: f.sport || null,
        name: f.name,
        slug: f.slug,
        description: f.description,
        facility_type: f.facility_type,
        capacity: f.capacity,
        status: f.status,
        is_bookable: f.is_bookable,
        default_duration_minutes: f.default_duration_minutes,
        buffer_minutes: f.buffer_minutes,
        currency,
        availability: avail,
        starting_price_per_hour: startingPrice,
        pricing_rules: facilityPricingRules,
        venue: {
          id: row.id,
          name: row.name,
          slug: row.slug,
          city: row.city,
          district: row.district,
          address_line_1: row.address_line_1,
          operating_hours: operatingHours,
        },
      };
    });

  const venueStartingPrice = calculateStartingPrice(
    pricingRules,
    null,
    undefined,
    searchParams?.startTime
  );

  return {
    id: row.id,
    organization_id: row.organization_id,
    name: row.name,
    slug: row.slug,
    description: row.description,
    address_line_1: row.address_line_1,
    address_line_2: row.address_line_2,
    city: row.city,
    district: row.district,
    postal_code: row.postal_code,
    latitude: row.latitude ? Number(row.latitude) : null,
    longitude: row.longitude ? Number(row.longitude) : null,
    phone: row.phone,
    email: row.email,
    status: row.status as VenueStatus,
    timezone: row.timezone || 'Asia/Colombo',
    cover_image_url: row.cover_image_url,
    currency,
    sports,
    facilities: publicFacilities,
    operating_hours: operatingHours,
    starting_price_per_hour: venueStartingPrice,
  };
}

/**
 * Retrieves public details for a single facility inside a venue.
 */
export async function getPublicFacilityById(
  venueId: string,
  facilityId: string,
  searchParams?: VenueSearchParams
): Promise<PublicFacilityDetail | null> {
  const venue = await getPublicVenueById(venueId, searchParams);
  if (!venue) return null;

  const facility = venue.facilities.find((f) => f.id === facilityId || f.slug === facilityId);
  if (!facility) return null;

  return facility;
}
