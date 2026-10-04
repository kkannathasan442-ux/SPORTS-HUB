import type { SupabaseClient } from '@supabase/supabase-js';
import type {
  Match,
  MatchWithDetails,
} from '@sportshub/types';
import type {
  MatchQueryFilterSchema,
} from '@sportshub/validation';

/**
 * Retrieves a single match by its UUID.
 */
export async function getMatchById(
  supabase: SupabaseClient<any, any, any>,
  matchId: string
): Promise<Match | null> {
  const { data, error } = await supabase
    .from('matches')
    .select('*')
    .eq('id', matchId)
    .maybeSingle();

  if (error || !data) {
    return null;
  }

  return data as Match;
}

/**
 * Retrieves full match details including sport, venue, facility, booking, and competitors with participants.
 */
export async function getMatchWithDetails(
  supabase: SupabaseClient<any, any, any>,
  matchId: string
): Promise<MatchWithDetails | null> {
  const { data: match, error: matchError } = await supabase
    .from('matches')
    .select(`
      *,
      sport:sports(id, name, slug, icon, supports_team, supports_live_scoring),
      organization:organizations(id, name, slug),
      venue:venues(id, name, slug, timezone),
      facility:facilities(id, name, facility_type),
      booking:bookings(id, booking_reference, status, start_time, end_time, booking_date)
    `)
    .eq('id', matchId)
    .maybeSingle();

  if (matchError || !match) {
    return null;
  }

  // Fetch competitors
  const { data: competitors, error: compError } = await supabase
    .from('match_competitors')
    .select(`
      *,
      team:teams(id, name, logo_url)
    `)
    .eq('match_id', matchId)
    .order('side', { ascending: true });

  if (compError) {
    throw new Error(`Failed to load match competitors: ${compError.message}`);
  }

  // Fetch participants
  const { data: participants, error: partError } = await supabase
    .from('match_participants')
    .select('*')
    .eq('match_id', matchId)
    .order('created_at', { ascending: true });

  if (partError) {
    throw new Error(`Failed to load match participants: ${partError.message}`);
  }

  const competitorsWithParticipants = (competitors || []).map((c: any) => ({
    ...c,
    participants: (participants || []).filter((p: any) => p.competitor_id === c.id),
  }));

  return {
    ...match,
    competitors: competitorsWithParticipants,
  } as MatchWithDetails;
}

/**
 * Lists matches with pagination and filtering.
 */
export async function listMatches(
  supabase: SupabaseClient<any, any, any>,
  filters: MatchQueryFilterSchema
) {
  let query = supabase
    .from('matches')
    .select(`
      *,
      sport:sports(id, name, slug, icon, supports_team, supports_live_scoring),
      venue:venues(id, name, slug, timezone),
      facility:facilities(id, name, facility_type)
    `, { count: 'exact' });

  if (filters.organizationId) {
    query = query.eq('organization_id', filters.organizationId);
  }
  if (filters.sportId) {
    query = query.eq('sport_id', filters.sportId);
  }
  if (filters.venueId) {
    query = query.eq('venue_id', filters.venueId);
  }
  if (filters.facilityId) {
    query = query.eq('facility_id', filters.facilityId);
  }
  if (filters.status) {
    query = query.eq('status', filters.status);
  }
  if (filters.matchFormat) {
    query = query.eq('match_format', filters.matchFormat);
  }

  const page = filters.page || 1;
  const limit = filters.limit || 20;
  const from = (page - 1) * limit;
  const to = from + limit - 1;

  query = query
    .order('created_at', { ascending: false })
    .range(from, to);

  const { data, count, error } = await query;

  if (error) {
    throw new Error(`Failed to list matches: ${error.message}`);
  }

  return {
    matches: (data || []) as Match[],
    totalCount: count || 0,
    page,
    limit,
    totalPages: Math.ceil((count || 0) / limit),
  };
}
