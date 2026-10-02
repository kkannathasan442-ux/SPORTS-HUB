/**
 * SportsHub Owner Portal Database Queries
 *
 * Safe server-side queries for organization and venue management.
 * All queries are strictly scoped by the verified active organization ID.
 */

import { createSupabaseServerClient } from '../supabase/server';
import type {
  Organization,
  Venue,
  VenueWithCounts,
  VenueDetail,
  Sport,
  VenueSportWithSport,
  FacilityWithSport,
  VenueOperatingHours,
  PricingRule,
  MaintenanceBlock,
  OwnerDashboardSummary,
  VenueStatus,
} from '@sportshub/types';

/**
 * Retrieves high-level dashboard metrics for the current active organization.
 */
export async function getOwnerDashboardSummary(
  organizationId: string
): Promise<OwnerDashboardSummary> {
  const supabase = await createSupabaseServerClient();

  // 1. Total venues in this organization
  const { data: venues, error: vErr } = await supabase
    .from('venues')
    .select('id')
    .eq('organization_id', organizationId);

  const venueIds = venues?.map((v) => v.id) || [];
  const totalVenues = venueIds.length;

  if (totalVenues === 0) {
    return {
      totalVenues: 0,
      totalFacilities: 0,
      activeSportsCount: 0,
      activeMaintenanceBlocksCount: 0,
    };
  }

  // 2. Facilities count across all org venues
  const { count: facilitiesCount } = await supabase
    .from('facilities')
    .select('id', { count: 'exact', head: true })
    .in('venue_id', venueIds);

  // 3. Active venue sports count across all org venues
  const { data: venueSports } = await supabase
    .from('venue_sports')
    .select('sport_id')
    .in('venue_id', venueIds)
    .eq('is_active', true);

  // Distinct active sport types in this organization
  const distinctSportIds = new Set(venueSports?.map((vs) => vs.sport_id) || []);

  // 4. Active maintenance blocks count
  const { count: maintenanceCount } = await supabase
    .from('maintenance_blocks')
    .select('id', { count: 'exact', head: true })
    .eq('organization_id', organizationId)
    .eq('status', 'ACTIVE');

  return {
    totalVenues,
    totalFacilities: facilitiesCount || 0,
    activeSportsCount: distinctSportIds.size,
    activeMaintenanceBlocksCount: maintenanceCount || 0,
  };
}

/**
 * Retrieves the organization profile for the owner settings page.
 */
export async function getOwnerOrganization(
  organizationId: string
): Promise<Organization | null> {
  const supabase = await createSupabaseServerClient();

  const { data, error } = await supabase
    .from('organizations')
    .select('*')
    .eq('id', organizationId)
    .maybeSingle();

  if (error || !data) return null;
  return data as Organization;
}

/**
 * Retrieves all venues belonging to the active organization with optional search and status filter.
 */
export async function getOwnerVenues(
  organizationId: string,
  options?: { search?: string; status?: VenueStatus }
): Promise<VenueWithCounts[]> {
  const supabase = await createSupabaseServerClient();

  let query = supabase
    .from('venues')
    .select('*, facilities(id), venue_sports(id), pricing_rules(id)')
    .eq('organization_id', organizationId)
    .order('created_at', { ascending: false });

  if (options?.status) {
    query = query.eq('status', options.status);
  }

  if (options?.search) {
    const term = `%${options.search.trim()}%`;
    query = query.or(`name.ilike.${term},city.ilike.${term},district.ilike.${term}`);
  }

  const { data, error } = await query;

  if (error || !data) return [];

  return data.map((row: any) => ({
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
    latitude: row.latitude,
    longitude: row.longitude,
    phone: row.phone,
    email: row.email,
    status: row.status,
    timezone: row.timezone,
    cover_image_url: row.cover_image_url,
    created_at: row.created_at,
    updated_at: row.updated_at,
    facility_count: row.facilities?.length || 0,
    sports_count: row.venue_sports?.length || 0,
    pricing_rules_count: row.pricing_rules?.length || 0,
  }));
}

/**
 * Retrieves a single venue verified against the active organization.
 */
