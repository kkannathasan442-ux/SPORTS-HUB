import type { SupabaseClient } from '@supabase/supabase-js';
import type {
  CreateMatchSchema,
  UpdateMatchSchema,
  CreateCompetitorSchema,
  UpdateCompetitorSchema,
  CreateParticipantSchema,
  UpdateParticipantSchema,
  TransitionMatchStatusSchema,
} from '@sportshub/validation';
import type {
  MatchStatus,
  MatchFormat,
} from '@sportshub/types';

export interface UserContext {
  userId: string;
  email?: string;
}

export class MatchServiceError extends Error {
  constructor(message: string, public statusCode: number = 400, public code: string = 'BAD_REQUEST') {
    super(message);
    this.name = 'MatchServiceError';
  }
}

/**
 * Checks if user is a platform SUPER_ADMIN via organization_members.
 */
async function checkSuperAdmin(
  supabase: SupabaseClient<any, any, any>,
  userId: string
): Promise<boolean> {
  const { data } = await supabase
    .from('organization_members')
    .select('id')
    .eq('user_id', userId)
    .eq('role', 'SUPER_ADMIN')
    .eq('status', 'ACTIVE')
    .maybeSingle();
  return !!data;
}

/**
 * Helper to check whether user can manage an organization's resources.
 */
async function canManageOrganization(
  supabase: SupabaseClient<any, any, any>,
  userId: string,
  organizationId: string
): Promise<boolean> {
  const superAdmin = await checkSuperAdmin(supabase, userId);
  if (superAdmin) return true;

  const { data: member } = await supabase
    .from('organization_members')
    .select('role, status')
    .eq('organization_id', organizationId)
    .eq('user_id', userId)
    .eq('status', 'ACTIVE')
    .maybeSingle();

  if (!member) return false;
  return ['OWNER', 'MANAGER', 'RECEPTIONIST'].includes(member.role);
}

/**
 * Safely writes an audit log entry using the provided supabase client.
 */
async function logMatchAudit(
  supabase: SupabaseClient<any, any, any>,
  params: {
    action: string;
    entityType: string;
    entityId: string;
    organizationId?: string | null;
    actorUserId: string;
    beforeData?: Record<string, unknown> | null;
    afterData?: Record<string, unknown> | null;
    metadata?: Record<string, unknown>;
  }
): Promise<void> {
  try {
    await supabase.from('audit_logs').insert({
      organization_id: params.organizationId || null,
      actor_user_id: params.actorUserId,
      action: params.action,
      entity_type: params.entityType,
      entity_id: params.entityId || null,
      before_data: params.beforeData || null,
      after_data: params.afterData || null,
      metadata: params.metadata || {},
    });
  } catch (err) {
    // Non-blocking audit failure
  }
}

/**
 * Creates a new match in DRAFT status with full tenant, booking, and sport validation.
 */
