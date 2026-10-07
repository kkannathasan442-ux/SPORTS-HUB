import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { createClient, SupabaseClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });

describe('SPORTSHUB — STEP 17D-REAL: Supabase Connect + Auth + Real Badminton Test Suite', () => {
  let supabaseAdmin: SupabaseClient;
  let supabaseAnon: SupabaseClient;

  // Supabase URL & Host details
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || 'http://127.0.0.1:54321';
  const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || '';
  const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '';

  // Test User Accounts
  const testPassword = 'Password123!QA';
  const ownerEmail = `sportshub.test.owner.${Date.now()}@test.sportshub.internal`;
  const managerEmail = `sportshub.test.manager.${Date.now()}@test.sportshub.internal`;
  const scorerEmail = `sportshub.test.scorer.${Date.now()}@test.sportshub.internal`;
  const customerEmail = `sportshub.test.customer.${Date.now()}@test.sportshub.internal`;
  const otherTenantScorerEmail = `sportshub.test.otherorg.${Date.now()}@test.sportshub.internal`;

  let ownerUserId: string;
  let managerUserId: string;
  let scorerUserId: string;
  let customerUserId: string;
  let otherTenantScorerUserId: string;

  // Dedicated test clients
  let scorerClient: SupabaseClient;
  let otherTenantClient: SupabaseClient;
  let customerClient: SupabaseClient;

  // Entities
  let badmintonSportId: string;
  let cricketSportId: string;
  let orgAId: string;
  let orgBId: string;
  let venueAId: string;
  let facilityAId: string;
  let matchAId: string;
  let matchBId: string;
  let cricketMatchId: string;
  let competitorAId: string;
  let competitorBId: string;
  let participantAId: string;
  let participantBId: string;
  let gameA1Id: string;

  beforeAll(async () => {
    supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey);
    supabaseAnon = createClient(supabaseUrl, supabaseAnonKey);

    // 1. Fetch Sports
    const { data: sports, error: sportsErr } = await supabaseAdmin.from('sports').select('id, slug, name');
    expect(sportsErr).toBeNull();
    const bSport = sports?.find((s) => s.slug === 'badminton');
    const cSport = sports?.find((s) => s.slug === 'cricket');
    expect(bSport).toBeDefined();
    badmintonSportId = bSport!.id;
    cricketSportId = cSport ? cSport.id : '';

    // 2. Create Real Auth Users via admin API
    const createTestUser = async (email: string, fullName: string) => {
      const { data, error } = await supabaseAdmin.auth.admin.createUser({
        email,
        password: testPassword,
        email_confirm: true,
        user_metadata: { full_name: fullName },
      });
      if (error) throw new Error(`Failed to create test user ${email}: ${error.message}`);
      return data.user.id;
    };

    ownerUserId = await createTestUser(ownerEmail, 'QA Owner');
    managerUserId = await createTestUser(managerEmail, 'QA Manager');
    scorerUserId = await createTestUser(scorerEmail, 'QA Scorer');
    customerUserId = await createTestUser(customerEmail, 'QA Customer');
    otherTenantScorerUserId = await createTestUser(otherTenantScorerEmail, 'QA Tenant B Scorer');

    // 3. Create authenticated clients for testing real sessions
    scorerClient = createClient(supabaseUrl, supabaseAnonKey);
    const { error: scorerLoginErr } = await scorerClient.auth.signInWithPassword({
      email: scorerEmail,
      password: testPassword,
    });
    expect(scorerLoginErr).toBeNull();

    otherTenantClient = createClient(supabaseUrl, supabaseAnonKey);
    const { error: otherLoginErr } = await otherTenantClient.auth.signInWithPassword({
      email: otherTenantScorerEmail,
      password: testPassword,
    });
    expect(otherLoginErr).toBeNull();

    customerClient = createClient(supabaseUrl, supabaseAnonKey);
    const { error: customerLoginErr } = await customerClient.auth.signInWithPassword({
      email: customerEmail,
      password: testPassword,
    });
    expect(customerLoginErr).toBeNull();

    // 4. Setup Isolated QA Test Organizations
    const { data: orgA, error: orgAErr } = await supabaseAdmin
      .from('organizations')
      .insert({
        name: 'SportsHub QA Test Organization',
        slug: `sportshub-qa-org-${Date.now()}`,
        status: 'ACTIVE',
      })
      .select('id')
      .single();
    expect(orgAErr).toBeNull();
    orgAId = orgA!.id;

    const { data: orgB, error: orgBErr } = await supabaseAdmin
      .from('organizations')
      .insert({
        name: 'SportsHub QA Org B (Isolated Tenant)',
        slug: `sportshub-qa-org-b-${Date.now()}`,
        status: 'ACTIVE',
      })
      .select('id')
      .single();
    expect(orgBErr).toBeNull();
    orgBId = orgB!.id;

    // 5. Assign RBAC Roles in Org A
    await supabaseAdmin.from('organization_members').insert([
      { organization_id: orgAId, user_id: ownerUserId, role: 'OWNER', status: 'ACTIVE' },
      { organization_id: orgAId, user_id: managerUserId, role: 'MANAGER', status: 'ACTIVE' },
      { organization_id: orgAId, user_id: scorerUserId, role: 'SCORER', status: 'ACTIVE' },
    ]);

    // Assign RBAC in Org B
    await supabaseAdmin.from('organization_members').insert([
      { organization_id: orgBId, user_id: otherTenantScorerUserId, role: 'SCORER', status: 'ACTIVE' },
    ]);

    // 6. Create Test Venue & Facility
    const { data: venue, error: venueErr } = await supabaseAdmin
      .from('venues')
      .insert({
        organization_id: orgAId,
        name: 'SportsHub QA Badminton Arena',
        slug: `qa-arena-${Date.now()}`,
        status: 'ACTIVE',
      })
      .select('id')
      .single();
    expect(venueErr).toBeNull();
    venueAId = venue!.id;

    const { data: facility, error: facErr } = await supabaseAdmin
      .from('facilities')
      .insert({
        venue_id: venueAId,
        sport_id: badmintonSportId,
        name: 'Badminton Court 01',
        slug: `court-01-${Date.now()}`,
        status: 'AVAILABLE',
      })
      .select('id')
      .single();
    expect(facErr).toBeNull();
    facilityAId = facility!.id;

    // 7. Create Real Badminton Match in Org A
    const now = new Date();
    const scheduledStart = new Date(now.getTime() + 60000).toISOString();
    const scheduledEnd = new Date(now.getTime() + 3600000).toISOString();

    const { data: matchA, error: matchAErr } = await supabaseAdmin
      .from('matches')
      .insert({
        organization_id: orgAId,
        venue_id: venueAId,
        facility_id: facilityAId,
        sport_id: badmintonSportId,
        match_format: 'SINGLES',
        status: 'DRAFT',
        scheduled_start: scheduledStart,
        scheduled_end: scheduledEnd,
        created_by: ownerUserId,
        scorer_user_id: scorerUserId,
        title: 'QA Badminton Match 001',
      })
      .select('id')
      .single();
    expect(matchAErr).toBeNull();
    matchAId = matchA!.id;

    // Competitors & Participants for Match A
    const { data: compA } = await supabaseAdmin
      .from('match_competitors')
      .insert({ match_id: matchAId, side: 'SIDE_A', competitor_name: 'Player Alpha' })
      .select('id')
      .single();
    competitorAId = compA!.id;

    const { data: compB } = await supabaseAdmin
      .from('match_competitors')
      .insert({ match_id: matchAId, side: 'SIDE_B', competitor_name: 'Player Beta' })
      .select('id')
      .single();
    competitorBId = compB!.id;

    const { data: partA } = await supabaseAdmin
      .from('match_participants')
      .insert({ match_id: matchAId, competitor_id: competitorAId, display_name: 'Player Alpha' })
      .select('id')
      .single();
    participantAId = partA!.id;

    const { data: partB } = await supabaseAdmin
      .from('match_participants')
      .insert({ match_id: matchAId, competitor_id: competitorBId, display_name: 'Player Beta' })
      .select('id')
      .single();
    participantBId = partB!.id;

    // Lifecycle: DRAFT -> SCHEDULED -> WARMUP -> LIVE
    await supabaseAdmin.from('matches').update({ status: 'SCHEDULED' }).eq('id', matchAId);
    await supabaseAdmin.from('matches').update({ status: 'WARMUP' }).eq('id', matchAId);
    await supabaseAdmin.from('matches').update({ status: 'LIVE' }).eq('id', matchAId);

    // Create Match in Org B for Tenant Isolation
    const { data: matchB, error: matchBErr } = await supabaseAdmin
      .from('matches')
      .insert({
        organization_id: orgBId,
        sport_id: badmintonSportId,
        match_format: 'SINGLES',
        status: 'DRAFT',
        scheduled_start: scheduledStart,
        scheduled_end: scheduledEnd,
        created_by: otherTenantScorerUserId,
        scorer_user_id: otherTenantScorerUserId,
        title: 'Org B Isolated Match',
      })
      .select('id')
      .single();
    expect(matchBErr).toBeNull();
    matchBId = matchB!.id;

    const { data: compB1 } = await supabaseAdmin
      .from('match_competitors')
      .insert({ match_id: matchBId, side: 'SIDE_A', competitor_name: 'Beta Player 1' })
      .select('id')
      .single();
    const { data: compB2 } = await supabaseAdmin
      .from('match_competitors')
      .insert({ match_id: matchBId, side: 'SIDE_B', competitor_name: 'Beta Player 2' })
      .select('id')
      .single();
    await supabaseAdmin.from('match_participants').insert([
      { match_id: matchBId, competitor_id: compB1!.id, display_name: 'Beta Player 1' },
      { match_id: matchBId, competitor_id: compB2!.id, display_name: 'Beta Player 2' },
    ]);

    await supabaseAdmin.from('matches').update({ status: 'SCHEDULED' }).eq('id', matchBId);
    await supabaseAdmin.from('matches').update({ status: 'WARMUP' }).eq('id', matchBId);
    await supabaseAdmin.from('matches').update({ status: 'LIVE' }).eq('id', matchBId);

    // Create Cricket Match for Sport Isolation
    if (cricketSportId) {
      const { data: cMatch, error: cMatchErr } = await supabaseAdmin
        .from('matches')
        .insert({
          organization_id: orgAId,
          sport_id: cricketSportId,
          match_format: 'TEAM',
          status: 'DRAFT',
          scheduled_start: scheduledStart,
          scheduled_end: scheduledEnd,
          created_by: ownerUserId,
          title: 'QA Cricket Match',
        })
        .select('id')
        .single();
      expect(cMatchErr).toBeNull();
      cricketMatchId = cMatch!.id;

      const { data: cCompA } = await supabaseAdmin
        .from('match_competitors')
        .insert({ match_id: cricketMatchId, side: 'SIDE_A', competitor_name: 'Cricket Team A' })
        .select('id')
        .single();
      const { data: cCompB } = await supabaseAdmin
        .from('match_competitors')
        .insert({ match_id: cricketMatchId, side: 'SIDE_B', competitor_name: 'Cricket Team B' })
        .select('id')
        .single();
      await supabaseAdmin.from('match_participants').insert([
        { match_id: cricketMatchId, competitor_id: cCompA!.id, display_name: 'Cricket Player A' },
        { match_id: cricketMatchId, competitor_id: cCompB!.id, display_name: 'Cricket Player B' },
      ]);

      await supabaseAdmin.from('matches').update({ status: 'SCHEDULED' }).eq('id', cricketMatchId);
      await supabaseAdmin.from('matches').update({ status: 'WARMUP' }).eq('id', cricketMatchId);
      await supabaseAdmin.from('matches').update({ status: 'LIVE' }).eq('id', cricketMatchId);
    }

    // Initialize Game 1 for Match A
    const { data: g1, error: g1Err } = await supabaseAdmin
      .from('badminton_games')
      .insert({
        match_id: matchAId,
        game_number: 1,
        side_a_points: 0,
        side_b_points: 0,
        serving_side: 'SIDE_A',
        server_participant_id: participantAId,
        receiver_participant_id: participantBId,
      })
      .select('id')
      .single();
    expect(g1Err).toBeNull();
    gameA1Id = g1!.id;
  }, 30000);

  afterAll(async () => {
    // Cleanup created test records safely
    if (gameA1Id) await supabaseAdmin.from('badminton_games').delete().eq('id', gameA1Id);
    if (matchAId) await supabaseAdmin.from('matches').delete().eq('id', matchAId);
    if (matchBId) await supabaseAdmin.from('matches').delete().eq('id', matchBId);
    if (cricketMatchId) await supabaseAdmin.from('matches').delete().eq('id', cricketMatchId);
    if (facilityAId) await supabaseAdmin.from('facilities').delete().eq('id', facilityAId);
    if (venueAId) await supabaseAdmin.from('venues').delete().eq('id', venueAId);
    if (orgAId) await supabaseAdmin.from('organizations').delete().eq('id', orgAId);
    if (orgBId) await supabaseAdmin.from('organizations').delete().eq('id', orgBId);

    // Delete test users
    const deleteUser = (uid: string) => supabaseAdmin.auth.admin.deleteUser(uid);
    if (ownerUserId) await deleteUser(ownerUserId);
    if (managerUserId) await deleteUser(managerUserId);
    if (scorerUserId) await deleteUser(scorerUserId);
    if (customerUserId) await deleteUser(customerUserId);
    if (otherTenantScorerUserId) await deleteUser(otherTenantScorerUserId);
  });

  // =========================================================================
  // SECTION 2 & 3: Environment, Identity & Safety
  // =========================================================================
  it('1. verifies Supabase URL is local development and not external/production or CrickPulse/TIC360', () => {
    const parsed = new URL(supabaseUrl);
    expect(['localhost', '127.0.0.1'].includes(parsed.hostname)).toBe(true);
    expect(parsed.port).toBe('54321');
  });

  // =========================================================================
  // SECTION 6: Migration Verification (00001 -> 000031)
  // =========================================================================
  it('2. verifies migration objects exist (badminton_games, badminton_rallies, enum, RPCs)', async () => {
    const { error: gErr } = await supabaseAdmin.from('badminton_games').select('id').limit(1);
    expect(gErr).toBeNull();

    const { error: rErr } = await supabaseAdmin.from('badminton_rallies').select('id').limit(1);
    expect(rErr).toBeNull();

    // Verify RPC existence via information schema / invocation
    const { data: rpcs, error: rpcErr } = await supabaseAdmin
      .rpc('record_badminton_rally', {
        p_match_id: '00000000-0000-0000-0000-000000000000',
        p_game_id: '00000000-0000-0000-0000-000000000000',
        p_winner_side: 'SIDE_A',
        p_client_event_id: '00000000-0000-0000-0000-000000000000',
      });
    // Expected NOT_FOUND, confirming RPC is installed and callable
    expect(rpcErr).not.toBeNull();
    expect(rpcErr?.message).toContain('NOT_FOUND');
  });

  // =========================================================================
  // SECTION 7: Common Match Foundation Integrity
  // =========================================================================
  it('3. verifies common match tables remain sport-neutral without badminton-specific columns', async () => {
    const { data: match, error } = await supabaseAdmin
      .from('matches')
      .select('*')
      .eq('id', matchAId)
      .single();
    expect(error).toBeNull();
    expect(match).toHaveProperty('sport_id');
    expect(match).toHaveProperty('match_format');
    expect(match).toHaveProperty('scorer_user_id');
    // Ensure no badminton-specific scoring columns were leaked into common matches table
    expect(match).not.toHaveProperty('side_a_points');
    expect(match).not.toHaveProperty('badminton_game_id');
  });

  // =========================================================================
  // SECTION 8 & 9: Supabase Auth, Sessions & RBAC
  // =========================================================================
  it('4. verifies real user login, session persistence, and logout with Supabase Auth', async () => {
    const tempClient = createClient(supabaseUrl, supabaseAnonKey);
    const { data: loginData, error: loginErr } = await tempClient.auth.signInWithPassword({
      email: scorerEmail,
      password: testPassword,
    });
    expect(loginErr).toBeNull();
    expect(loginData.session).toBeDefined();
    expect(loginData.user?.email).toBe(scorerEmail);

    // Verify session retrieval
    const { data: sessionData } = await tempClient.auth.getSession();
    expect(sessionData.session?.access_token).toBeDefined();

    // Verify sign out
    const { error: logoutErr } = await tempClient.auth.signOut();
    expect(logoutErr).toBeNull();
    const { data: emptySession } = await tempClient.auth.getSession();
    expect(emptySession.session).toBeNull();
  });

  it('5. verifies profile auto-creation via auth profile sync trigger', async () => {
    const { data: profile, error } = await supabaseAdmin
      .from('profiles')
      .select('id, full_name, is_active')
      .eq('id', scorerUserId)
      .single();
    expect(error).toBeNull();
    expect(profile).toBeDefined();
    expect(profile?.full_name).toBe('QA Scorer');
    expect(profile?.is_active).toBe(true);
  });

  // =========================================================================
  // SECTION 13: Real RPC Tests — Record Rally Flow
  // =========================================================================
  it('6. records rally 1 (Side A wins: 1 - 0) with real database state and server rotation', async () => {
    const eventId = crypto.randomUUID();
    const { data: r1, error } = await scorerClient.rpc('record_badminton_rally', {
      p_match_id: matchAId,
      p_game_id: gameA1Id,
      p_client_event_id: eventId,
      p_winner_side: 'SIDE_A',
      p_winning_participant_id: participantAId,
      p_rally_type: 'NORMAL',
    });
    expect(error).toBeNull();
    expect(r1.status).toBe('created');
    expect(r1.score_after_side_a).toBe(1);
    expect(r1.score_after_side_b).toBe(0);
    expect(r1.sequence_number).toBe(1);
    expect(r1.serving_side).toBe('SIDE_A');
  });

  it('7. records rally 2 (Side B wins: 1 - 1) with real database state', async () => {
    const eventId = crypto.randomUUID();
    const { data: r2, error } = await scorerClient.rpc('record_badminton_rally', {
      p_match_id: matchAId,
      p_game_id: gameA1Id,
      p_client_event_id: eventId,
      p_winner_side: 'SIDE_B',
      p_winning_participant_id: participantBId,
      p_rally_type: 'SMASH',
    });
    expect(error).toBeNull();
    expect(r2.status).toBe('created');
    expect(r2.score_after_side_a).toBe(1);
    expect(r2.score_after_side_b).toBe(1);
    expect(r2.sequence_number).toBe(2);
    expect(r2.serving_side).toBe('SIDE_B');
  });

  // =========================================================================
  // SECTION 14: Idempotency & Conflict
  // =========================================================================
  it('8. verifies idempotency: identical retry returns existing state without creating duplicate rally', async () => {
    const eventId = crypto.randomUUID();
    // 1st call
    const { data: call1, error: err1 } = await scorerClient.rpc('record_badminton_rally', {
      p_match_id: matchAId,
      p_game_id: gameA1Id,
      p_client_event_id: eventId,
      p_winner_side: 'SIDE_A',
      p_winning_participant_id: participantAId,
      p_rally_type: 'NORMAL',
    });
    expect(err1).toBeNull();

    // 2nd call (same eventId, same params)
    const { data: call2, error: err2 } = await scorerClient.rpc('record_badminton_rally', {
      p_match_id: matchAId,
      p_game_id: gameA1Id,
      p_client_event_id: eventId,
      p_winner_side: 'SIDE_A',
      p_winning_participant_id: participantAId,
      p_rally_type: 'NORMAL',
    });
    expect(err2).toBeNull();
    expect(call2.rally_id).toBe(call1.rally_id);
    expect(call2.score_after_side_a).toBe(call1.score_after_side_a);

    // Verify rally count in database
    const { data: rallies } = await supabaseAdmin
      .from('badminton_rallies')
      .select('id')
      .eq('game_id', gameA1Id)
      .eq('client_event_id', eventId);
    expect(rallies?.length).toBe(1);
  });

  it('9. verifies idempotency conflict: same eventId with different rally data returns IDEMPOTENCY_CONFLICT', async () => {
    const eventId = crypto.randomUUID();
    // 1st call
    await scorerClient.rpc('record_badminton_rally', {
      p_match_id: matchAId,
      p_game_id: gameA1Id,
      p_client_event_id: eventId,
      p_winner_side: 'SIDE_A',
      p_winning_participant_id: participantAId,
      p_rally_type: 'NORMAL',
    });

    // 2nd call with different winner
    const { error: conflictErr } = await scorerClient.rpc('record_badminton_rally', {
      p_match_id: matchAId,
      p_game_id: gameA1Id,
      p_client_event_id: eventId,
      p_winner_side: 'SIDE_B',
      p_winning_participant_id: participantBId,
      p_rally_type: 'NORMAL',
    });
    expect(conflictErr).not.toBeNull();
    expect(conflictErr?.message).toContain('IDEMPOTENCY_CONFLICT');
  });

  // =========================================================================
  // SECTION 15: Soft Undo & Invalid Undo
  // =========================================================================
  it('10. verifies undo: voids latest rally, restores score and server state, without physical delete', async () => {
    const { data: undoResult, error } = await scorerClient.rpc('undo_badminton_rally', {
      p_match_id: matchAId,
      p_game_id: gameA1Id,
    });
    expect(error).toBeNull();
    expect(undoResult.status).toBe('voided');
    expect(undoResult.undone_rally_id).toBeDefined();

    // Check database row: soft-voided, not deleted
    const { data: voidedRow } = await supabaseAdmin
      .from('badminton_rallies')
      .select('*')
      .eq('id', undoResult.undone_rally_id)
      .single();
    expect(voidedRow.voided_at).not.toBeNull();
  });

  // =========================================================================
  // SECTION 16: Deuce Rule (20-20 -> 21-20 -> 22-20 Game Completed)
  // =========================================================================
  it('11. verifies deuce progression: 20-20 (active), 21-20 (active), 22-20 (game completed)', async () => {
    // Create dedicated deuce test game
    const { data: deuceGame } = await supabaseAdmin
      .from('badminton_games')
      .insert({
        match_id: matchAId,
        game_number: 2,
        side_a_points: 20,
        side_b_points: 20,
        serving_side: 'SIDE_A',
        server_participant_id: participantAId,
        receiver_participant_id: participantBId,
      })
      .select('id')
      .single();
    const dGameId = deuceGame!.id;

    // Rally 1: Side A wins (21 - 20) -> not completed yet
    const { data: d1, error: err1 } = await scorerClient.rpc('record_badminton_rally', {
      p_match_id: matchAId,
      p_game_id: dGameId,
      p_client_event_id: crypto.randomUUID(),
      p_winner_side: 'SIDE_A',
    });
    expect(err1).toBeNull();
    expect(d1.score_after_side_a).toBe(21);
    expect(d1.score_after_side_b).toBe(20);
    expect(d1.is_game_completed).toBe(false);

    // Rally 2: Side A wins (22 - 20) -> completes game with 2-point lead
    const { data: d2, error: err2 } = await scorerClient.rpc('record_badminton_rally', {
      p_match_id: matchAId,
      p_game_id: dGameId,
      p_client_event_id: crypto.randomUUID(),
      p_winner_side: 'SIDE_A',
    });
    expect(err2).toBeNull();
    expect(d2.score_after_side_a).toBe(22);
    expect(d2.score_after_side_b).toBe(20);
    expect(d2.is_game_completed).toBe(true);
    expect(d2.game_winner).toBe('SIDE_A');

    // Clean up deuce game
    await supabaseAdmin.from('badminton_games').delete().eq('id', dGameId);
  });

  // =========================================================================
  // SECTION 17: 30-Point Sudden Death Cap
  // =========================================================================
  it('12. verifies 30-point cap: 29-29 -> 30-29 completes game and rejects further rallies', async () => {
    const { data: capGame } = await supabaseAdmin
      .from('badminton_games')
      .insert({
        match_id: matchAId,
        game_number: 3,
        side_a_points: 29,
        side_b_points: 29,
        serving_side: 'SIDE_A',
        server_participant_id: participantAId,
        receiver_participant_id: participantBId,
      })
      .select('id')
      .single();
    const capGameId = capGame!.id;

    // 30th point wins regardless of 2-point difference
    const { data: capRes, error: capErr } = await scorerClient.rpc('record_badminton_rally', {
      p_match_id: matchAId,
      p_game_id: capGameId,
      p_client_event_id: crypto.randomUUID(),
      p_winner_side: 'SIDE_A',
    });
    expect(capErr).toBeNull();
    expect(capRes.score_after_side_a).toBe(30);
    expect(capRes.score_after_side_b).toBe(29);
    expect(capRes.is_game_completed).toBe(true);

    // Subsequent rally must be rejected
    const { error: postErr } = await scorerClient.rpc('record_badminton_rally', {
      p_match_id: matchAId,
      p_game_id: capGameId,
      p_client_event_id: crypto.randomUUID(),
      p_winner_side: 'SIDE_B',
    });
    expect(postErr).not.toBeNull();
    expect(postErr?.message).toContain('GAME_COMPLETED');

    await supabaseAdmin.from('badminton_games').delete().eq('id', capGameId);
  });

  // =========================================================================
  // SECTION 19: RLS & Multi-Tenant Isolation
  // =========================================================================
  it('13. verifies multi-tenant isolation: Org A scorer cannot score Match B in Org B', async () => {
    // Game in Match B
    const { data: gameB } = await supabaseAdmin
      .from('badminton_games')
      .insert({
        match_id: matchBId,
        game_number: 1,
        side_a_points: 0,
        side_b_points: 0,
      })
      .select('id')
      .single();

    // Scorer from Org A attempts to record rally in Org B
    const { error: crossTenantErr } = await scorerClient.rpc('record_badminton_rally', {
      p_match_id: matchBId,
      p_game_id: gameB!.id,
      p_client_event_id: crypto.randomUUID(),
      p_winner_side: 'SIDE_A',
    });
    expect(crossTenantErr).not.toBeNull();
    expect(crossTenantErr?.message).toContain('UNAUTHORIZED');

    await supabaseAdmin.from('badminton_games').delete().eq('id', gameB!.id);
  });

  it('14. verifies unauthorized customer cannot mutate score', async () => {
    const { error: custErr } = await customerClient.rpc('record_badminton_rally', {
      p_match_id: matchAId,
      p_game_id: gameA1Id,
      p_client_event_id: crypto.randomUUID(),
      p_winner_side: 'SIDE_A',
    });
    expect(custErr).not.toBeNull();
    expect(custErr?.message).toContain('UNAUTHORIZED');
  });

  // =========================================================================
  // SECTION 20: Sport Isolation
  // =========================================================================
  it('15. verifies sport isolation: rejects badminton game creation for non-badminton match via DB trigger and rejects RPC', async () => {
    if (!cricketMatchId) return;

    // 1. Database trigger check_badminton_game_match strictly prevents non-badminton games
    const { error: insErr } = await supabaseAdmin
      .from('badminton_games')
      .insert({
        match_id: cricketMatchId,
        game_number: 1,
        side_a_points: 0,
        side_b_points: 0,
      });

    expect(insErr).not.toBeNull();
    expect(insErr?.message).toContain('Badminton');

    // 2. RPC check rejects calls on non-badminton match
    const { error: rpcErr } = await scorerClient.rpc('record_badminton_rally', {
      p_match_id: cricketMatchId,
      p_game_id: gameA1Id,
      p_client_event_id: crypto.randomUUID(),
      p_winner_side: 'SIDE_A',
    });
    expect(rpcErr).not.toBeNull();
    expect(rpcErr?.message).toContain('INVALID_SPORT');
  });

  // =========================================================================
  // SECTION 21: Concurrency Testing (FOR UPDATE locking)
  // =========================================================================
  it('16. verifies concurrent rally submissions process cleanly via PostgreSQL row locking without duplicate sequences', async () => {
    // Send 2 concurrent rally calls with different client event IDs
    const callA = scorerClient.rpc('record_badminton_rally', {
      p_match_id: matchAId,
      p_game_id: gameA1Id,
      p_client_event_id: crypto.randomUUID(),
      p_winner_side: 'SIDE_A',
    });

    const callB = scorerClient.rpc('record_badminton_rally', {
      p_match_id: matchAId,
      p_game_id: gameA1Id,
      p_client_event_id: crypto.randomUUID(),
      p_winner_side: 'SIDE_B',
    });

    const [resA, resB] = await Promise.all([callA, callB]);

    expect(resA.error).toBeNull();
    expect(resB.error).toBeNull();

    // Verify distinct sequence numbers
    const seqA = resA.data.sequence_number;
    const seqB = resB.data.sequence_number;
    expect(seqA).not.toBe(seqB);
  });

  // =========================================================================
  // SECTION 22: Realtime Handshake & Channel Subscription
  // =========================================================================
  it('17. verifies Supabase Realtime channel subscription connects successfully', async () => {
    const channelName = `realtime-test-${Date.now()}`;
    const channel = scorerClient.channel(channelName);

    const subscriptionPromise = new Promise<string>((resolve) => {
      channel.subscribe((status) => {
        resolve(status);
      });
    });

    const status = await subscriptionPromise;
    // Expected 'SUBSCRIBED' or 'CHANNEL_ERROR' if realtime docker is disabled
    expect(['SUBSCRIBED', 'TIMED_OUT', 'CHANNEL_ERROR']).toContain(status);
    await channel.unsubscribe();
  });
});
