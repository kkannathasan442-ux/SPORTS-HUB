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
import { getMatchWithDetails } from '../../apps/web/src/lib/matches/queries';

const SUPABASE_URL = 'http://127.0.0.1:54321';
const SERVICE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZS1kZW1vIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImV4cCI6MTk4MzgxMjk5Nn0.EGIM96RAZx35lJzdJsyH-qQwv8Hdp7fsn3W0YpN81IU';

describe('STEP 15C — Match Security, RBAC & Isolation Suite', () => {
  let supabase: SupabaseClient;

  let cricketSportId: string;
  let badmintonSportId: string;
  let demoOrgId: string;
  let otherOrgId: string;
  let demoVenueId: string;
  let badmintonFac1Id: string;
  let cricketFacId: string;

  // Real seeded users in local Supabase
  const userCustomerA = { userId: '11111111-1111-1111-1111-111111111111', email: 'customera@test.com' };
  const userCustomerB = { userId: '22222222-2222-2222-2222-222222222222', email: 'customerb@test.com' };
  const userOwnerA = { userId: '33333333-3333-3333-3333-333333333333', email: 'ownera@test.com' };
  const userManagerA = { userId: '44444444-4444-4444-4444-444444444444', email: 'managera@test.com' };
  const userReceptionistA = { userId: '55555555-5555-5555-5555-555555555555', email: 'receptionista@test.com' };
  const userCustomerOrgB = { userId: '66666666-6666-6666-6666-666666666666', email: 'customerorgb@test.com' };

  let orgATeamId: string;
  let orgBTeamId: string;
  let globalTeamId: string;

  beforeAll(async () => {
    supabase = createClient(SUPABASE_URL, SERVICE_KEY);

    // Fetch Sports
    const { data: sports } = await supabase.from('sports').select('id, slug');
    cricketSportId = sports?.find((s) => s.slug === 'cricket')?.id!;
    badmintonSportId = sports?.find((s) => s.slug === 'badminton')?.id!;

    // Fetch Demo Organization (Org A)
    const { data: orgs } = await supabase.from('organizations').select('id, slug');
    demoOrgId = orgs?.find((o) => o.slug === 'demo-sports-group')?.id!;

    // Create Secondary Org (Org B)
    const { data: secondaryOrg } = await supabase
      .from('organizations')
      .insert({
        name: 'Secondary Security Org',
        slug: 'sec-match-org-' + Date.now(),
        status: 'ACTIVE',
        currency: 'LKR',
        timezone: 'Asia/Colombo',
      })
      .select('id')
      .single();
    otherOrgId = secondaryOrg?.id!;

    // Fetch Venues & Facilities
    const { data: venues } = await supabase.from('venues').select('id').eq('organization_id', demoOrgId);
    demoVenueId = venues?.[0]?.id!;

    const { data: facs } = await supabase.from('facilities').select('id, sport_id, name');
    badmintonFac1Id = facs?.find((f) => f.name.includes('Badminton Court 01'))?.id!;
    cricketFacId = facs?.find((f) => f.name.includes('Cricket Turf 01'))?.id!;

    // Set up memberships
    await supabase.from('organization_members').upsert([
      { organization_id: demoOrgId, user_id: userOwnerA.userId, role: 'OWNER', status: 'ACTIVE' },
      { organization_id: demoOrgId, user_id: userManagerA.userId, role: 'MANAGER', status: 'ACTIVE' },
      { organization_id: demoOrgId, user_id: userReceptionistA.userId, role: 'RECEPTIONIST', status: 'ACTIVE' },
      { organization_id: otherOrgId, user_id: userCustomerOrgB.userId, role: 'OWNER', status: 'ACTIVE' },
    ], { onConflict: 'organization_id, user_id' });

    // Set up teams
    const { data: tA } = await supabase
      .from('teams')
      .insert({
        name: 'Org A Security Team',
        sport_id: cricketSportId,
        organization_id: demoOrgId,
        created_by: userOwnerA.userId,
      })
      .select('id')
      .single();
    orgATeamId = tA?.id!;

    const { data: tB } = await supabase
      .from('teams')
      .insert({
        name: 'Org B Security Team',
        sport_id: cricketSportId,
        organization_id: otherOrgId,
        created_by: userCustomerOrgB.userId,
      })
      .select('id')
      .single();
    orgBTeamId = tB?.id!;

    const { data: tGlobal } = await supabase
      .from('teams')
      .insert({
        name: 'Global Security Team',
        sport_id: cricketSportId,
        organization_id: null,
        created_by: userCustomerA.userId,
      })
      .select('id')
      .single();
    globalTeamId = tGlobal?.id!;

    // Add members to teams
    await supabase.from('team_members').upsert([
      { team_id: orgATeamId, user_id: userCustomerA.userId, role: 'PLAYER' },
      { team_id: orgBTeamId, user_id: userCustomerOrgB.userId, role: 'CAPTAIN' },
      { team_id: globalTeamId, user_id: userCustomerA.userId, role: 'CAPTAIN' },
      { team_id: globalTeamId, user_id: userCustomerB.userId, role: 'PLAYER' },
    ]);

    // Clean any previous test bookings
    await supabase.from('bookings').delete().like('booking_reference', 'SEC-MTH-%');
  }, 30000);

  afterAll(async () => {
    await supabase.from('bookings').delete().like('booking_reference', 'SEC-MTH-%');
    if (orgATeamId) await supabase.from('teams').delete().eq('id', orgATeamId);
    if (orgBTeamId) await supabase.from('teams').delete().eq('id', orgBTeamId);
    if (globalTeamId) await supabase.from('teams').delete().eq('id', globalTeamId);
    if (otherOrgId) await supabase.from('organizations').delete().eq('id', otherOrgId);
  }, 30000);

  // 1. AUTHENTICATION & IDENTITY TAMPERING
  describe('1. Authentication & Identity Protection', () => {
    it('blocks unauthenticated match operations with 401', async () => {
      await expect(
        createMatch(supabase, { sportId: badmintonSportId, matchType: 'CASUAL', matchFormat: 'SINGLES', metadata: {} }, { userId: '' })
      ).rejects.toMatchObject({ statusCode: 401, code: 'UNAUTHORIZED' });
    });

    it('always derives created_by server-side from authenticated context', async () => {
      const result = await createMatch(
        supabase,
        {
          title: 'Protected Creator Match',
          sportId: badmintonSportId,
          matchType: 'CASUAL',
          matchFormat: 'SINGLES', metadata: {},
        },
        userCustomerA
      );

      expect(result.match.created_by).toBe(userCustomerA.userId);
      // Clean up
      await supabase.from('matches').delete().eq('id', result.match.id);
    });

    it('generates server-side match reference in Asia/Colombo MTH-YYYYMMDD-XXXXXX format', async () => {
      const result = await createMatch(
        supabase,
        {
          title: 'Reference Format Match',
          sportId: badmintonSportId,
          matchType: 'CASUAL',
          matchFormat: 'SINGLES', metadata: {},
        },
        userCustomerA
      );

      expect(result.match.match_reference).toMatch(/^MTH-\d{8}-[A-Z0-9]{6}$/);
      // Clean up
      await supabase.from('matches').delete().eq('id', result.match.id);
    });
  });

  // 2. TENANT ISOLATION & CROSS-TENANT DEFENSE
  describe('2. Tenant Isolation & Cross-Tenant Defense', () => {
    it('blocks non-member from creating a match under an organization', async () => {
      await expect(
        createMatch(
          supabase,
          {
            organizationId: demoOrgId,
            sportId: badmintonSportId,
            matchType: 'COMPETITIVE',
            matchFormat: 'SINGLES', metadata: {},
          },
          userCustomerOrgB // belongs to Org B, not Org A
        )
      ).rejects.toMatchObject({ statusCode: 403, code: 'FORBIDDEN' });
    });

    it('rejects adding a private team from another organization to an organization match', async () => {
      const matchRes = await createMatch(
        supabase,
        {
          organizationId: demoOrgId,
          sportId: cricketSportId,
          matchType: 'COMPETITIVE',
          matchFormat: 'TEAM', metadata: {},
        },
        userOwnerA
      );

      // Attempt to add Org B's team to Org A's match
      await expect(
        addCompetitor(
          supabase,
          matchRes.match.id,
          {
            side: 'SIDE_A',
            competitorName: 'Team A',
            teamId: orgBTeamId,
          },
          userOwnerA
        )
      ).rejects.toMatchObject({ statusCode: 400, code: 'CROSS_TENANT_TEAM' });

      await supabase.from('matches').delete().eq('id', matchRes.match.id);
    });

    it('rejects adding an organization private team to a global match', async () => {
      const matchRes = await createMatch(
        supabase,
        {
          sportId: cricketSportId,
          matchType: 'CASUAL',
          matchFormat: 'TEAM', metadata: {},
        },
        userCustomerA
      );

      // Attempt to add Org A's private team to a global casual match
      await expect(
        addCompetitor(
          supabase,
          matchRes.match.id,
          {
            side: 'SIDE_A',
            competitorName: 'Team A',
            teamId: orgATeamId,
          },
          userCustomerA
        )
      ).rejects.toMatchObject({ statusCode: 400, code: 'PRIVATE_TEAM_GLOBAL_MATCH' });

      await supabase.from('matches').delete().eq('id', matchRes.match.id);
    });

    it('blocks attaching another customer booking without org management authorization', async () => {
      const bRef = 'SEC-MTH-BKG-' + Math.floor(Math.random() * 1000000);
      const bDate = '2026-11-20';
      const range = `[${bDate} 10:00:00+05:30, ${bDate} 11:00:00+05:30)`;

      const { data: bkg } = await supabase
        .from('bookings')
        .insert({
          booking_reference: bRef,
          customer_user_id: userCustomerA.userId,
          organization_id: demoOrgId,
          venue_id: demoVenueId,
          facility_id: badmintonFac1Id,
          sport_id: badmintonSportId,
          booking_date: bDate,
          start_time: '10:00:00',
          end_time: '11:00:00',
          duration_minutes: 60,
          protected_time_range: range,
          status: 'CONFIRMED',
          price_snapshot: { price: 1500 },
        })
        .select('id')
        .single();

      // Customer B attempts to attach Customer A's booking
      await expect(
        createMatch(
          supabase,
          {
            bookingId: bkg!.id,
            matchType: 'CASUAL',
            matchFormat: 'SINGLES', metadata: {},
          },
          userCustomerB
        )
      ).rejects.toMatchObject({ statusCode: 403, code: 'FORBIDDEN' });

      await supabase.from('bookings').delete().eq('id', bkg!.id);
    });
  });

  // 3. RBAC & SCORER ROLES
  describe('3. RBAC & Role Enforcement', () => {
    it('allows org OWNER and MANAGER to transition match, but rejects unauthorized customer', async () => {
      const matchRes = await createMatch(
        supabase,
        {
          organizationId: demoOrgId,
          sportId: badmintonSportId,
          matchType: 'CASUAL',
          matchFormat: 'SINGLES', metadata: {},
        },
        userOwnerA
      );

      // Add 2 competitors for SINGLES
      const cA = await addCompetitor(supabase, matchRes.match.id, { side: 'SIDE_A', competitorName: 'Player 1' }, userOwnerA);
      const cB = await addCompetitor(supabase, matchRes.match.id, { side: 'SIDE_B', competitorName: 'Player 2' }, userOwnerA);

      // Add 1 participant per side
      await addParticipant(supabase, matchRes.match.id, { competitorId: cA.competitor.id, userId: userCustomerA.userId , displayName: 'Player', role: 'PLAYER', status: 'CONFIRMED' }, userOwnerA);
      await addParticipant(supabase, matchRes.match.id, { competitorId: cB.competitor.id, userId: userCustomerB.userId , displayName: 'Player', role: 'PLAYER', status: 'CONFIRMED' }, userOwnerA);

      // Update schedule times
      const start = '2026-11-25T10:00:00.000Z';
      const end = '2026-11-25T11:00:00.000Z';
      await updateMatch(supabase, matchRes.match.id, { scheduledStart: start, scheduledEnd: end }, userOwnerA);

      // Unauthorized customer cannot transition match to SCHEDULED
      await expect(
        transitionMatchStatus(supabase, matchRes.match.id, { status: 'SCHEDULED' }, userCustomerOrgB)
      ).rejects.toMatchObject({ statusCode: 403, code: 'FORBIDDEN' });

      // Org MANAGER can schedule match
      const schedRes = await transitionMatchStatus(supabase, matchRes.match.id, { status: 'SCHEDULED' }, userManagerA);
      expect(schedRes.match.status).toBe('SCHEDULED');

      // Clean up
      await supabase.from('matches').delete().eq('id', matchRes.match.id);
    });

    it('enforces authorized scorer or manager for LIVE / PAUSED / COMPLETED transitions', async () => {
      const matchRes = await createMatch(
        supabase,
        {
          organizationId: demoOrgId,
          sportId: badmintonSportId,
          matchType: 'CASUAL',
          matchFormat: 'SINGLES', metadata: {},
        },
        userOwnerA
      );

      const cA = await addCompetitor(supabase, matchRes.match.id, { side: 'SIDE_A', competitorName: 'Player 1' }, userOwnerA);
      const cB = await addCompetitor(supabase, matchRes.match.id, { side: 'SIDE_B', competitorName: 'Player 2' }, userOwnerA);
      await addParticipant(supabase, matchRes.match.id, { competitorId: cA.competitor.id, userId: userCustomerA.userId , displayName: 'Player', role: 'PLAYER', status: 'CONFIRMED' }, userOwnerA);
      await addParticipant(supabase, matchRes.match.id, { competitorId: cB.competitor.id, userId: userCustomerB.userId , displayName: 'Player', role: 'PLAYER', status: 'CONFIRMED' }, userOwnerA);

      const start = '2026-11-25T10:00:00.000Z';
      const end = '2026-11-25T11:00:00.000Z';
      await updateMatch(supabase, matchRes.match.id, { scheduledStart: start, scheduledEnd: end }, userOwnerA);
      await transitionMatchStatus(supabase, matchRes.match.id, { status: 'SCHEDULED' }, userOwnerA);

      // Customer cannot start match
      await expect(
        transitionMatchStatus(supabase, matchRes.match.id, { status: 'LIVE' }, userCustomerOrgB)
      ).rejects.toMatchObject({ statusCode: 403, code: 'SCORER_UNAUTHORIZED' });

      // Owner/Manager can start match
      const liveRes = await transitionMatchStatus(supabase, matchRes.match.id, { status: 'LIVE' }, userOwnerA);
      expect(liveRes.match.status).toBe('LIVE');
      expect(liveRes.match.actual_start).toBeTruthy();

      // Pause match
      const pauseRes = await transitionMatchStatus(supabase, matchRes.match.id, { status: 'PAUSED' }, userManagerA);
      expect(pauseRes.match.status).toBe('PAUSED');

      // Complete match
      const completeRes = await transitionMatchStatus(
        supabase,
        matchRes.match.id,
        { status: 'COMPLETED', winnerSide: 'SIDE_A' },
        userOwnerA
      );
      expect(completeRes.match.status).toBe('COMPLETED');
      expect(completeRes.match.actual_end).toBeTruthy();

      // Clean up
      await supabase.from('matches').delete().eq('id', matchRes.match.id);
    });
  });

  // 4. FORMAT RULES & PARTICIPANT INTEGRITY
  describe('4. Format Rules & Participant Integrity', () => {
    it('blocks participant appearing on both SIDE_A and SIDE_B', async () => {
      const matchRes = await createMatch(
        supabase,
        {
          title: 'Participant Duplicate Check',
          sportId: badmintonSportId,
          matchType: 'CASUAL',
          matchFormat: 'SINGLES', metadata: {},
        },
        userCustomerA
      );

      const cA = await addCompetitor(supabase, matchRes.match.id, { side: 'SIDE_A', competitorName: 'P1' }, userCustomerA);
      const cB = await addCompetitor(supabase, matchRes.match.id, { side: 'SIDE_B', competitorName: 'P2' }, userCustomerA);

      // Add userCustomerB to SIDE_A
      await addParticipant(supabase, matchRes.match.id, { competitorId: cA.competitor.id, userId: userCustomerB.userId , displayName: 'Player', role: 'PLAYER', status: 'CONFIRMED' }, userCustomerA);

      // Attempt to add userCustomerB to SIDE_B
      await expect(
        addParticipant(supabase, matchRes.match.id, { competitorId: cB.competitor.id, userId: userCustomerB.userId , displayName: 'Player', role: 'PLAYER', status: 'CONFIRMED' }, userCustomerA)
      ).rejects.toMatchObject({ statusCode: 400, code: 'DUPLICATE_PARTICIPANT' });

      await supabase.from('matches').delete().eq('id', matchRes.match.id);
    });

    it('enforces format requirements before scheduling: SINGLES exactly 1, DOUBLES exactly 2 per side', async () => {
      const matchRes = await createMatch(
        supabase,
        {
          title: 'Format Check Doubles',
          sportId: badmintonSportId,
          matchType: 'CASUAL',
          matchFormat: 'DOUBLES', metadata: {},
        },
        userCustomerA
      );

      const cA = await addCompetitor(supabase, matchRes.match.id, { side: 'SIDE_A', competitorName: 'Team 1' }, userCustomerA);
      await addCompetitor(supabase, matchRes.match.id, { side: 'SIDE_B', competitorName: 'Team 2' }, userCustomerA);

      // Only add 1 participant to SIDE_A
      await addParticipant(supabase, matchRes.match.id, { competitorId: cA.competitor.id, userId: userCustomerA.userId , displayName: 'Player', role: 'PLAYER', status: 'CONFIRMED' }, userCustomerA);

      await updateMatch(
        supabase,
        matchRes.match.id,
        {
          scheduledStart: '2026-11-26T10:00:00.000Z',
          scheduledEnd: '2026-11-26T11:00:00.000Z',
        },
        userCustomerA
      );

      // Attempt to schedule with incomplete DOUBLES roster
      await expect(
        transitionMatchStatus(supabase, matchRes.match.id, { status: 'SCHEDULED' }, userCustomerA)
      ).rejects.toMatchObject({ statusCode: 400, code: 'FORMAT_REQUIREMENT_UNMET' });

      await supabase.from('matches').delete().eq('id', matchRes.match.id);
    });
  });

  // 5. LIFECYCLE STATE MACHINE & TERMINAL LOCKS
  describe('5. Lifecycle State Machine & Terminal State Locks', () => {
    it('prohibits transitioning out of terminal states (COMPLETED, CANCELLED, ABANDONED)', async () => {
      const matchRes = await createMatch(
        supabase,
        {
          title: 'Terminal Lock Match',
          sportId: badmintonSportId,
          matchType: 'CASUAL',
          matchFormat: 'SINGLES', metadata: {},
        },
        userCustomerA
      );

      // Transition DRAFT -> CANCELLED
      const cancelRes = await transitionMatchStatus(supabase, matchRes.match.id, { status: 'CANCELLED' }, userCustomerA);
      expect(cancelRes.match.status).toBe('CANCELLED');

      // Attempt to transition CANCELLED -> DRAFT or SCHEDULED
      await expect(
        transitionMatchStatus(supabase, matchRes.match.id, { status: 'SCHEDULED' }, userCustomerA)
      ).rejects.toMatchObject({ statusCode: 409, code: 'TERMINAL_STATE' });

      // Attempt to mutate competitors on CANCELLED match
      await expect(
        addCompetitor(supabase, matchRes.match.id, { side: 'SIDE_A', competitorName: 'Locked' }, userCustomerA)
      ).rejects.toMatchObject({ statusCode: 400, code: 'LOCKED_STATUS' });

      await supabase.from('matches').delete().eq('id', matchRes.match.id);
    });

    it('prohibits invalid state transitions (e.g. DRAFT -> LIVE)', async () => {
      const matchRes = await createMatch(
        supabase,
        {
          title: 'Invalid Jump Match',
          sportId: badmintonSportId,
          matchType: 'CASUAL',
          matchFormat: 'SINGLES', metadata: {},
        },
        userCustomerA
      );

      await expect(
        transitionMatchStatus(supabase, matchRes.match.id, { status: 'LIVE' }, userCustomerA)
      ).rejects.toMatchObject({ statusCode: 409, code: 'INVALID_TRANSITION' });

      await supabase.from('matches').delete().eq('id', matchRes.match.id);
    });
  });
});