export async function createMatch(
  supabase: SupabaseClient<any, any, any>,
  input: CreateMatchSchema,
  userCtx: UserContext
) {
  if (!userCtx?.userId) {
    throw new MatchServiceError('Authentication required', 401, 'UNAUTHORIZED');
  }

  let authoritativeOrgId = input.organizationId || null;
  let authoritativeSportId = input.sportId;
  let authoritativeVenueId = input.venueId || null;
  let authoritativeFacilityId = input.facilityId || null;
  let authoritativeStart = input.scheduledStart || null;
  let authoritativeEnd = input.scheduledEnd || null;

  // 1. If booking_id is provided, derive authoritative values from booking
  if (input.bookingId) {
    const { data: booking, error: bError } = await supabase
      .from('bookings')
      .select('id, customer_user_id, organization_id, venue_id, facility_id, sport_id, booking_date, start_time, end_time, status')
      .eq('id', input.bookingId)
      .single();

    if (bError || !booking) {
      throw new MatchServiceError('Referenced booking not found', 404, 'BOOKING_NOT_FOUND');
    }

    // Verify booking ownership or org authority
    const isOwner = booking.customer_user_id === userCtx.userId;
    const canManageOrg = await canManageOrganization(supabase, userCtx.userId, booking.organization_id);

    if (!isOwner && !canManageOrg) {
      throw new MatchServiceError('You do not have permission to attach this booking', 403, 'FORBIDDEN');
    }

    if (booking.status === 'EXPIRED') {
      throw new MatchServiceError('Cannot attach an expired booking hold', 400, 'BOOKING_EXPIRED');
    }

    authoritativeOrgId = booking.organization_id;
    authoritativeVenueId = booking.venue_id;
    authoritativeFacilityId = booking.facility_id;
    authoritativeSportId = booking.sport_id;

    // If times not explicitly specified, derive from booking date and slot times in Asia/Colombo (+05:30)
    if (!authoritativeStart) {
      authoritativeStart = new Date(`${booking.booking_date}T${booking.start_time}+05:30`).toISOString();
    }
    if (!authoritativeEnd) {
      authoritativeEnd = new Date(`${booking.booking_date}T${booking.end_time}+05:30`).toISOString();
    }
  }

  // 2. If no booking, sport_id is strictly required
  if (!authoritativeSportId) {
    throw new MatchServiceError('sportId is required when no booking is attached', 400, 'SPORT_REQUIRED');
  }

  // Verify sport exists and is active
  const { data: sport, error: sErr } = await supabase
    .from('sports')
    .select('id, is_active, supports_team')
    .eq('id', authoritativeSportId)
    .single();

  if (sErr || !sport || !sport.is_active) {
    throw new MatchServiceError('Sport not found or inactive', 400, 'INVALID_SPORT');
  }

  // If format is TEAM, check sport capability
  if (input.matchFormat === 'TEAM' && !sport.supports_team) {
    throw new MatchServiceError('The selected sport does not support team format', 400, 'SPORT_NO_TEAM_SUPPORT');
  }

  // 3. Organization authorization check
  if (authoritativeOrgId && !input.bookingId) {
    const isSuper = await checkSuperAdmin(supabase, userCtx.userId);
    if (!isSuper) {
      const { data: membership } = await supabase
        .from('organization_members')
        .select('id, status')
        .eq('organization_id', authoritativeOrgId)
        .eq('user_id', userCtx.userId)
        .eq('status', 'ACTIVE')
        .maybeSingle();

      if (!membership) {
        throw new MatchServiceError('You are not an active member of this organization', 403, 'FORBIDDEN');
      }
    }
  }

  // 4. Facility/venue validation
  if (authoritativeFacilityId) {
    if (!authoritativeVenueId) {
      throw new MatchServiceError('facilityId requires a valid venueId', 400, 'FACILITY_REQUIRES_VENUE');
    }

    const { data: facility, error: fErr } = await supabase
      .from('facilities')
      .select('id, venue_id, sport_id, status')
      .eq('id', authoritativeFacilityId)
      .single();

    if (fErr || !facility) {
      throw new MatchServiceError('Facility not found', 404, 'FACILITY_NOT_FOUND');
    }

    if (facility.venue_id !== authoritativeVenueId) {
      throw new MatchServiceError('Facility does not belong to the selected venue', 400, 'FACILITY_VENUE_MISMATCH');
    }

    if (facility.status === 'ARCHIVED') {
      throw new MatchServiceError('Facility is archived', 400, 'FACILITY_ARCHIVED');
    }

    if (facility.sport_id && facility.sport_id !== authoritativeSportId) {
      throw new MatchServiceError('Facility sport does not match match sport', 400, 'SPORT_FACILITY_MISMATCH');
    }
  }

  // 5. Insert Match
  const { data: match, error: insertError } = await supabase
    .from('matches')
    .insert({
      sport_id: authoritativeSportId,
      organization_id: authoritativeOrgId,
      venue_id: authoritativeVenueId,
      facility_id: authoritativeFacilityId,
      booking_id: input.bookingId || null,
      title: input.title?.trim() || null,
      match_type: input.matchType,
      match_format: input.matchFormat,
      status: 'DRAFT',
      scheduled_start: authoritativeStart,
      scheduled_end: authoritativeEnd,
      created_by: userCtx.userId,
      metadata: input.metadata || {},
    })
    .select('*')
    .single();

  if (insertError || !match) {
    throw new MatchServiceError(`Failed to create match: ${insertError?.message}`, 400, 'MATCH_CREATION_FAILED');
  }

  // Audit Log
  await logMatchAudit(supabase, {
    action: 'MATCH_CREATED',
    entityType: 'MATCH',
    entityId: match.id,
    organizationId: match.organization_id || undefined,
    actorUserId: userCtx.userId,
    metadata: {
      match_reference: match.match_reference,
      sport_id: match.sport_id,
      match_format: match.match_format,
      match_type: match.match_type,
    },
  });

  return { success: true, match };
}

