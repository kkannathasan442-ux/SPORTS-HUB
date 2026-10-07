import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { createClient, SupabaseClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });

describe('STEP 17C — Badminton Atomic Scoring RPC & Game Rules Integration Tests', () => {
  let supabaseAdmin: SupabaseClient;
  let supabaseAnon: SupabaseClient;
  let badmintonSportId: string;
  let cricketSportId: string;
  let orgAId: string;
  let orgBId: string;
  let matchAId: string;
  let matchBId: string;
  let cricketMatchId: string;
  let gameA1Id: string;
  let gameDeuceId: string;
  let gameCapId: string;
  let competitorAId: string;
  let competitorBId: string;
  let participantAId: string;
  let participantBId: string;
  let outsideParticipantId: string;

  const userOwner = '11111111-1111-1111-1111-111111111111';
  const userScorer = '22222222-2222-2222-2222-222222222222';
  const userOtherTenant = '33333333-3333-3333-3333-333333333333';

  beforeAll(async () => {
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || 'http://127.0.0.1:54321';
    const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || '';
    const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '';

    supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey);
    supabaseAnon = createClient(supabaseUrl, supabaseAnonKey);

    // Fetch Sports
    const { data: sports } = await supabaseAdmin.from('sports').select('id, slug');
    badmintonSportId = sports?.find((s) => s.slug === 'badminton')?.id!;
    cricketSportId = sports?.find((s) => s.slug === 'cricket')?.id!;

    // Create 2 Organizations for Tenant Isolation
    const { data: orgA } = await supabaseAdmin
      .from('organizations')
      .insert({
        name: 'Badminton Club Alpha',
        slug: 'badminton-club-alpha-' + Date.now(),
        status: 'ACTIVE',
      })
      .select('id')
      .single();
    orgAId = orgA!.id;

    const { data: orgB } = await supabaseAdmin
      .from('organizations')
      .insert({
        name: 'Badminton Club Beta',
        slug: 'badminton-club-beta-' + Date.now(),
        status: 'ACTIVE',
      })
      .select('id')
      .single();
    orgBId = orgB!.id;

    // Organization Memberships
    await supabaseAdmin.from('organization_members').upsert([
      { organization_id: orgAId, user_id: userOwner, role: 'OWNER', status: 'ACTIVE' },
      { organization_id: orgBId, user_id: userOtherTenant, role: 'OWNER', status: 'ACTIVE' },
    ]);

    const now = new Date();
    const scheduledStart = new Date(now.getTime() + 60000).toISOString();
    const scheduledEnd = new Date(now.getTime() + 3600000).toISOString();

    // Create Match in Org A
    const { data: matchA } = await supabaseAdmin
      .from('matches')
      .insert({
        organization_id: orgAId,
        sport_id: badmintonSportId,
        match_format: 'SINGLES',
        status: 'DRAFT',
        scheduled_start: scheduledStart,
        scheduled_end: scheduledEnd,
        created_by: userOwner,
        scorer_user_id: userScorer,
        title: 'Alpha Singles Championship',
      })
      .select('id')
      .single();
    matchAId = matchA!.id;

    // Create Competitors & Participants for Match A
    const { data: compA } = await supabaseAdmin
      .from('match_competitors')
      .insert({
        match_id: matchAId,
        side: 'SIDE_A',
        competitor_name: 'Alpha Player 1',
      })
      .select('id')
      .single();
    competitorAId = compA!.id;

    const { data: compB } = await supabaseAdmin
      .from('match_competitors')
      .insert({
        match_id: matchAId,
        side: 'SIDE_B',
        competitor_name: 'Alpha Player 2',
      })
      .select('id')
      .single();
    competitorBId = compB!.id;

    const { data: partA } = await supabaseAdmin
      .from('match_participants')
      .insert({
        match_id: matchAId,
        competitor_id: competitorAId,
        display_name: 'Alpha Player 1',
      })
      .select('id')
      .single();
    participantAId = partA!.id;

    const { data: partB } = await supabaseAdmin
      .from('match_participants')
      .insert({
        match_id: matchAId,
        competitor_id: competitorBId,
        display_name: 'Alpha Player 2',
      })
      .select('id')
      .single();
    participantBId = partB!.id;

    // Transition Match A to LIVE: DRAFT -> SCHEDULED -> WARMUP -> LIVE
    await supabaseAdmin.from('matches').update({ status: 'SCHEDULED' }).eq('id', matchAId);
    await supabaseAdmin.from('matches').update({ status: 'WARMUP' }).eq('id', matchAId);
    await supabaseAdmin.from('matches').update({ status: 'LIVE' }).eq('id', matchAId);

    // Create Match in Org B (for Tenant Isolation test)
    const { data: matchB } = await supabaseAdmin
      .from('matches')
      .insert({
        organization_id: orgBId,
        sport_id: badmintonSportId,
        match_format: 'SINGLES',
        status: 'DRAFT',
        scheduled_start: scheduledStart,
        scheduled_end: scheduledEnd,
        created_by: userOtherTenant,
        title: 'Beta Singles Championship',
      })
      .select('id')
      .single();
    matchBId = matchB!.id;

    // Add competitors/participants for match B
    const { data: compB1 } = await supabaseAdmin
      .from('match_competitors')
      .insert({ match_id: matchBId, side: 'SIDE_A', competitor_name: 'Beta 1' })
      .select('id')
      .single();
    const { data: compB2 } = await supabaseAdmin
      .from('match_competitors')
      .insert({ match_id: matchBId, side: 'SIDE_B', competitor_name: 'Beta 2' })
      .select('id')
      .single();
    const { data: outsidePart } = await supabaseAdmin
      .from('match_participants')
      .insert({ match_id: matchBId, competitor_id: compB1!.id, display_name: 'Outside Player' })
      .select('id')
      .single();
    outsideParticipantId = outsidePart!.id;
    await supabaseAdmin
      .from('match_participants')
      .insert({ match_id: matchBId, competitor_id: compB2!.id, display_name: 'Beta 2' });

    await supabaseAdmin.from('matches').update({ status: 'SCHEDULED' }).eq('id', matchBId);
    await supabaseAdmin.from('matches').update({ status: 'WARMUP' }).eq('id', matchBId);
    await supabaseAdmin.from('matches').update({ status: 'LIVE' }).eq('id', matchBId);

    // Create a Cricket match to test sport isolation
    const { data: cricketMatch } = await supabaseAdmin
      .from('matches')
      .insert({
        organization_id: orgAId,
        sport_id: cricketSportId,
        match_format: 'TEAM',
        status: 'DRAFT',
        scheduled_start: scheduledStart,
        scheduled_end: scheduledEnd,
        created_by: userOwner,
        title: 'Alpha Cricket Friendly',
      })
      .select('id')
      .single();
    cricketMatchId = cricketMatch!.id;

    // Create Standard Game 1 for Match A
    const { data: gameA1 } = await supabaseAdmin
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
    gameA1Id = gameA1!.id;

    // Create Game 2 configured for deuce testing (pre-scored at 20-20)
    const { data: gameDeuce } = await supabaseAdmin
      .from('badminton_games')
      .insert({
        match_id: matchAId,
        game_number: 2,
        side_a_points: 20,
        side_b_points: 20,
        serving_side: 'SIDE_A',
      })
      .select('id')
      .single();
    gameDeuceId = gameDeuce!.id;

    // Create Game 3 configured for 30-point cap testing (pre-scored at 29-29)
    const { data: gameCap } = await supabaseAdmin
      .from('badminton_games')
      .insert({
        match_id: matchAId,
        game_number: 3,
        side_a_points: 29,
        side_b_points: 29,
        serving_side: 'SIDE_A',
      })
      .select('id')
      .single();
    gameCapId = gameCap!.id;
  }, 20000);

  afterAll(async () => {
    // Cleanup created test records
    if (matchAId) await supabaseAdmin.from('matches').delete().eq('id', matchAId);
    if (matchBId) await supabaseAdmin.from('matches').delete().eq('id', matchBId);
    if (cricketMatchId) await supabaseAdmin.from('matches').delete().eq('id', cricketMatchId);
    if (orgAId) await supabaseAdmin.from('organizations').delete().eq('id', orgAId);
    if (orgBId) await supabaseAdmin.from('organizations').delete().eq('id', orgBId);
  });

  // 1. BASIC SCORING
  describe('1. Basic Scoring & Sequence', () => {
    it('records first rally and increments Side A score to 1-0', async () => {
      const clientEventId = 'aaaaaaaa-1111-1111-1111-111111111111';
      const { data, error } = await supabaseAdmin.rpc('record_badminton_rally', {
        p_match_id: matchAId,
        p_game_id: gameA1Id,
        p_client_event_id: clientEventId,
        p_winner_side: 'SIDE_A',
        p_winning_participant_id: participantAId,
        p_rally_type: 'SMASH',
      });

      expect(error).toBeNull();
      expect(data).toBeDefined();
      expect(data.score_after_side_a).toBe(1);
      expect(data.score_after_side_b).toBe(0);
      expect(data.sequence_number).toBe(1);
      expect(data.serving_side).toBe('SIDE_A');
      expect(data.is_game_completed).toBe(false);
    });

    it('records second rally won by Side B, updating score to 1-1 and server to Side B', async () => {
      const clientEventId = 'aaaaaaaa-2222-2222-2222-222222222222';
      const { data, error } = await supabaseAdmin.rpc('record_badminton_rally', {
        p_match_id: matchAId,
        p_game_id: gameA1Id,
        p_client_event_id: clientEventId,
        p_winner_side: 'SIDE_B',
        p_winning_participant_id: participantBId,
        p_rally_type: 'DROP',
      });

      expect(error).toBeNull();
      expect(data.score_after_side_a).toBe(1);
      expect(data.score_after_side_b).toBe(1);
      expect(data.sequence_number).toBe(2);
      expect(data.serving_side).toBe('SIDE_B');
    });

    it('rejects invalid/out-of-order sequence number if provided', async () => {
      const clientEventId = 'aaaaaaaa-3333-3333-3333-333333333333';
      const { error } = await supabaseAdmin.rpc('record_badminton_rally', {
        p_match_id: matchAId,
        p_game_id: gameA1Id,
        p_client_event_id: clientEventId,
        p_winner_side: 'SIDE_A',
        p_sequence_number: 99, // Expected is 3
      });

      expect(error).not.toBeNull();
      expect(error?.message).toContain('INVALID_SEQUENCE');
    });
  });

  // 2. IDEMPOTENCY
  describe('2. Idempotency Protection', () => {
    it('returns existing result when duplicate identical client_event_id is re-sent', async () => {
      const clientEventId = 'aaaaaaaa-1111-1111-1111-111111111111'; // Same as first test
      const { data, error } = await supabaseAdmin.rpc('record_badminton_rally', {
        p_match_id: matchAId,
        p_game_id: gameA1Id,
        p_client_event_id: clientEventId,
        p_winner_side: 'SIDE_A',
        p_winning_participant_id: participantAId,
      });

      expect(error).toBeNull();
      expect(data.status).toBe('existing');
      expect(data.sequence_number).toBe(1);
      expect(data.score_after_side_a).toBe(1);
    });

    it('rejects IDEMPOTENCY_CONFLICT when client_event_id is reused with conflicting winner side', async () => {
      const clientEventId = 'aaaaaaaa-1111-1111-1111-111111111111'; // Originally SIDE_A
      const { error } = await supabaseAdmin.rpc('record_badminton_rally', {
        p_match_id: matchAId,
        p_game_id: gameA1Id,
        p_client_event_id: clientEventId,
        p_winner_side: 'SIDE_B', // Conflicting payload
      });

      expect(error).not.toBeNull();
      expect(error?.message).toContain('IDEMPOTENCY_CONFLICT');
    });
  });

  // 3. CONCURRENCY PROTECTION
  describe('3. Concurrency Protection', () => {
    it('safely serializes concurrent scoring requests without sequence collision or lost updates', async () => {
      const clientEventA = 'bbbbbbbb-1111-1111-1111-111111111111';
      const clientEventB = 'bbbbbbbb-2222-2222-2222-222222222222';

      // Launch both simultaneously against local Postgres
      const [resA, resB] = await Promise.all([
        supabaseAdmin.rpc('record_badminton_rally', {
          p_match_id: matchAId,
          p_game_id: gameA1Id,
          p_client_event_id: clientEventA,
          p_winner_side: 'SIDE_A',
        }),
        supabaseAdmin.rpc('record_badminton_rally', {
          p_match_id: matchAId,
          p_game_id: gameA1Id,
          p_client_event_id: clientEventB,
          p_winner_side: 'SIDE_B',
        }),
      ]);

      expect(resA.error).toBeNull();
      expect(resB.error).toBeNull();

      // Sequences must be strictly distinct: one got 3, one got 4
      const seqs = [resA.data.sequence_number, resB.data.sequence_number].sort((a, b) => a - b);
      expect(seqs).toEqual([3, 4]);

      // Check authoritative game state: 1+1 on A = 2, 1+1 on B = 2
      const { data: finalGame } = await supabaseAdmin
        .from('badminton_games')
        .select('side_a_points, side_b_points')
        .eq('id', gameA1Id)
        .single();
      expect(finalGame?.side_a_points).toBe(2);
      expect(finalGame?.side_b_points).toBe(2);
    });
  });

  // 4. DEUCE & SCORING RULES
  describe('4. BWF Deuce & Scoring Rules', () => {
    it('handles 20-20 deuce: 21-20 does NOT end the game', async () => {
      const clientEventId = 'cccccccc-1111-1111-1111-111111111111';
      const { data, error } = await supabaseAdmin.rpc('record_badminton_rally', {
        p_match_id: matchAId,
        p_game_id: gameDeuceId, // Starts at 20-20
        p_client_event_id: clientEventId,
        p_winner_side: 'SIDE_A',
      });

      expect(error).toBeNull();
      expect(data.score_after_side_a).toBe(21);
      expect(data.score_after_side_b).toBe(20);
      expect(data.is_game_completed).toBe(false); // Lead is only 1 point, continues!
    });

    it('handles 21-20: 22-20 achieves 2-point lead and completes the game', async () => {
      const clientEventId = 'cccccccc-2222-2222-2222-222222222222';
      const { data, error } = await supabaseAdmin.rpc('record_badminton_rally', {
        p_match_id: matchAId,
        p_game_id: gameDeuceId,
        p_client_event_id: clientEventId,
        p_winner_side: 'SIDE_A',
      });

      expect(error).toBeNull();
      expect(data.score_after_side_a).toBe(22);
      expect(data.score_after_side_b).toBe(20);
      expect(data.is_game_completed).toBe(true);
      expect(data.game_winner).toBe('SIDE_A');
    });

    it('rejects recording rally into already completed game', async () => {
      const clientEventId = 'cccccccc-3333-3333-3333-333333333333';
      const { error } = await supabaseAdmin.rpc('record_badminton_rally', {
        p_match_id: matchAId,
        p_game_id: gameDeuceId, // Just completed at 22-20
        p_client_event_id: clientEventId,
        p_winner_side: 'SIDE_B',
      });

      expect(error).not.toBeNull();
      expect(error?.message).toContain('GAME_COMPLETED');
    });

    it('handles sudden death hard cap at 30: 29-29 -> 30-29 wins game immediately', async () => {
      const clientEventId = 'dddddddd-1111-1111-1111-111111111111';
      const { data, error } = await supabaseAdmin.rpc('record_badminton_rally', {
        p_match_id: matchAId,
        p_game_id: gameCapId, // Starts at 29-29
        p_client_event_id: clientEventId,
        p_winner_side: 'SIDE_B',
      });

      expect(error).toBeNull();
      expect(data.score_after_side_a).toBe(29);
      expect(data.score_after_side_b).toBe(30);
      expect(data.is_game_completed).toBe(true);
      expect(data.game_winner).toBe('SIDE_B');
    });
  });

  // 5. PARTICIPANT VALIDATION
  describe('5. Participant Validation', () => {
    it('rejects participant from a different match', async () => {
      const clientEventId = 'eeeeeeee-1111-1111-1111-111111111111';
      const { error } = await supabaseAdmin.rpc('record_badminton_rally', {
        p_match_id: matchAId,
        p_game_id: gameA1Id,
        p_client_event_id: clientEventId,
        p_winner_side: 'SIDE_A',
        p_winning_participant_id: outsideParticipantId, // Belongs to Match B
      });

      expect(error).not.toBeNull();
      expect(error?.message).toContain('INVALID_PARTICIPANT');
    });

    it('rejects winning participant assigned to wrong competitor side', async () => {
      const clientEventId = 'eeeeeeee-2222-2222-2222-222222222222';
      const { error } = await supabaseAdmin.rpc('record_badminton_rally', {
        p_match_id: matchAId,
        p_game_id: gameA1Id,
        p_client_event_id: clientEventId,
        p_winner_side: 'SIDE_A',
        p_winning_participant_id: participantBId, // Belongs to SIDE_B
      });

      expect(error).not.toBeNull();
      expect(error?.message).toContain('INVALID_PARTICIPANT');
    });

    it('rejects server and receiver from the same side', async () => {
      const clientEventId = 'eeeeeeee-3333-3333-3333-333333333333';
      const { error } = await supabaseAdmin.rpc('record_badminton_rally', {
        p_match_id: matchAId,
        p_game_id: gameA1Id,
        p_client_event_id: clientEventId,
        p_winner_side: 'SIDE_A',
        p_server_participant_id: participantAId,
        p_receiver_participant_id: participantAId, // Same participant/side
      });

      expect(error).not.toBeNull();
      expect(error?.message).toContain('INVALID_RECEIVER');
    });
  });

  // 6. SOFT UNDO
  describe('6. Soft Undo & State Reconciliation', () => {
    it('safely voids latest rally and restores authoritative score without hard deleting', async () => {
      // In gameDeuce, rally 2 ended game at 22-20. Let's undo it.
      const { data, error } = await supabaseAdmin.rpc('undo_badminton_rally', {
        p_match_id: matchAId,
        p_game_id: gameDeuceId,
      });

      expect(error).toBeNull();
      expect(data.status).toBe('voided');
      expect(data.score_after_side_a).toBe(21);
      expect(data.score_after_side_b).toBe(20);
      expect(data.is_game_completed).toBe(false);

      // Verify row still exists in database with voided_at set
      const { data: rally } = await supabaseAdmin
        .from('badminton_rallies')
        .select('id, voided_at')
        .eq('id', data.undone_rally_id)
        .single();
      expect(rally).toBeDefined();
      expect(rally?.voided_at).not.toBeNull();
    });

    it('rejects undoing an older rally when a more recent active rally exists', async () => {
      // Attempt undo with specific arbitrary ID that is not the latest
      const fakeRallyId = '00000000-0000-0000-0000-000000000000';
      const { error } = await supabaseAdmin.rpc('undo_badminton_rally', {
        p_match_id: matchAId,
        p_game_id: gameDeuceId,
        p_rally_id: fakeRallyId,
      });

      expect(error).not.toBeNull();
      expect(error?.message).toContain('INVALID_UNDO');
    });
  });

  // 7. SPORT & TENANT ISOLATION
  describe('7. Sport & Tenant Isolation', () => {
    it('rejects Badminton scoring RPC when called on a Cricket match', async () => {
      const clientEventId = 'ffffffff-1111-1111-1111-111111111111';
      const { error } = await supabaseAdmin.rpc('record_badminton_rally', {
        p_match_id: cricketMatchId, // Cricket Match
        p_game_id: gameA1Id,
        p_client_event_id: clientEventId,
        p_winner_side: 'SIDE_A',
      });

      expect(error).not.toBeNull();
      expect(error?.message).toContain('INVALID_SPORT');
    });

    it('rejects anonymous unauthenticated users from recording rallies', async () => {
      const clientEventId = 'ffffffff-2222-2222-2222-222222222222';
      const { error } = await supabaseAnon.rpc('record_badminton_rally', {
        p_match_id: matchAId,
        p_game_id: gameA1Id,
        p_client_event_id: clientEventId,
        p_winner_side: 'SIDE_A',
      });

      expect(error).not.toBeNull();
      expect(error?.message).toContain('UNAUTHORIZED');
    });

    it('rejects anonymous unauthenticated users from undoing rallies', async () => {
      const { error } = await supabaseAnon.rpc('undo_badminton_rally', {
        p_match_id: matchAId,
        p_game_id: gameA1Id,
      });

      expect(error).not.toBeNull();
      expect(error?.message).toContain('UNAUTHORIZED');
    });
  });
});
