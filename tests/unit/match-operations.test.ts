import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { createClient, SupabaseClient } from '@supabase/supabase-js';
import {
  createMatch,
  updateMatch,
  deleteMatch,
  addCompetitor,
  updateCompetitor,
  removeCompetitor,
  addParticipant,
  updateParticipant,
  removeParticipant,
  transitionMatchStatus,
  MatchServiceError,
} from '../../apps/web/src/lib/matches/operations';
import { getMatchWithDetails, listMatches } from '../../apps/web/src/lib/matches/queries';

const SUPABASE_URL = 'http://127.0.0.1:54321';
const SERVICE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZS1kZW1vIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImV4cCI6MTk4MzgxMjk5Nn0.EGIM96RAZx35lJzdJsyH-qQwv8Hdp7fsn3W0YpN81IU';

describe('STEP 15C — Match Service Layer & Operations Unit Tests', () => {
  let supabase: SupabaseClient;

  let cricketSportId: string;
  let badmintonSportId: string;
  let demoOrgId: string;
  let otherOrgId: string;
  let demoVenueId: string;
  let badmintonFac1Id: string;
  let cricketFacId: string;

  let userAdmin: { userId: string; email: string };
  let userOrgOwner: { userId: string; email: string };
  let userCustomer1: { userId: string; email: string };
  let userCustomer2: { userId: string; email: string };
  let userOtherOrg: { userId: string; email: string };

  let orgTeamId: string;
  let globalTeamId: string;
  let otherOrgTeamId: string;

  beforeAll(async () => {
    supabase = createClient(SUPABASE_URL, SERVICE_KEY);

    // Fetch Sports
    const { data: sports } = await supabase.from('sports').select('id, slug');
    cricketSportId = sports?.find((s) => s.slug === 'cricket')?.id!;
    badmintonSportId = sports?.find((s) => s.slug === 'badminton')?.id!;

    // Fetch Demo Organization & Venue
    const { data: orgs } = await supabase.from('organizations').select('id, slug');
    demoOrgId = orgs?.find((o) => o.slug === 'demo-sports-group')?.id!;

    // Create a secondary org for cross-tenant tests
    const { data: secondaryOrg } = await supabase
      .from('organizations')
      .insert({
        name: 'Secondary Match Org',
        slug: 'secondary-match-org-' + Date.now(),
        status: 'ACTIVE',
        currency: 'LKR',
        timezone: 'Asia/Colombo',
      })
      .select('id')
      .single();
    otherOrgId = secondaryOrg?.id!;

    // Fetch Demo Venue & Facilities
    const { data: venues } = await supabase.from('venues').select('id').eq('organization_id', demoOrgId);
    demoVenueId = venues?.[0]?.id!;

    const { data: facs } = await supabase.from('facilities').select('id, sport_id, name');
    badmintonFac1Id = facs?.find((f) => f.name.includes('Badminton Court 01'))?.id!;
    cricketFacId = facs?.find((f) => f.name.includes('Cricket Turf 01'))?.id!;

    // Users from seeded profiles
    userCustomer1 = { userId: '11111111-1111-1111-1111-111111111111', email: 'customerA@test.com' };
    userCustomer2 = { userId: '22222222-2222-2222-2222-222222222222', email: 'customerB@test.com' };
    userOrgOwner = { userId: '33333333-3333-3333-3333-333333333333', email: 'ownerA@test.com' };
    userOtherOrg = { userId: '66666666-6666-6666-6666-666666666666', email: 'otherorg@test.com' };
    userAdmin = { userId: '55555555-5555-5555-5555-555555555555', email: 'receptionistA@test.com' };

    // Setup memberships
    await supabase.from('organization_members').upsert([
      { organization_id: demoOrgId, user_id: userOrgOwner.userId, role: 'OWNER', status: 'ACTIVE' },
      { organization_id: otherOrgId, user_id: userOtherOrg.userId, role: 'OWNER', status: 'ACTIVE' },
    ]);

    // Setup teams
    const { data: t1 } = await supabase
      .from('teams')
      .insert({
        name: 'Org Demo Cricket Team',
        sport_id: cricketSportId,
        organization_id: demoOrgId,
        created_by: userOrgOwner.userId,
      })
      .select('id')
      .single();
    orgTeamId = t1?.id!;

    const { data: t2 } = await supabase
      .from('teams')
      .insert({
        name: 'Global Open Cricket Team',
        sport_id: cricketSportId,
        organization_id: null,
        created_by: userCustomer1.userId,
      })
      .select('id')
      .single();
    globalTeamId = t2?.id!;

    const { data: t3 } = await supabase
      .from('teams')
      .insert({
        name: 'Other Org Team',
        sport_id: cricketSportId,
        organization_id: otherOrgId,
        created_by: userOtherOrg.userId,
      })
      .select('id')
      .single();
    otherOrgTeamId = t3?.id!;

    // Assign team memberships
    await supabase.from('team_members').upsert([
      { team_id: orgTeamId, user_id: userCustomer1.userId, role: 'PLAYER' },
      { team_id: globalTeamId, user_id: userCustomer1.userId, role: 'CAPTAIN' },
      { team_id: globalTeamId, user_id: userCustomer2.userId, role: 'PLAYER' },
      { team_id: otherOrgTeamId, user_id: userOtherOrg.userId, role: 'CAPTAIN' },
    ]);
    // Cleanup any lingering test bookings
    await supabase.from('bookings').delete().like('booking_reference', 'SPH-MTH-TEST%');
  }, 30000);

  afterAll(async () => {
    await supabase.from('bookings').delete().like('booking_reference', 'SPH-MTH-TEST%');
    if (orgTeamId) await supabase.from('teams').delete().eq('id', orgTeamId);
    if (globalTeamId) await supabase.from('teams').delete().eq('id', globalTeamId);
    if (otherOrgTeamId) await supabase.from('teams').delete().eq('id', otherOrgTeamId);
    if (otherOrgId) await supabase.from('organizations').delete().eq('id', otherOrgId);
  }, 30000);

  // 1. MATCH CREATION
  describe('1. Match Creation & Identity', () => {
    it('creates a global casual match with server-generated reference and creator', async () => {
      const result = await createMatch(
        supabase,
        {
          title: 'Sunday Morning Singles',
          sportId: badmintonSportId,
          matchType: 'CASUAL',
          matchFormat: 'SINGLES', metadata: {},
        },
        userCustomer1
      );

      expect(result.success).toBe(true);
      expect(result.match.created_by).toBe(userCustomer1.userId);
      expect(result.match.organization_id).toBeNull();
      expect(result.match.status).toBe('DRAFT');
      expect(result.match.match_reference).toMatch(/^MTH-\d{8}-[A-Z0-9]{6}$/);

      // Cleanup
      await supabase.from('matches').delete().eq('id', result.match.id);
    });

    it('rejects unauthenticated match creation', async () => {
      await expect(
        createMatch(
          supabase,
          {
            sportId: badmintonSportId,
            matchType: 'CASUAL',
            matchFormat: 'SINGLES', metadata: {},
          },
          { userId: '' }
        )
      ).rejects.toThrow('Authentication required');
    });

    it('rejects cross-tenant organization match creation by non-members', async () => {
      await expect(
        createMatch(
          supabase,
          {
            sportId: badmintonSportId,
            organizationId: demoOrgId,
            matchType: 'CASUAL',
            matchFormat: 'SINGLES', metadata: {},
          },
          userOtherOrg // member of otherOrgId, not demoOrgId
        )
      ).rejects.toThrow('not an active member');
    });
  });

  // 2. BOOKING INTEGRATION
  describe('2. Booking Integration & Derivation', () => {
    it('derives authoritative sport, org, venue, and facility from an attached booking', async () => {
      const ref = 'SPH-MTH-TEST-BKG-' + Math.floor(Math.random() * 1000000);
      const randomDay = 10 + Math.floor(Math.random() * 15);
      const bDate = `2026-11-${randomDay}`;
      const range = `[${bDate} 14:00:00+05:30, ${bDate} 15:00:00+05:30)`;

      const { data: booking, error: bErr } = await supabase
        .from('bookings')
        .insert({
          booking_reference: ref,
          customer_user_id: userCustomer1.userId,
          organization_id: demoOrgId,
          venue_id: demoVenueId,
          facility_id: badmintonFac1Id,
          sport_id: badmintonSportId,
          booking_date: bDate,
          start_time: '14:00:00',
          end_time: '15:00:00',
          duration_minutes: 60,
          protected_time_range: range,
          status: 'CONFIRMED',
          price_snapshot: { price: 2000 },
        })
        .select('id')
        .single();

      if (bErr || !booking) {
        throw new Error(`Failed to create test booking: ${bErr?.message}`);
      }

      // Create match linking booking without specifying sport/venue/facility
      const result = await createMatch(
        supabase,
        {
          bookingId: booking.id,
          matchType: 'COMPETITIVE',
          matchFormat: 'SINGLES', metadata: {},
        },
        userCustomer1
      );

      expect(result.success).toBe(true);
      expect(result.match.booking_id).toBe(booking.id);
      expect(result.match.organization_id).toBe(demoOrgId);
      expect(result.match.venue_id).toBe(demoVenueId);
      expect(result.match.facility_id).toBe(badmintonFac1Id);
      expect(result.match.sport_id).toBe(badmintonSportId);

      // Cleanup
      await supabase.from('matches').delete().eq('id', result.match.id);
      await supabase.from('bookings').delete().eq('id', booking.id);
    });

    it('rejects attaching another customer booking without org management authority', async () => {
      const ref = 'SPH-MTH-TEST-BKG2-' + Math.floor(Math.random() * 1000000);
      const randomDay = 10 + Math.floor(Math.random() * 15);
      const bDate = `2026-11-${randomDay}`;
      const range = `[${bDate} 16:00:00+05:30, ${bDate} 17:00:00+05:30)`;

      const { data: booking, error: bErr } = await supabase
        .from('bookings')
        .insert({
          booking_reference: ref,
          customer_user_id: userCustomer1.userId, // belongs to userCustomer1
          organization_id: demoOrgId,
          venue_id: demoVenueId,
          facility_id: badmintonFac1Id,
          sport_id: badmintonSportId,
          booking_date: bDate,
          start_time: '16:00:00',
          end_time: '17:00:00',
          duration_minutes: 60,
          protected_time_range: range,
          status: 'CONFIRMED',
          price_snapshot: { price: 2000 },
        })
        .select('id')
        .single();

      if (bErr || !booking) {
        throw new Error(`Failed to create test booking: ${bErr?.message}`);
      }

      // userCustomer2 attempts to attach userCustomer1's booking
      await expect(
        createMatch(
          supabase,
          {
            bookingId: booking.id,
            matchType: 'COMPETITIVE',
            matchFormat: 'SINGLES', metadata: {},
          },
          userCustomer2
        )
      ).rejects.toThrow('You do not have permission to attach this booking');

      await supabase.from('bookings').delete().eq('id', booking.id);
    });
  });

  // 3. COMPETITOR & TEAM VALIDATION
  describe('3. Competitors & Teams Validation', () => {
    it('allows global team in global match, but rejects cross-organization team', async () => {
      const { match } = await createMatch(
        supabase,
        {
          title: 'Cricket Club Friendly',
          sportId: cricketSportId,
          matchType: 'COMPETITIVE',
          matchFormat: 'TEAM', metadata: {},
        },
        userCustomer1
      );

      // Add Global Team (allowed)
      const c1 = await addCompetitor(
        supabase,
        match.id,
        {
          side: 'SIDE_A',
          teamId: globalTeamId,
          competitorName: 'Global Team A',
        },
        userCustomer1
      );
      expect(c1.success).toBe(true);

      // Attempt to add Org Private Team to Global Match (must fail)
      await expect(
        addCompetitor(
          supabase,
          match.id,
          {
            side: 'SIDE_B',
            teamId: orgTeamId,
            competitorName: 'Org Private Team',
          },
          userCustomer1
        )
      ).rejects.toThrow('Organization-private teams cannot be used in global matches');

      // Cleanup
      await supabase.from('matches').delete().eq('id', match.id);
    });
  });

  // 4. PARTICIPANT MEMBERSHIP & UNIQUENESS
  describe('4. Participant Validation & Uniqueness', () => {
    it('verifies team membership when adding player and blocks duplicate participant across sides', async () => {
      const { match } = await createMatch(
        supabase,
        {
          title: 'Cricket Team Match',
          sportId: cricketSportId,
          organizationId: demoOrgId,
          matchType: 'COMPETITIVE',
          matchFormat: 'TEAM', metadata: {},
        },
        userOrgOwner
      );

      const { competitor: sideA } = await addCompetitor(
        supabase,
        match.id,
        { side: 'SIDE_A', teamId: orgTeamId, competitorName: 'Demo Org Team' },
        userOrgOwner
      );

      const { competitor: sideB } = await addCompetitor(
        supabase,
        match.id,
        { side: 'SIDE_B', teamId: globalTeamId, competitorName: 'Global Team' },
        userOrgOwner
      );

      // userCustomer1 is in orgTeamId -> Allowed
      const p1 = await addParticipant(
        supabase,
        match.id,
        {
          competitorId: sideA.id,
          userId: userCustomer1.userId,
          displayName: 'Player One',
          role: 'PLAYER',
        },
        userOrgOwner
      );
      expect(p1.success).toBe(true);

      // userOtherOrg is NOT in orgTeamId -> Rejected
      await expect(
        addParticipant(
          supabase,
          match.id,
          {
            competitorId: sideA.id,
            userId: userOtherOrg.userId,
            displayName: 'Imposter Player',
          },
          userOrgOwner
        )
      ).rejects.toThrow('User is not a member of the competitor team');

      // userCustomer1 already on SIDE_A -> Attempt to add to SIDE_B must fail (no dual-side play)
      await expect(
        addParticipant(
          supabase,
          match.id,
          {
            competitorId: sideB.id,
            userId: userCustomer1.userId,
            displayName: 'Player One Again',
          },
          userOrgOwner
        )
      ).rejects.toThrow('already a participant');

      // Cleanup
      await supabase.from('matches').delete().eq('id', match.id);
    });
  });

  // 5. LIFECYCLE STATE MACHINE & FORMAT ENFORCEMENT
  describe('5. Lifecycle State Machine & Format Enforcement', () => {
    it('enforces format requirements on transition from DRAFT to SCHEDULED, blocks premature LIVE, and protects terminal states', async () => {
      const start = new Date(Date.now() + 3600000).toISOString();
      const end = new Date(Date.now() + 7200000).toISOString();

      const { match } = await createMatch(
        supabase,
        {
          title: 'Badminton Singles Championship',
          sportId: badmintonSportId,
          matchType: 'COMPETITIVE',
          matchFormat: 'SINGLES', metadata: {},
          scheduledStart: start,
          scheduledEnd: end,
        },
        userCustomer1
      );

      // Cannot schedule with 0 competitors
      await expect(
        transitionMatchStatus(supabase, match.id, { status: 'SCHEDULED' }, userCustomer1)
      ).rejects.toThrow('both SIDE_A and SIDE_B must be configured');

      // Add Side A & Side B
      const { competitor: sideA } = await addCompetitor(
        supabase,
        match.id,
        { side: 'SIDE_A', competitorName: 'Player A' },
        userCustomer1
      );
      const { competitor: sideB } = await addCompetitor(
        supabase,
        match.id,
        { side: 'SIDE_B', competitorName: 'Player B' },
        userCustomer1
      );

      // Incomplete participants: 0 on each side (SINGLES requires 1 per side)
      await expect(
        transitionMatchStatus(supabase, match.id, { status: 'SCHEDULED' }, userCustomer1)
      ).rejects.toThrow('SINGLES format requires exactly 1 participant on each side');

      // Add participants
      await addParticipant(supabase, match.id, { competitorId: sideA.id, userId: userCustomer1.userId, displayName: 'Player A' }, userCustomer1);
      await addParticipant(supabase, match.id, { competitorId: sideB.id, userId: userCustomer2.userId, displayName: 'Player B' }, userCustomer1);

      // Now DRAFT -> SCHEDULED succeeds!
      const scheduledResult = await transitionMatchStatus(supabase, match.id, { status: 'SCHEDULED' }, userCustomer1);
      expect(scheduledResult.match.status).toBe('SCHEDULED');

      // SCHEDULED -> WARMUP succeeds
      const warmupResult = await transitionMatchStatus(supabase, match.id, { status: 'WARMUP' }, userCustomer1);
      expect(warmupResult.match.status).toBe('WARMUP');

      // WARMUP -> LIVE sets server actual_start
      const liveResult = await transitionMatchStatus(supabase, match.id, { status: 'LIVE' }, userCustomer1);
      expect(liveResult.match.status).toBe('LIVE');
      expect(liveResult.match.actual_start).toBeDefined();

      // LIVE -> PAUSED
      const pausedResult = await transitionMatchStatus(supabase, match.id, { status: 'PAUSED' }, userCustomer1);
      expect(pausedResult.match.status).toBe('PAUSED');

      // PAUSED -> LIVE (resume)
      const resumedResult = await transitionMatchStatus(supabase, match.id, { status: 'LIVE' }, userCustomer1);
      expect(resumedResult.match.status).toBe('LIVE');

      // LIVE -> COMPLETED requires winnerSide
      await expect(
        transitionMatchStatus(supabase, match.id, { status: 'COMPLETED' }, userCustomer1)
      ).rejects.toThrow('winnerSide');

      // Complete with winner
      const completedResult = await transitionMatchStatus(
        supabase,
        match.id,
        {
          status: 'COMPLETED',
          winnerSide: 'SIDE_A',
          resultSummary: 'Player A won 21-18, 21-16',
        },
        userCustomer1
      );
      expect(completedResult.match.status).toBe('COMPLETED');
      expect(completedResult.match.winner_side).toBe('SIDE_A');
      expect(completedResult.match.actual_end).toBeDefined();

      // Terminal state protection: COMPLETED cannot transition to anything
      await expect(
        transitionMatchStatus(supabase, match.id, { status: 'LIVE' }, userCustomer1)
      ).rejects.toThrow('terminal status');

      // Cleanup
      await supabase.from('matches').delete().eq('id', match.id);
    });
  });

  // 6. QUERY & DETAILS
  describe('6. Match Queries & Aggregation', () => {
    it('retrieves match with full details including competitors, participants, sport, and venue', async () => {
      const { match } = await createMatch(
        supabase,
        {
          title: 'Full Details Test Match',
          sportId: badmintonSportId,
          matchType: 'CASUAL',
          matchFormat: 'SINGLES', metadata: {},
        },
        userCustomer1
      );

      const { competitor: sideA } = await addCompetitor(
        supabase,
        match.id,
        { side: 'SIDE_A', competitorName: 'Competitor 1' },
        userCustomer1
      );

      await addParticipant(
        supabase,
        match.id,
        {
          competitorId: sideA.id,
          userId: userCustomer1.userId,
          displayName: 'Player One',
        },
        userCustomer1
      );

      const details = await getMatchWithDetails(supabase, match.id);
      expect(details).toBeDefined();
      expect(details?.id).toBe(match.id);
      expect(details?.sport?.name).toBe('Badminton');
      expect(details?.competitors.length).toBe(1);
      expect(details?.competitors[0].participants.length).toBe(1);
      expect(details?.competitors[0].participants[0].display_name).toBe('Player One');

      // Test listing
      const list = await listMatches(supabase, { sportId: badmintonSportId, limit: 10, page: 1 });
      expect(list.matches.some((m) => m.id === match.id)).toBe(true);

      // Cleanup
      await supabase.from('matches').delete().eq('id', match.id);
    });
  });
});