/**
 * Updates a match while in DRAFT or SCHEDULED status.
 */
export async function updateMatch(
  supabase: SupabaseClient<any, any, any>,
  matchId: string,
  input: UpdateMatchSchema,
  userCtx: UserContext
) {
  if (!userCtx?.userId) {
    throw new MatchServiceError('Authentication required', 401, 'UNAUTHORIZED');
  }

  const { data: match, error: fetchError } = await supabase
    .from('matches')
    .select('*')
    .eq('id', matchId)
    .single();

  if (fetchError || !match) {
    throw new MatchServiceError('Match not found', 404, 'MATCH_NOT_FOUND');
  }

  if (['COMPLETED', 'CANCELLED', 'ABANDONED'].includes(match.status)) {
    throw new MatchServiceError(`Cannot edit a match in terminal status: ${match.status}`, 400, 'TERMINAL_STATE');
  }

  // Authorization check
  const isCreator = match.created_by === userCtx.userId;
  const isSuper = await checkSuperAdmin(supabase, userCtx.userId);
  let canManageOrg = false;
  if (match.organization_id) {
    canManageOrg = await canManageOrganization(supabase, userCtx.userId, match.organization_id);
  }

  if (!isCreator && !canManageOrg && !isSuper) {
    throw new MatchServiceError('You do not have permission to update this match', 403, 'FORBIDDEN');
  }

  const updatePayload: Record<string, any> = {};

  if (input.title !== undefined) updatePayload.title = input.title?.trim() || null;
  if (input.venueId !== undefined) updatePayload.venue_id = input.venueId;
  if (input.facilityId !== undefined) updatePayload.facility_id = input.facilityId;
  if (input.scheduledStart !== undefined) updatePayload.scheduled_start = input.scheduledStart;
  if (input.scheduledEnd !== undefined) updatePayload.scheduled_end = input.scheduledEnd;
  if (input.scorerUserId !== undefined) updatePayload.scorer_user_id = input.scorerUserId;
  if (input.metadata !== undefined) updatePayload.metadata = { ...match.metadata, ...input.metadata };

  const { data: updatedMatch, error: updateError } = await supabase
    .from('matches')
    .update(updatePayload)
    .eq('id', matchId)
    .select('*')
    .single();

  if (updateError || !updatedMatch) {
    throw new MatchServiceError(`Failed to update match: ${updateError?.message}`, 400, 'MATCH_UPDATE_FAILED');
  }

  await logMatchAudit(supabase, {
    action: 'MATCH_UPDATED',
    entityType: 'MATCH',
    entityId: matchId,
    organizationId: updatedMatch.organization_id || undefined,
    actorUserId: userCtx.userId,
    beforeData: match,
    afterData: updatedMatch,
  });

  return { success: true, match: updatedMatch };
}

/**
 * Deletes a match (strictly allowed in DRAFT status only).
 */
