import { describe, it, expect, beforeAll } from 'vitest';
import { createClient, SupabaseClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });

describe('STEP 17E — Badminton Best-of-3 Match Progression, Completion & Live Centre', () => {
  let supabaseAdmin: SupabaseClient;
  let supabaseAnon: SupabaseClient;
  let badmintonSportId: string;
  let cricketSportId: string;
  let orgId: string;
  let competitorAId: string;
  let competitorBId: string;
  let participantAId: string;
  let participantBId: string;

  const userOwner = '11111111-1111-1111-1111-111111111111';
  const userScorer = '22222222-2222-2222-2222-222222222222';

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

    // Create an Organization
    const { data: org } = await supabaseAdmin
      .from('organizations')
      .insert({
        name: 'Progression Test Badminton Arena',
        slug: 'progression-arena-' + Date.now(),
        status: 'ACTIVE',
      })
      .select('id')
      .single();
    orgId = org!.id;

    // Membership for Owner and Scorer
    await supabaseAdmin.from('organization_members').upsert([
      { organization_id: orgId, user_id: userOwner, role: 'OWNER', status: 'ACTIVE' },
      { organization_id: orgId, user_id: userScorer, role: 'MEMBER', status: 'ACTIVE' },
    ]);
  });

  // Helper to create a ready-to-score Badminton match
  async function createBadmintonMatch(matchTitle: string) {
    const now = new Date();
    const scheduledStart = new Date(now.getTime() + 60000).toISOString();
    const scheduledEnd = new Date(now.getTime() + 3600000).toISOString();

    const { data: match, error: matchErr } = await supabaseAdmin
      .from('matches')
      .insert({
        organization_id: orgId,
        sport_id: badmintonSportId,
        title: matchTitle,
        status: 'DRAFT',
        match_format: 'SINGLES',
        created_by: userOwner,
        scorer_user_id: userScorer,
        scheduled_start: scheduledStart,
        scheduled_end: scheduledEnd,
      })
      .select('id')
      .single();

    if (matchErr) throw new Error('createBadmintonMatch failed: ' + matchErr.message);
    const matchId = match!.id;

    // Competitors
    const { data: compA } = await supabaseAdmin
      .from('match_competitors')
      .insert({
        match_id: matchId,
        side: 'SIDE_A',
        competitor_name: 'Player Alpha',
      })
      .select('id')
      .single();

    const { data: compB } = await supabaseAdmin
      .from('match_competitors')
      .insert({
        match_id: matchId,
        side: 'SIDE_B',
        competitor_name: 'Player Beta',
      })
      .select('id')
      .single();

    // Participants
    const { data: partA } = await supabaseAdmin
      .from('match_participants')
      .insert({
        match_id: matchId,
        competitor_id: compA!.id,
        display_name: 'Alpha P1',
      })
      .select('id')
      .single();

    const { data: partB } = await supabaseAdmin
      .from('match_participants')
      .insert({
        match_id: matchId,
        competitor_id: compB!.id,
        display_name: 'Beta P1',
      })
      .select('id')
      .single();

    // Transition to LIVE: DRAFT -> SCHEDULED -> WARMUP -> LIVE
    await supabaseAdmin.from('matches').update({ status: 'SCHEDULED' }).eq('id', matchId);
    await supabaseAdmin.from('matches').update({ status: 'WARMUP' }).eq('id', matchId);
    await supabaseAdmin.from('matches').update({ status: 'LIVE' }).eq('id', matchId);

    return {
      matchId,
      compAId: compA!.id,
      compBId: compB!.id,
      partAId: partA!.id,
      partBId: partB!.id,
    };
  }

  // Helper to simulate completing a game with arbitrary final scores
  async function completeGameDirectly(
    matchId: string,
    gameNumber: number,
    sideAPoints: number,
    sideBPoints: number,
    winnerSide: 'SIDE_A' | 'SIDE_B'
  ) {
    const { data: game } = await supabaseAdmin
      .from('badminton_games')
      .insert({
        match_id: matchId,
        game_number: gameNumber,
        side_a_points: sideAPoints,
        side_b_points: sideBPoints,
        is_completed: true,
        winner_side: winnerSide,
        serving_side: winnerSide,
        points_to_win: 21,
        win_by: 2,
        max_points: 30,
      })
      .select('id')
      .single();

    return game!.id;
  }

  it('1. Initializes Game 1 if no games exist when progress_badminton_match is invoked', async () => {
    const { matchId, partAId, partBId } = await createBadmintonMatch('Game 1 Init Match');

    const { data, error } = await supabaseAdmin.rpc('progress_badminton_match', {
      p_match_id: matchId,
    });

    expect(error).toBeNull();
    expect(data.status).toBe('game_created');
    expect(data.game_number).toBe(1);
    expect(data.is_match_completed).toBe(false);

    // Verify DB record
    const { data: dbGames } = await supabaseAdmin
      .from('badminton_games')
      .select('*')
      .eq('match_id', matchId);

    expect(dbGames?.length).toBe(1);
    expect(dbGames![0].game_number).toBe(1);
    expect(dbGames![0].side_a_points).toBe(0);
    expect(dbGames![0].side_b_points).toBe(0);
    expect(dbGames![0].is_completed).toBe(false);
  });

  it('2. Guards against progression while the current game is still in progress', async () => {
    const { matchId } = await createBadmintonMatch('In Progress Guard Match');

    // Create an uncompleted Game 1
    await supabaseAdmin.from('badminton_games').insert({
      match_id: matchId,
      game_number: 1,
      side_a_points: 15,
      side_b_points: 12,
      is_completed: false,
    });

    const { data, error } = await supabaseAdmin.rpc('progress_badminton_match', {
      p_match_id: matchId,
    });

    expect(error).toBeNull();
    expect(data.status).toBe('game_in_progress');
    expect(data.game_number).toBe(1);
    expect(data.is_match_completed).toBe(false);

    // Verify no Game 2 was created
    const { count } = await supabaseAdmin
      .from('badminton_games')
      .select('*', { count: 'exact', head: true })
      .eq('match_id', matchId);

    expect(count).toBe(1);
  });

  it('3. Scenario A: Side A wins Game 1 and Game 2 -> Match completed (2-0), Game 3 never created', async () => {
    const { matchId } = await createBadmintonMatch('Scenario A: 2-0 Side A');

    // Complete Game 1 for Side A (21-15)
    await completeGameDirectly(matchId, 1, 21, 15, 'SIDE_A');

    // Progress -> Game 2 should be created
    const prog1 = await supabaseAdmin.rpc('progress_badminton_match', {
      p_match_id: matchId,
    });
    expect(prog1.error).toBeNull();
    expect(prog1.data.status).toBe('game_created');
    expect(prog1.data.game_number).toBe(2);
    expect(prog1.data.is_match_completed).toBe(false);
    expect(prog1.data.serving_side).toBe('SIDE_A'); // BWF rule: Game 1 winner serves first

    // Complete Game 2 for Side A (21-18)
    await supabaseAdmin
      .from('badminton_games')
      .update({
        side_a_points: 21,
        side_b_points: 18,
        is_completed: true,
        winner_side: 'SIDE_A',
      })
      .eq('match_id', matchId)
      .eq('game_number', 2);

    // Progress -> Match should be COMPLETED!
    const prog2 = await supabaseAdmin.rpc('progress_badminton_match', {
      p_match_id: matchId,
    });
    expect(prog2.error).toBeNull();
    expect(prog2.data.status).toBe('match_completed');
    expect(prog2.data.is_match_completed).toBe(true);
    expect(prog2.data.match_winner).toBe('SIDE_A');
    expect(prog2.data.side_a_games_won).toBe(2);
    expect(prog2.data.side_b_games_won).toBe(0);

    // Check match record in DB
    const { data: matchRecord } = await supabaseAdmin
      .from('matches')
      .select('*')
      .eq('id', matchId)
      .single();

    expect(matchRecord.status).toBe('COMPLETED');
    expect(matchRecord.winner_side).toBe('SIDE_A');
    expect(matchRecord.result_summary).toContain('Player Alpha won 2-0');
    expect(matchRecord.actual_end).not.toBeNull();

    // Verify competitor records updated
    const { data: competitors } = await supabaseAdmin
      .from('match_competitors')
      .select('*')
      .eq('match_id', matchId);

    const compA = competitors?.find((c) => c.side === 'SIDE_A');
    const compB = competitors?.find((c) => c.side === 'SIDE_B');
    expect(compA?.is_winner).toBe(true);
    expect(compB?.is_winner).toBe(false);

    // Verify exactly 2 games exist, no Game 3
    const { count } = await supabaseAdmin
      .from('badminton_games')
      .select('*', { count: 'exact', head: true })
      .eq('match_id', matchId);

    expect(count).toBe(2);
  });

  it('4. Scenario B: Game 1 Side A wins, Game 2 Side B wins -> Game 3 created -> Side B wins Game 3 -> Match completed (2-1)', async () => {
    const { matchId } = await createBadmintonMatch('Scenario B: 2-1 Side B');

    // Game 1: Side A wins (21-19)
    await completeGameDirectly(matchId, 1, 21, 19, 'SIDE_A');

    // Progress to Game 2
    const p1 = await supabaseAdmin.rpc('progress_badminton_match', { p_match_id: matchId });
    expect(p1.data.status).toBe('game_created');
    expect(p1.data.game_number).toBe(2);

    // Game 2: Side B wins (18-21)
    await supabaseAdmin
      .from('badminton_games')
      .update({
        side_a_points: 18,
        side_b_points: 21,
        is_completed: true,
        winner_side: 'SIDE_B',
      })
      .eq('match_id', matchId)
      .eq('game_number', 2);

    // Progress to Game 3!
    const p2 = await supabaseAdmin.rpc('progress_badminton_match', { p_match_id: matchId });
    expect(p2.error).toBeNull();
    expect(p2.data.status).toBe('game_created');
    expect(p2.data.game_number).toBe(3);
    expect(p2.data.is_match_completed).toBe(false);
    expect(p2.data.serving_side).toBe('SIDE_B'); // Game 2 winner serves first in Game 3

    // Game 3: Side B wins (19-21)
    await supabaseAdmin
      .from('badminton_games')
      .update({
        side_a_points: 19,
        side_b_points: 21,
        is_completed: true,
        winner_side: 'SIDE_B',
      })
      .eq('match_id', matchId)
      .eq('game_number', 3);

    // Progress -> Match Completed!
    const p3 = await supabaseAdmin.rpc('progress_badminton_match', { p_match_id: matchId });
    expect(p3.error).toBeNull();
    expect(p3.data.status).toBe('match_completed');
    expect(p3.data.is_match_completed).toBe(true);
    expect(p3.data.match_winner).toBe('SIDE_B');
    expect(p3.data.side_a_games_won).toBe(1);
    expect(p3.data.side_b_games_won).toBe(2);

    // DB verification
    const { data: matchRecord } = await supabaseAdmin
      .from('matches')
      .select('*')
      .eq('id', matchId)
      .single();

    expect(matchRecord.status).toBe('COMPLETED');
    expect(matchRecord.winner_side).toBe('SIDE_B');
    expect(matchRecord.result_summary).toContain('Player Beta won 2-1');
  });

  it('5. Scenario C: Side B wins first two games -> Match completed (0-2), no Game 3', async () => {
    const { matchId } = await createBadmintonMatch('Scenario C: 0-2 Side B');

    // Game 1: Side B wins (14-21)
    await completeGameDirectly(matchId, 1, 14, 21, 'SIDE_B');

    // Progress to Game 2
    await supabaseAdmin.rpc('progress_badminton_match', { p_match_id: matchId });

    // Game 2: Side B wins (16-21)
    await supabaseAdmin
      .from('badminton_games')
      .update({
        side_a_points: 16,
        side_b_points: 21,
        is_completed: true,
        winner_side: 'SIDE_B',
      })
      .eq('match_id', matchId)
      .eq('game_number', 2);

    // Progress -> Match Completed
    const p2 = await supabaseAdmin.rpc('progress_badminton_match', { p_match_id: matchId });
    expect(p2.data.status).toBe('match_completed');
    expect(p2.data.match_winner).toBe('SIDE_B');
    expect(p2.data.side_b_games_won).toBe(2);

    // No game 3
    const { count } = await supabaseAdmin
      .from('badminton_games')
      .select('*', { count: 'exact', head: true })
      .eq('match_id', matchId);

    expect(count).toBe(2);
  });

  it('6. Idempotency & Concurrency: Simultaneous requests safely produce exactly one Game 2', async () => {
    const { matchId } = await createBadmintonMatch('Concurrent Test Match');

    // Game 1 complete
    await completeGameDirectly(matchId, 1, 21, 17, 'SIDE_A');

    // Fire 4 simultaneous progression requests
    const promises = [
      supabaseAdmin.rpc('progress_badminton_match', { p_match_id: matchId }),
      supabaseAdmin.rpc('progress_badminton_match', { p_match_id: matchId }),
      supabaseAdmin.rpc('progress_badminton_match', { p_match_id: matchId }),
      supabaseAdmin.rpc('progress_badminton_match', { p_match_id: matchId }),
    ];

    const results = await Promise.all(promises);

    // All should succeed without error
    results.forEach((res) => {
      expect(res.error).toBeNull();
    });

    // Exactly one Game 2 exists
    const { data: games } = await supabaseAdmin
      .from('badminton_games')
      .select('game_number')
      .eq('match_id', matchId);

    expect(games?.length).toBe(2);
    const gameNumbers = games?.map((g) => g.game_number).sort();
    expect(gameNumbers).toEqual([1, 2]);
  });

  it('7. Completed match cannot start another game', async () => {
    const { matchId } = await createBadmintonMatch('Completed Match Boundary');

    await completeGameDirectly(matchId, 1, 21, 10, 'SIDE_A');
    await completeGameDirectly(matchId, 2, 21, 10, 'SIDE_A');

    // Complete match
    await supabaseAdmin.rpc('progress_badminton_match', { p_match_id: matchId });

    // Call progress again
    const repeatRes = await supabaseAdmin.rpc('progress_badminton_match', { p_match_id: matchId });
    expect(repeatRes.error).toBeNull();
    expect(repeatRes.data.status).toBe('match_completed');
    expect(repeatRes.data.is_match_completed).toBe(true);

    // Still exactly 2 games
    const { count } = await supabaseAdmin
      .from('badminton_games')
      .select('*', { count: 'exact', head: true })
      .eq('match_id', matchId);

    expect(count).toBe(2);
  });

  it('8. Cross-sport rejection: Cannot progress a Cricket match with Badminton RPC', async () => {
    const now = new Date();
    const { data: cricketMatch, error: cErr } = await supabaseAdmin
      .from('matches')
      .insert({
        organization_id: orgId,
        sport_id: cricketSportId,
        title: 'Cricket Match Boundary Test',
        status: 'DRAFT',
        match_format: 'TEAM',
        created_by: userOwner,
        scorer_user_id: userScorer,
        scheduled_start: now.toISOString(),
        scheduled_end: new Date(now.getTime() + 3600000).toISOString(),
      })
      .select('id')
      .single();

    if (cErr) throw new Error('Failed to create cricket match: ' + cErr.message);

    const cMatchId = cricketMatch!.id;
    const { data: cCompA } = await supabaseAdmin
      .from('match_competitors')
      .insert({ match_id: cMatchId, side: 'SIDE_A', competitor_name: 'Team 1' })
      .select('id').single();
    const { data: cCompB } = await supabaseAdmin
      .from('match_competitors')
      .insert({ match_id: cMatchId, side: 'SIDE_B', competitor_name: 'Team 2' })
      .select('id').single();

    await supabaseAdmin
      .from('match_participants')
      .insert({ match_id: cMatchId, competitor_id: cCompA!.id, display_name: 'P1' });
    await supabaseAdmin
      .from('match_participants')
      .insert({ match_id: cMatchId, competitor_id: cCompB!.id, display_name: 'P2' });

    await supabaseAdmin.from('matches').update({ status: 'SCHEDULED' }).eq('id', cMatchId);
    await supabaseAdmin.from('matches').update({ status: 'WARMUP' }).eq('id', cMatchId);
    await supabaseAdmin.from('matches').update({ status: 'LIVE' }).eq('id', cMatchId);

    const { data, error } = await supabaseAdmin.rpc('progress_badminton_match', {
      p_match_id: cMatchId,
    });

    expect(error).not.toBeNull();
    expect(error?.message).toContain('INVALID_SPORT');
  });

  it('9. Authoritative Scorecard RPC returns full match, games, competitor details, and recent rallies', async () => {
    const { matchId } = await createBadmintonMatch('Full Scorecard Match');

    // Add 2 completed games and 1 live game
    await completeGameDirectly(matchId, 1, 21, 15, 'SIDE_A');
    await completeGameDirectly(matchId, 2, 19, 21, 'SIDE_B');
    const { data: game3 } = await supabaseAdmin
      .from('badminton_games')
      .insert({
        match_id: matchId,
        game_number: 3,
        side_a_points: 8,
        side_b_points: 6,
        serving_side: 'SIDE_A',
        is_completed: false,
      })
      .select('id')
      .single();

    // Add a rally to game 3
    const { error: rallyErr } = await supabaseAdmin.from('badminton_rallies').insert({
      match_id: matchId,
      game_id: game3!.id,
      sequence_number: 1,
      server_side: 'SIDE_A',
      winner_side: 'SIDE_A',
      score_after_side_a: 8,
      score_after_side_b: 6,
      rally_type: 'SMASH',
      client_event_id: crypto.randomUUID(),
    });

    expect(rallyErr).toBeNull();

    // Call get_badminton_match_scorecard RPC
    const { data: scorecard, error } = await supabaseAnon.rpc('get_badminton_match_scorecard', {
      p_match_id: matchId,
    });

    expect(error).toBeNull();
    expect(scorecard.match.id).toBe(matchId);
    expect(scorecard.match.sport_slug).toBe('badminton');
    expect(scorecard.competitor_a.name).toBe('Player Alpha');
    expect(scorecard.competitor_b.name).toBe('Player Beta');
    expect(scorecard.competitor_a.games_won).toBe(1);
    expect(scorecard.competitor_b.games_won).toBe(1);
    expect(scorecard.games.length).toBe(3);
    expect(scorecard.current_game.game_number).toBe(3);
    expect(scorecard.current_game.side_a_points).toBe(8);
    expect(scorecard.current_game.side_b_points).toBe(6);
    expect(scorecard.recent_rallies.length).toBe(1);
    expect(scorecard.recent_rallies[0].rally_type).toBe('SMASH');
    expect(scorecard.summary.is_match_completed).toBe(false);
  });

  it('10. Public spectator cannot mutate match data or progress games', async () => {
    const { matchId } = await createBadmintonMatch('Spectator Mutation Guard');

    await completeGameDirectly(matchId, 1, 21, 16, 'SIDE_A');

    // Attempt progress from anon client
    const { error: anonProgErr } = await supabaseAnon.rpc('progress_badminton_match', {
      p_match_id: matchId,
    });

    expect(anonProgErr).not.toBeNull();
    // Anon users cannot progress matches: blocked by FOR UPDATE lock or authorization check
    expect(anonProgErr?.message).toMatch(/UNAUTHORIZED|NOT_FOUND/);

    // Attempt direct insert into badminton_games by anon
    const { error: insertErr } = await supabaseAnon
      .from('badminton_games')
      .insert({
        match_id: matchId,
        game_number: 2,
        side_a_points: 0,
        side_b_points: 0,
      });

    expect(insertErr).not.toBeNull(); // Blocked by RLS
  });
});
