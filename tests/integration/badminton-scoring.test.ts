import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { createClient, SupabaseClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });

describe('STEP 17B — Badminton Scoring Database Foundation Integration Tests', () => {
  let supabaseAdmin: SupabaseClient;
  let supabaseAnon: SupabaseClient;
  let badmintonSportId: string;
  let cricketSportId: string;
  let testMatchId: string;
  let nonBadmintonMatchId: string;
  let competitorAId: string;
  let competitorBId: string;
  let participantAId: string;
  let participantBId: string;
  let testGameId: string;

  beforeAll(async () => {
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || 'http://127.0.0.1:54321';
    const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || '';
    const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '';

    supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey);
    supabaseAnon = createClient(supabaseUrl, supabaseAnonKey);

    // Fetch Badminton & Cricket sport IDs
    const { data: sports } = await supabaseAdmin.from('sports').select('id, slug');
    const badminton = sports?.find((s) => s.slug === 'badminton');
    const cricket = sports?.find((s) => s.slug === 'cricket');

    if (!badminton) throw new Error('Badminton sport not found in database');
    badmintonSportId = badminton.id;
    cricketSportId = cricket?.id || '';

    // Seeded user ID from profiles/auth.users
    const dummyUserId = '11111111-1111-1111-1111-111111111111';
    const now = new Date();
    const scheduledStart = new Date(now.getTime() + 60000).toISOString();
    const scheduledEnd = new Date(now.getTime() + 3600000).toISOString();

    // 1. Create match in DRAFT
    const { data: match, error: matchErr } = await supabaseAdmin
      .from('matches')
      .insert({
        sport_id: badmintonSportId,
        match_format: 'SINGLES',
        status: 'DRAFT',
        scheduled_start: scheduledStart,
        scheduled_end: scheduledEnd,
        created_by: dummyUserId,
        title: 'Badminton Championship Game 1',
      })
      .select()
      .single();

    if (matchErr) throw new Error(`Failed to create test match: ${matchErr.message}`);
    testMatchId = match.id;

    // 2. Create competitors
    const { data: compA } = await supabaseAdmin
      .from('match_competitors')
      .insert({
        match_id: testMatchId,
        side: 'SIDE_A',
        competitor_name: 'Player One',
      })
      .select()
      .single();
    competitorAId = compA.id;

    const { data: compB } = await supabaseAdmin
      .from('match_competitors')
      .insert({
        match_id: testMatchId,
        side: 'SIDE_B',
        competitor_name: 'Player Two',
      })
      .select()
      .single();
    competitorBId = compB.id;

    // 3. Create participants
    const { data: partA } = await supabaseAdmin
      .from('match_participants')
      .insert({
        match_id: testMatchId,
        competitor_id: competitorAId,
        display_name: 'Player One',
      })
      .select()
      .single();
    participantAId = partA.id;

    const { data: partB } = await supabaseAdmin
      .from('match_participants')
      .insert({
        match_id: testMatchId,
        competitor_id: competitorBId,
        display_name: 'Player Two',
      })
      .select()
      .single();
    participantBId = partB.id;

    // 4. Transition match: DRAFT -> SCHEDULED -> WARMUP -> LIVE
    await supabaseAdmin.from('matches').update({ status: 'SCHEDULED' }).eq('id', testMatchId);
    await supabaseAdmin.from('matches').update({ status: 'WARMUP' }).eq('id', testMatchId);
    await supabaseAdmin.from('matches').update({ status: 'LIVE' }).eq('id', testMatchId);

    // Create non-badminton match to test sport constraint
    if (cricketSportId) {
      const { data: nonBadminton } = await supabaseAdmin
        .from('matches')
        .insert({
          sport_id: cricketSportId,
          match_format: 'TEAM',
          status: 'DRAFT',
          scheduled_start: scheduledStart,
          scheduled_end: scheduledEnd,
          created_by: dummyUserId,
          title: 'Cricket Match Not Badminton',
        })
        .select()
        .single();
      if (nonBadminton) {
        nonBadmintonMatchId = nonBadminton.id;
      }
    }
  }, 15000);

  afterAll(async () => {
    // Cleanup created test records
    if (testMatchId) {
      await supabaseAdmin.from('matches').delete().eq('id', testMatchId);
    }
    if (nonBadmintonMatchId) {
      await supabaseAdmin.from('matches').delete().eq('id', nonBadmintonMatchId);
    }
  });

  it('1. verifies badminton_games and badminton_rallies tables exist', async () => {
    const { error: gamesErr } = await supabaseAdmin.from('badminton_games').select('id').limit(1);
    expect(gamesErr).toBeNull();

    const { error: ralliesErr } = await supabaseAdmin.from('badminton_rallies').select('id').limit(1);
    expect(ralliesErr).toBeNull();
  });

  it('2. verifies valid game insertion', async () => {
    const { data: game, error } = await supabaseAdmin
      .from('badminton_games')
      .insert({
        match_id: testMatchId,
        game_number: 1,
        side_a_points: 0,
        side_b_points: 0,
        serving_side: 'SIDE_A',
        server_participant_id: participantAId,
        receiver_participant_id: participantBId,
        points_to_win: 21,
        win_by: 2,
        max_points: 30,
      })
      .select()
      .single();

    expect(error).toBeNull();
    expect(game).toBeDefined();
    expect(game.game_number).toBe(1);
    testGameId = game.id;
  });

  it('3. rejects invalid game configuration (points_to_win > max_points or invalid numbers)', async () => {
    const { error } = await supabaseAdmin.from('badminton_games').insert({
      match_id: testMatchId,
      game_number: 2,
      points_to_win: 35,
      max_points: 30, // violates max_points >= points_to_win
    });
    expect(error).not.toBeNull();
  });

  it('4. rejects duplicate game number for the same match', async () => {
    const { error } = await supabaseAdmin.from('badminton_games').insert({
      match_id: testMatchId,
      game_number: 1, // Already exists from test 2
    });
    expect(error).not.toBeNull();
  });

  it('5. rejects game creation for non-badminton match (check_badminton_game_match trigger)', async () => {
    if (!nonBadmintonMatchId) return;
    const { error } = await supabaseAdmin.from('badminton_games').insert({
      match_id: nonBadmintonMatchId,
      game_number: 1,
    });
    expect(error).not.toBeNull();
    expect(error?.message).toContain('Match sport must be Badminton');
  });

  it('6. verifies valid rally insertion', async () => {
    const clientEventId = '11111111-1111-1111-1111-111111111111';
    const { data: rally, error } = await supabaseAdmin
      .from('badminton_rallies')
      .insert({
        match_id: testMatchId,
        game_id: testGameId,
        sequence_number: 1,
        winner_side: 'SIDE_A',
        winning_participant_id: participantAId,
        server_side: 'SIDE_A',
        server_participant_id: participantAId,
        receiver_participant_id: participantBId,
        rally_type: 'SMASH',
        score_after_side_a: 1,
        score_after_side_b: 0,
        client_event_id: clientEventId,
      })
      .select()
      .single();

    expect(error).toBeNull();
    expect(rally).toBeDefined();
    expect(rally.sequence_number).toBe(1);
    expect(rally.rally_type).toBe('SMASH');
  });

  it('7. rejects duplicate sequence number for the same game', async () => {
    const { error } = await supabaseAdmin.from('badminton_rallies').insert({
      match_id: testMatchId,
      game_id: testGameId,
      sequence_number: 1, // already used
      winner_side: 'SIDE_B',
      server_side: 'SIDE_A',
      score_after_side_a: 1,
      score_after_side_b: 1,
      client_event_id: '22222222-2222-2222-2222-222222222222',
    });
    expect(error).not.toBeNull();
  });

  it('8. rejects duplicate client_event_id for idempotency protection', async () => {
    const clientEventId = '11111111-1111-1111-1111-111111111111'; // already used in test 6
    const { error } = await supabaseAdmin.from('badminton_rallies').insert({
      match_id: testMatchId,
      game_id: testGameId,
      sequence_number: 2,
      winner_side: 'SIDE_A',
      server_side: 'SIDE_A',
      score_after_side_a: 2,
      score_after_side_b: 0,
      client_event_id: clientEventId,
    });
    expect(error).not.toBeNull();
  });

  it('9. rejects invalid winner_side', async () => {
    const { error } = await supabaseAdmin.from('badminton_rallies').insert({
      match_id: testMatchId,
      game_id: testGameId,
      sequence_number: 2,
      winner_side: 'DRAW', // Not permitted in badminton rallies
      server_side: 'SIDE_A',
      score_after_side_a: 2,
      score_after_side_b: 0,
      client_event_id: '33333333-3333-3333-3333-333333333333',
    });
    expect(error).not.toBeNull();
  });

  it('10. rejects negative scores in rally snapshot', async () => {
    const { error } = await supabaseAdmin.from('badminton_rallies').insert({
      match_id: testMatchId,
      game_id: testGameId,
      sequence_number: 2,
      winner_side: 'SIDE_A',
      server_side: 'SIDE_A',
      score_after_side_a: -1, // Invalid negative score
      score_after_side_b: 0,
      client_event_id: '44444444-4444-4444-4444-444444444444',
    });
    expect(error).not.toBeNull();
  });

  it('11. verifies cross-match integrity (rally match_id must match game match_id)', async () => {
    if (!nonBadmintonMatchId) return;
    const { error } = await supabaseAdmin.from('badminton_rallies').insert({
      match_id: nonBadmintonMatchId, // Mismatched match_id
      game_id: testGameId,
      sequence_number: 2,
      winner_side: 'SIDE_A',
      server_side: 'SIDE_A',
      score_after_side_a: 2,
      score_after_side_b: 0,
      client_event_id: '55555555-5555-5555-5555-555555555555',
    });
    expect(error).not.toBeNull();
    expect(error?.message).toContain('Rally game_id does not belong to the same match');
  });

  it('12. verifies RLS public read access for LIVE matches via anon client', async () => {
    const { data: games, error: gamesErr } = await supabaseAnon
      .from('badminton_games')
      .select('*')
      .eq('match_id', testMatchId);
    expect(gamesErr).toBeNull();
    expect(games?.length).toBeGreaterThan(0);

    const { data: rallies, error: ralliesErr } = await supabaseAnon
      .from('badminton_rallies')
      .select('*')
      .eq('match_id', testMatchId);
    expect(ralliesErr).toBeNull();
    expect(rallies?.length).toBeGreaterThan(0);
  });

  it('13. verifies unauthorized anon mutation is rejected by RLS', async () => {
    const { error: insertErr } = await supabaseAnon.from('badminton_games').insert({
      match_id: testMatchId,
      game_number: 2,
    });
    expect(insertErr).not.toBeNull();

    const { error: rallyErr } = await supabaseAnon.from('badminton_rallies').insert({
      match_id: testMatchId,
      game_id: testGameId,
      sequence_number: 2,
      winner_side: 'SIDE_A',
      server_side: 'SIDE_A',
      score_after_side_a: 2,
      score_after_side_b: 0,
      client_event_id: '66666666-6666-6666-6666-666666666666',
    });
    expect(rallyErr).not.toBeNull();
  });

  it('14. verifies soft-undo column availability (voided_at)', async () => {
    const { data: rally } = await supabaseAdmin
      .from('badminton_rallies')
      .select('voided_at')
      .eq('game_id', testGameId)
      .single();
    expect(rally).toBeDefined();
    expect(rally?.voided_at).toBeNull();

    // Verify updating voided_at succeeds
    const { error: updateErr } = await supabaseAdmin
      .from('badminton_rallies')
      .update({ voided_at: new Date().toISOString() })
      .eq('game_id', testGameId)
      .eq('sequence_number', 1);
    expect(updateErr).toBeNull();
  });

  it('15. verifies direct DELETE is denied for authenticated non-admin or public', async () => {
    // Attempt delete via anon client
    const { error: deleteErr } = await supabaseAnon
      .from('badminton_rallies')
      .delete()
      .eq('game_id', testGameId);

    // In Supabase RLS, delete without policy succeeds with 0 affected rows (or returns error if returning data)
    // Verify that the rally was NOT deleted from the database
    const { data: remainingRallies } = await supabaseAdmin
      .from('badminton_rallies')
      .select('id')
      .eq('game_id', testGameId);

    expect(remainingRallies?.length).toBeGreaterThan(0);
  });
});