export async function deleteMatch(
  supabase: SupabaseClient<any, any, any>,
  matchId: string,
  userCtx: UserContext
) {
  if (!userCtx?.userId) {
    throw new MatchServiceError('Authentication required', 401, 'UNAUTHORIZED');
  }

  const { data: match, error: fetchError } = await supabase
    .from('matches')
    .select('*')
    .eq('id', matchId)
    .single();

  if (fetchError || !match) {
    throw new MatchServiceError('Match not found', 404, 'MATCH_NOT_FOUND');
  }

  if (match.status !== 'DRAFT') {
    throw new MatchServiceError('Only DRAFT matches can be deleted. Cancel operational matches instead.', 400, 'NOT_DRAFT');
  }

  const isCreator = match.created_by === userCtx.userId;
  const isSuper = await checkSuperAdmin(supabase, userCtx.userId);
  let canManageOrg = false;
  if (match.organization_id) {
    canManageOrg = await canManageOrganization(supabase, userCtx.userId, match.organization_id);
  }

  if (!isCreator && !canManageOrg && !isSuper) {
    throw new MatchServiceError('You do not have permission to delete this match', 403, 'FORBIDDEN');
  }

  const { error: delError } = await supabase
    .from('matches')
    .delete()
    .eq('id', matchId);

  if (delError) {
    throw new MatchServiceError(`Failed to delete match: ${delError.message}`, 400, 'DELETE_FAILED');
  }

  return { success: true };
}

/**
 * Adds a competitor (SIDE_A or SIDE_B) to a match.
 */
export async function addCompetitor(
  supabase: SupabaseClient<any, any, any>,
  matchId: string,
  input: CreateCompetitorSchema,
  userCtx: UserContext
) {
  if (!userCtx?.userId) {
    throw new MatchServiceError('Authentication required', 401, 'UNAUTHORIZED');
  }

  const { data: match, error: mErr } = await supabase
    .from('matches')
    .select('id, organization_id, sport_id, match_format, status, created_by')
    .eq('id', matchId)
    .single();

  if (mErr || !match) {
    throw new MatchServiceError('Match not found', 404, 'MATCH_NOT_FOUND');
  }

  if (['COMPLETED', 'CANCELLED', 'ABANDONED', 'LIVE'].includes(match.status)) {
    throw new MatchServiceError(`Cannot add competitors when match is in ${match.status} status`, 400, 'LOCKED_STATUS');
  }

  // Team validation
  if (input.teamId) {
    if (match.match_format !== 'TEAM') {
      throw new MatchServiceError(`Cannot attach a team to a ${match.match_format} format match`, 400, 'FORMAT_TEAM_MISMATCH');
    }

    const { data: team, error: tErr } = await supabase
      .from('teams')
      .select('id, name, sport_id, organization_id, is_active')
      .eq('id', input.teamId)
      .single();

    if (tErr || !team || !team.is_active) {
      throw new MatchServiceError('Team not found or inactive', 400, 'TEAM_NOT_FOUND');
    }

    if (team.sport_id !== match.sport_id) {
      throw new MatchServiceError('Team sport does not match match sport', 400, 'TEAM_SPORT_MISMATCH');
    }

    if (!match.organization_id && team.organization_id) {
      throw new MatchServiceError('Organization-private teams cannot be used in global matches', 400, 'PRIVATE_TEAM_GLOBAL_MATCH');
    }

    if (match.organization_id && team.organization_id && team.organization_id !== match.organization_id) {
      throw new MatchServiceError('Cannot use a team belonging to a different organization', 400, 'CROSS_TENANT_TEAM');
    }
  }

  const { data: competitor, error: cErr } = await supabase
    .from('match_competitors')
    .insert({
      match_id: matchId,
      side: input.side,
      team_id: input.teamId || null,
      competitor_name: input.competitorName.trim(),
    })
    .select('*')
    .single();

  if (cErr || !competitor) {
    throw new MatchServiceError(`Failed to add competitor: ${cErr?.message}`, 400, 'COMPETITOR_INSERT_FAILED');
  }

  await logMatchAudit(supabase, {
    action: 'COMPETITOR_ADDED',
    entityType: 'MATCH_COMPETITOR',
    entityId: competitor.id,
    organizationId: match.organization_id || undefined,
    actorUserId: userCtx.userId,
    metadata: { match_id: matchId, side: input.side, competitor_name: input.competitorName },
  });

  return { success: true, competitor };
}

/**
 * Updates a competitor's name or team.
 */