export async function getOwnerVenueById(
  organizationId: string,
  venueId: string
): Promise<Venue | null> {
  const supabase = await createSupabaseServerClient();

  const { data, error } = await supabase
    .from('venues')
    .select('*')
    .eq('id', venueId)
    .eq('organization_id', organizationId)
    .maybeSingle();

  if (error || !data) return null;
  return data as Venue;
}

/**
 * Retrieves the global catalog of active platform sports.
 */
export async function getGlobalActiveSports(): Promise<Sport[]> {
  const supabase = await createSupabaseServerClient();

  const { data, error } = await supabase
    .from('sports')
    .select('*')
    .eq('is_active', true)
    .order('name', { ascending: true });

  if (error || !data) return [];
  return data as Sport[];
}

/**
 * Retrieves sports assigned to a specific venue.
 */
export async function getVenueSports(venueId: string): Promise<VenueSportWithSport[]> {
  const supabase = await createSupabaseServerClient();

  const { data, error } = await supabase
    .from('venue_sports')
    .select('*, sport:sports(*)')
    .eq('venue_id', venueId)
    .order('created_at', { ascending: true });

  if (error || !data) return [];
  return data as VenueSportWithSport[];
}

/**
 * Retrieves facilities inside a specific venue.
 */
export async function getVenueFacilities(venueId: string): Promise<FacilityWithSport[]> {
  const supabase = await createSupabaseServerClient();

  const { data, error } = await supabase
    .from('facilities')
    .select('*, sport:sports(*)')
    .eq('venue_id', venueId)
    .order('created_at', { ascending: true });

  if (error || !data) return [];
  return data as FacilityWithSport[];
}

/**
 * Retrieves weekly operating hours (0=Sun, 1=Mon, ..., 6=Sat) for a venue.
 */
export async function getVenueOperatingHours(
  venueId: string
): Promise<VenueOperatingHours[]> {
  const supabase = await createSupabaseServerClient();

  const { data, error } = await supabase
    .from('venue_operating_hours')
    .select('*')
    .eq('venue_id', venueId)
    .order('day_of_week', { ascending: true });

  if (error || !data || data.length === 0) {
    // Generate default template if no hours record has been seeded yet
    return Array.from({ length: 7 }, (_, i) => ({
      id: `default-${i}`,
      venue_id: venueId,
      day_of_week: i,
      open_time: '06:00:00',
      close_time: '22:00:00',
      is_closed: false,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    }));
  }

  return data as VenueOperatingHours[];
}

/**
 * Retrieves pricing rules configured for a venue and its facilities.
 */
export async function getVenuePricingRules(
  organizationId: string,
  venueId: string
): Promise<PricingRule[]> {
  const supabase = await createSupabaseServerClient();

  const { data, error } = await supabase
    .from('pricing_rules')
    .select('*')
    .eq('organization_id', organizationId)
    .eq('venue_id', venueId)
    .order('priority', { ascending: false })
    .order('created_at', { ascending: false });

  if (error || !data) return [];
  return data as PricingRule[];
}

/**
 * Retrieves maintenance downtime blocks for a venue.
 */
export async function getVenueMaintenanceBlocks(
  organizationId: string,
  venueId: string
): Promise<MaintenanceBlock[]> {
  const supabase = await createSupabaseServerClient();

  const { data, error } = await supabase
    .from('maintenance_blocks')
    .select('*')
    .eq('organization_id', organizationId)
    .eq('venue_id', venueId)
    .order('start_at', { ascending: false });

  if (error || !data) return [];
  return data as MaintenanceBlock[];
}

/**
 * Full detailed venue aggregate for tabbed view.
 */
export async function getOwnerVenueDetail(
  organizationId: string,
  venueId: string
): Promise<VenueDetail | null> {
  const venue = await getOwnerVenueById(organizationId, venueId);
  if (!venue) return null;

  const org = await getOwnerOrganization(organizationId);
  if (!org) return null;

  const [sports, facilities, operating_hours, pricing_rules, maintenance_blocks] =
    await Promise.all([
      getVenueSports(venueId),
      getVenueFacilities(venueId),
      getVenueOperatingHours(venueId),
      getVenuePricingRules(organizationId, venueId),
      getVenueMaintenanceBlocks(organizationId, venueId),
    ]);

  return {
    ...venue,
    organization: org,
    sports,
    facilities,
    operating_hours,
    pricing_rules,
    maintenance_blocks,
  };
}