export async function updateCompetitor(
  supabase: SupabaseClient<any, any, any>,
  matchId: string,
  competitorId: string,
  input: UpdateCompetitorSchema,
  userCtx: UserContext
) {
  if (!userCtx?.userId) {
    throw new MatchServiceError('Authentication required', 401, 'UNAUTHORIZED');
  }

  const { data: competitor, error: cErr } = await supabase
    .from('match_competitors')
    .select('*, matches!inner(id, organization_id, status)')
    .eq('id', competitorId)
    .eq('match_id', matchId)
    .single();

  if (cErr || !competitor) {
    throw new MatchServiceError('Competitor not found', 404, 'COMPETITOR_NOT_FOUND');
  }

  const updateData: Record<string, any> = {};
  if (input.competitorName !== undefined) updateData.competitor_name = input.competitorName.trim();
  if (input.teamId !== undefined) updateData.team_id = input.teamId;

  const { data: updated, error: uErr } = await supabase
    .from('match_competitors')
    .update(updateData)
    .eq('id', competitorId)
    .select('*')
    .single();

  if (uErr || !updated) {
    throw new MatchServiceError(`Failed to update competitor: ${uErr?.message}`, 400, 'UPDATE_FAILED');
  }

  await logMatchAudit(supabase, {
    action: 'COMPETITOR_UPDATED',
    entityType: 'MATCH_COMPETITOR',
    entityId: competitorId,
    actorUserId: userCtx.userId,
    metadata: { match_id: matchId, ...updateData },
  });

  return { success: true, competitor: updated };
}

/**
 * Removes a competitor.
 */
export async function removeCompetitor(
  supabase: SupabaseClient<any, any, any>,
  matchId: string,
  competitorId: string,
  userCtx: UserContext
) {
  if (!userCtx?.userId) {
    throw new MatchServiceError('Authentication required', 401, 'UNAUTHORIZED');
  }

  const { data: match } = await supabase.from('matches').select('status, organization_id').eq('id', matchId).single();
  if (match && ['LIVE', 'COMPLETED', 'ABANDONED'].includes(match.status)) {
    throw new MatchServiceError('Cannot remove competitor from an active or completed match', 400, 'LOCKED_STATUS');
  }

  const { error: dErr } = await supabase
    .from('match_competitors')
    .delete()
    .eq('id', competitorId)
    .eq('match_id', matchId);

  if (dErr) {
    throw new MatchServiceError(`Failed to remove competitor: ${dErr.message}`, 400, 'DELETE_FAILED');
  }

  await logMatchAudit(supabase, {
    action: 'COMPETITOR_REMOVED',
    entityType: 'MATCH_COMPETITOR',
    entityId: competitorId,
    organizationId: match?.organization_id || undefined,
    actorUserId: userCtx.userId,
    metadata: { match_id: matchId },
  });

  return { success: true };
}

/**
 * Adds an individual participant to a competitor lineup.
 */
export async function addParticipant(
  supabase: SupabaseClient<any, any, any>,
  matchId: string,
  input: CreateParticipantSchema,
  userCtx: UserContext
) {
  if (!userCtx?.userId) {
    throw new MatchServiceError('Authentication required', 401, 'UNAUTHORIZED');
  }

  const { data: match, error: mErr } = await supabase
    .from('matches')
    .select('id, match_format, status, organization_id')
    .eq('id', matchId)
    .single();

  if (mErr || !match) {
    throw new MatchServiceError('Match not found', 404, 'MATCH_NOT_FOUND');
  }

  if (['LIVE', 'COMPLETED', 'ABANDONED'].includes(match.status)) {
    throw new MatchServiceError('Roster is locked for matches that are LIVE or COMPLETED', 400, 'ROSTER_LOCKED');
  }

  const { data: competitor, error: cErr } = await supabase
    .from('match_competitors')
    .select('id, team_id, side')
    .eq('id', input.competitorId)
    .eq('match_id', matchId)
    .single();

  if (cErr || !competitor) {
    throw new MatchServiceError('Competitor does not belong to this match', 400, 'COMPETITOR_NOT_FOUND');
  }

  // If competitor has a team, and userId is specified: verify team membership
  if (competitor.team_id && input.userId) {
    const { data: membership } = await supabase
      .from('team_members')
      .select('id, role')
      .eq('team_id', competitor.team_id)
      .eq('user_id', input.userId)
      .maybeSingle();

    if (!membership) {
      throw new MatchServiceError('User is not a member of the competitor team', 400, 'NOT_TEAM_MEMBER');
    }
  }

  // Snapshot display name from profile if userId provided and not custom
  let finalDisplayName = input.displayName ? input.displayName.trim() : '';
  if (input.userId && (!finalDisplayName || finalDisplayName === '')) {
    const { data: profile } = await supabase
      .from('profiles')
      .select('full_name')
      .eq('id', input.userId)
      .single();
    if (profile?.full_name) {
      finalDisplayName = profile.full_name;
    }
  }

  if (!finalDisplayName) {
    finalDisplayName = 'Player';
  }

  const { data: participant, error: pErr } = await supabase
    .from('match_participants')
    .insert({
      match_id: matchId,
      competitor_id: input.competitorId,
      user_id: input.userId || null,
      display_name: finalDisplayName,
      team_id: competitor.team_id || input.teamId || null,
      role: input.role || 'PLAYER',
      jersey_number: input.jerseyNumber !== undefined ? input.jerseyNumber : null,
      status: input.status || 'CONFIRMED',
    })
    .select('*')
    .single();

  if (pErr || !participant) {
    if (pErr?.message?.includes('idx_match_participants_unique_user')) {
      throw new MatchServiceError('This user is already a participant in this match', 400, 'DUPLICATE_PARTICIPANT');
    }
    throw new MatchServiceError(`Failed to add participant: ${pErr?.message}`, 400, 'PARTICIPANT_INSERT_FAILED');
  }

  await logMatchAudit(supabase, {
    action: 'PARTICIPANT_ADDED',
    entityType: 'MATCH_PARTICIPANT',
    entityId: participant.id,
    organizationId: match.organization_id || undefined,
    actorUserId: userCtx.userId,
    metadata: { match_id: matchId, competitor_id: input.competitorId, display_name: finalDisplayName },
  });

  return { success: true, participant };
}

/**
 * Updates an individual participant's details.
 */
export async function updateParticipant(
  supabase: SupabaseClient<any, any, any>,
  matchId: string,
  participantId: string,
  input: UpdateParticipantSchema,
  userCtx: UserContext
) {
  if (!userCtx?.userId) {
    throw new MatchServiceError('Authentication required', 401, 'UNAUTHORIZED');
  }

  const updateData: Record<string, any> = {};
  if (input.displayName !== undefined) updateData.display_name = input.displayName.trim();
  if (input.role !== undefined) updateData.role = input.role;
  if (input.jerseyNumber !== undefined) updateData.jersey_number = input.jerseyNumber;
  if (input.status !== undefined) updateData.status = input.status;

  const { data: participant, error: pErr } = await supabase
    .from('match_participants')
    .update(updateData)
    .eq('id', participantId)
    .eq('match_id', matchId)
    .select('*')
    .single();

  if (pErr || !participant) {
    throw new MatchServiceError(`Failed to update participant: ${pErr?.message}`, 400, 'UPDATE_FAILED');
  }

  await logMatchAudit(supabase, {
    action: 'PARTICIPANT_UPDATED',
    entityType: 'MATCH_PARTICIPANT',
    entityId: participantId,
    actorUserId: userCtx.userId,
    metadata: { match_id: matchId, ...updateData },
  });

  return { success: true, participant };
}

/**
 * Removes a participant from a match lineup.
 */
export async function removeParticipant(
  supabase: SupabaseClient<any, any, any>,
  matchId: string,
  participantId: string,
  userCtx: UserContext
) {
  if (!userCtx?.userId) {
    throw new MatchServiceError('Authentication required', 401, 'UNAUTHORIZED');
  }

  const { data: match } = await supabase.from('matches').select('status, organization_id').eq('id', matchId).single();
  if (match && ['LIVE', 'COMPLETED', 'ABANDONED'].includes(match.status)) {
    throw new MatchServiceError('Roster is locked for LIVE or COMPLETED matches', 400, 'ROSTER_LOCKED');
  }

  const { error: dErr } = await supabase
    .from('match_participants')
    .delete()
    .eq('id', participantId)
    .eq('match_id', matchId);

  if (dErr) {
    throw new MatchServiceError(`Failed to remove participant: ${dErr.message}`, 400, 'DELETE_FAILED');
  }

  await logMatchAudit(supabase, {
    action: 'PARTICIPANT_REMOVED',
    entityType: 'MATCH_PARTICIPANT',
    entityId: participantId,
    organizationId: match?.organization_id || undefined,
    actorUserId: userCtx.userId,
    metadata: { match_id: matchId },
  });

  return { success: true };
}

/**
 * Transitions a match through its lifecycle with rigorous state-machine and roster checks.
 */
export async function transitionMatchStatus(
  supabase: SupabaseClient<any, any, any>,
  matchId: string,
  input: TransitionMatchStatusSchema,
  userCtx: UserContext
) {
  if (!userCtx?.userId) {
    throw new MatchServiceError('Authentication required', 401, 'UNAUTHORIZED');
  }

  const { data: match, error: mErr } = await supabase
    .from('matches')
    .select('*')
    .eq('id', matchId)
    .single();

  if (mErr || !match) {
    throw new MatchServiceError('Match not found', 404, 'MATCH_NOT_FOUND');
  }

  const currentStatus = match.status as MatchStatus;
  const targetStatus = input.status as MatchStatus;

  if (currentStatus === targetStatus) {
    return { success: true, match };
  }

  // 1. Terminal state check
  if (['COMPLETED', 'CANCELLED', 'ABANDONED'].includes(currentStatus)) {
    throw new MatchServiceError(`Cannot transition match from terminal status: ${currentStatus}`, 409, 'TERMINAL_STATE');
  }

  // 2. Validate state machine transition
  const validTransitions: Record<MatchStatus, MatchStatus[]> = {
    DRAFT: ['SCHEDULED', 'CANCELLED'],
    SCHEDULED: ['WARMUP', 'LIVE', 'CANCELLED'],
    WARMUP: ['LIVE', 'CANCELLED'],
    LIVE: ['PAUSED', 'COMPLETED', 'ABANDONED'],
    PAUSED: ['LIVE', 'COMPLETED', 'ABANDONED'],
    COMPLETED: [],
    CANCELLED: [],
    ABANDONED: [],
  };

  if (!validTransitions[currentStatus]?.includes(targetStatus)) {
    throw new MatchServiceError(
      `Invalid match status transition from ${currentStatus} to ${targetStatus}`,
      409,
      'INVALID_TRANSITION'
    );
  }

  // 3. Authorization check based on target transition
  const isSuper = await checkSuperAdmin(supabase, userCtx.userId);
  const isCreator = match.created_by === userCtx.userId;
  const isAssignedScorer = match.scorer_user_id === userCtx.userId;
  let canManageOrg = false;
  if (match.organization_id) {
    canManageOrg = await canManageOrganization(supabase, userCtx.userId, match.organization_id);
  }

  if (targetStatus === 'SCHEDULED' || targetStatus === 'CANCELLED') {
    if (!isCreator && !canManageOrg && !isSuper) {
      throw new MatchServiceError('You do not have permission to perform this transition', 403, 'FORBIDDEN');
    }
  } else if (['WARMUP', 'LIVE', 'PAUSED', 'COMPLETED', 'ABANDONED'].includes(targetStatus)) {
    if (!isAssignedScorer && !canManageOrg && !isSuper && !isCreator) {
      throw new MatchServiceError('Scorer or manager authority required for this transition', 403, 'SCORER_UNAUTHORIZED');
    }
  }

  // 4. Pre-transition business validation
  if (targetStatus === 'SCHEDULED') {
    if (!match.scheduled_start || !match.scheduled_end) {
      throw new MatchServiceError('scheduled_start and scheduled_end are required before scheduling', 400, 'SCHEDULE_REQUIRED');
    }
    const start = new Date(match.scheduled_start).getTime();
    const end = new Date(match.scheduled_end).getTime();
    if (end <= start) {
      throw new MatchServiceError('scheduled_end must be after scheduled_start', 400, 'INVALID_TIME_RANGE');
    }
    const durationMin = (end - start) / (1000 * 60);
    if (durationMin < 15 || durationMin > 720) {
      throw new MatchServiceError('Match duration must be between 15 minutes and 720 minutes', 400, 'INVALID_DURATION');
    }

    // Verify both competitors exist
    const { data: competitors } = await supabase
      .from('match_competitors')
      .select('id, side, team_id')
      .eq('match_id', matchId);

    const compA = competitors?.find(c => c.side === 'SIDE_A');
    const compB = competitors?.find(c => c.side === 'SIDE_B');

    if (!compA || !compB) {
      throw new MatchServiceError('Cannot transition match to SCHEDULED: both SIDE_A and SIDE_B must be configured.', 400, 'COMPETITORS_REQUIRED');
    }

    // Check participants by side
    const { data: participants } = await supabase
      .from('match_participants')
      .select('id, competitor_id')
      .eq('match_id', matchId);

    const countA = participants?.filter(p => p.competitor_id === compA.id).length || 0;
    const countB = participants?.filter(p => p.competitor_id === compB.id).length || 0;

    if (match.match_format === 'SINGLES') {
      if (countA !== 1 || countB !== 1) {
        throw new MatchServiceError(`SINGLES format requires exactly 1 participant on each side (Found Side A: ${countA}, Side B: ${countB}).`, 400, 'FORMAT_REQUIREMENT_UNMET');
      }
    } else if (match.match_format === 'DOUBLES') {
      if (countA !== 2 || countB !== 2) {
        throw new MatchServiceError(`DOUBLES format requires exactly 2 participants on each side (Found Side A: ${countA}, Side B: ${countB}).`, 400, 'FORMAT_REQUIREMENT_UNMET');
      }
    } else if (match.match_format === 'TEAM') {
      if (!compA.team_id || !compB.team_id) {
        throw new MatchServiceError('TEAM format requires a team assigned to both competitors.', 400, 'TEAM_REQUIRED');
      }
      if (countA < 1 || countB < 1) {
        throw new MatchServiceError('TEAM format requires at least 1 participant on each side.', 400, 'FORMAT_REQUIREMENT_UNMET');
      }
    }
  }

  const updatePayload: Record<string, any> = {
    status: targetStatus,
  };

  if (targetStatus === 'COMPLETED') {
    if (!input.winnerSide) {
      throw new MatchServiceError('winnerSide (SIDE_A, SIDE_B, DRAW, NO_RESULT) is required to complete a match', 400, 'WINNER_REQUIRED');
    }
    updatePayload.winner_side = input.winnerSide;
    if (input.resultSummary) {
      updatePayload.result_summary = input.resultSummary.trim();
    }
  }

  if (targetStatus === 'CANCELLED' || targetStatus === 'ABANDONED') {
    if (input.reason) {
      updatePayload.metadata = {
        ...match.metadata,
        cancellation_reason: input.reason.trim(),
      };
    }
  }

  const { data: updatedMatch, error: uErr } = await supabase
    .from('matches')
    .update(updatePayload)
    .eq('id', matchId)
    .select('*')
    .single();

  if (uErr || !updatedMatch) {
    throw new MatchServiceError(`Status transition failed: ${uErr?.message}`, 400, 'TRANSITION_FAILED');
  }

  // Audit event mapping
  const auditActionMap: Record<string, string> = {
    SCHEDULED: 'MATCH_SCHEDULED',
    WARMUP: 'MATCH_WARMUP',
    LIVE: currentStatus === 'PAUSED' ? 'MATCH_RESUMED' : 'MATCH_STARTED',
    PAUSED: 'MATCH_PAUSED',
    COMPLETED: 'MATCH_COMPLETED',
    CANCELLED: 'MATCH_CANCELLED',
    ABANDONED: 'MATCH_ABANDONED',
  };

  const action = auditActionMap[targetStatus] || 'MATCH_UPDATED';

  await logMatchAudit(supabase, {
    action,
    entityType: 'MATCH',
    entityId: matchId,
    organizationId: updatedMatch.organization_id || undefined,
    actorUserId: userCtx.userId,
    beforeData: { status: currentStatus },
    afterData: { status: targetStatus, ...updatePayload },
  });

  return { success: true, match: updatedMatch };
}
