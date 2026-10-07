import { describe, it, expect, beforeAll } from 'vitest';
import { createClient, SupabaseClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });

describe('SPORTSHUB STEP 20C — Basketball Atomic Scoring & Game Clock Backend Tests', () => {
  let supabaseAdmin: SupabaseClient;
  let supabaseAnon: SupabaseClient;
  let basketballSportId: string;
  let cricketSportId: string;
  let badmintonSportId: string;
  let orgId: string;
  let teamAId: string;
  let teamBId: string;
  let userOwner: string;

  beforeAll(async () => {
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || 'http://127.0.0.1:54321';
    const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || '';
    const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '';

    supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey);
    supabaseAnon = createClient(supabaseUrl, supabaseAnonKey);

    // Fetch Sports
    const { data: sports } = await supabaseAdmin.from('sports').select('id, slug, supports_live_scoring');
    const bball = sports?.find((s) => s.slug === 'basketball');
    const cricket = sports?.find((s) => s.slug === 'cricket');
    const badminton = sports?.find((s) => s.slug === 'badminton');

    expect(bball).toBeDefined();
    expect(cricket).toBeDefined();
    expect(badminton).toBeDefined();
    basketballSportId = bball!.id;
    cricketSportId = cricket!.id;
    badmintonSportId = badminton!.id;

    // Fetch user owner
    const { data: profiles } = await supabaseAdmin.from('profiles').select('id').limit(1);
    userOwner = profiles![0].id;

    // Create an Organization
    const { data: org, error: orgErr } = await supabaseAdmin
      .from('organizations')
      .insert({
        name: 'Step 20C Arena ' + Date.now(),
        slug: 'bball-20c-' + Date.now(),
        status: 'ACTIVE',
      })
      .select('id')
      .single();
    expect(orgErr).toBeNull();
    orgId = org!.id;

    // Create 2 Teams
    const { data: teamA } = await supabaseAdmin
      .from('teams')
      .insert({
        name: 'Alpha Stars ' + Date.now(),
        sport_id: basketballSportId,
        organization_id: orgId,
        created_by: userOwner,
      })
      .select('id')
      .single();
    teamAId = teamA!.id;

    const { data: teamB } = await supabaseAdmin
      .from('teams')
      .insert({
        name: 'Bravo Bulls ' + Date.now(),
        sport_id: basketballSportId,
        organization_id: orgId,
        created_by: userOwner,
      })
      .select('id')
      .single();
    teamBId = teamB!.id;
  });

  // Helper to create a basketball match with competitors and 7 participants each (5 starters + 2 bench)
  async function createBasketballMatch(title: string, configOverrides: Record<string, unknown> = {}) {
    const now = new Date();
    const scheduledStart = new Date(now.getTime() + 60000).toISOString();
    const scheduledEnd = new Date(now.getTime() + 7200000).toISOString();

    const basketballConfig = {
      format: '5V5',
      players_on_court: 5,
      regulation_period_count: 4,
      period_duration_seconds: 600,
      overtime_enabled: true,
      overtime_duration_seconds: 300,
      foul_out_limit: 5,
      team_foul_penalty_threshold: 5,
      timeouts_per_team_regulation: 4,
      timeouts_per_team_overtime: 1,
      ...configOverrides,
    };

    const { data: match, error: matchErr } = await supabaseAdmin
      .from('matches')
      .insert({
        title,
        sport_id: basketballSportId,
        organization_id: orgId,
        match_format: 'TEAM',
        status: 'DRAFT',
        scheduled_start: scheduledStart,
        scheduled_end: scheduledEnd,
        created_by: userOwner,
        metadata: {
          basketball_config: basketballConfig,
        },
      })
      .select('id')
      .single();

    if (matchErr) throw new Error(matchErr.message);

    // Create Competitors Side A & Side B
    const { data: compA } = await supabaseAdmin
      .from('match_competitors')
      .insert({
        match_id: match!.id,
        side: 'SIDE_A',
        team_id: teamAId,
        competitor_name: 'Alpha Stars',
      })
      .select('id')
      .single();

    const { data: compB } = await supabaseAdmin
      .from('match_competitors')
      .insert({
        match_id: match!.id,
        side: 'SIDE_B',
        team_id: teamBId,
        competitor_name: 'Bravo Bulls',
      })
      .select('id')
      .single();

    // Create 7 participants for each team (5 starters, 2 bench substitutes)
    const partAIds: string[] = [];
    const partBIds: string[] = [];

    for (let i = 1; i <= 7; i++) {
      const { data: pA } = await supabaseAdmin
        .from('match_participants')
        .insert({
          match_id: match!.id,
          competitor_id: compA!.id,
          display_name: `Alpha Player ${i}`,
          role: 'PLAYER',
          jersey_number: i,
        })
        .select('id')
        .single();
      partAIds.push(pA!.id);

      const { data: pB } = await supabaseAdmin
        .from('match_participants')
        .insert({
          match_id: match!.id,
          competitor_id: compB!.id,
          display_name: `Bravo Player ${i}`,
          role: 'PLAYER',
          jersey_number: 10 + i,
        })
        .select('id')
        .single();
      partBIds.push(pB!.id);
    }

    return {
      matchId: match!.id,
      compAId: compA!.id,
      compBId: compB!.id,
      partAIds,
      partBIds,
      startersA: partAIds.slice(0, 5),
      benchA: partAIds.slice(5),
      startersB: partBIds.slice(0, 5),
      benchB: partBIds.slice(5),
    };
  }

  // 1. Initialization RPC tests
  describe('1. init_basketball_match', () => {
    it('initializes match with 5 starters per team, Q1 period, and STOPPED clock', async () => {
      const { matchId, startersA, startersB } = await createBasketballMatch('Init Test');

      const { data, error } = await supabaseAdmin.rpc('init_basketball_match', {
        p_match_id: matchId,
        p_starters_side_a: startersA,
        p_starters_side_b: startersB,
      });

      expect(error).toBeNull();
      expect(data.status).toBe('initialized');
      expect(data.period_number).toBe(1);
      expect(data.duration_seconds).toBe(600);
      expect(data.time_remaining_seconds).toBe(600);
      expect(data.clock_status).toBe('STOPPED');

      // Verify lineups in database
      const { data: onCourtA } = await supabaseAdmin
        .from('basketball_lineups')
        .select('*')
        .eq('match_id', matchId)
        .eq('is_on_court', true);

      expect(onCourtA?.length).toBe(10); // 5 for team A + 5 for team B
    });

    it('rejects initialization with invalid starter count (e.g. 4 starters)', async () => {
      const { matchId, startersA, startersB } = await createBasketballMatch('Invalid Starter Count');

      const { error } = await supabaseAdmin.rpc('init_basketball_match', {
        p_match_id: matchId,
        p_starters_side_a: startersA.slice(0, 4), // only 4
        p_starters_side_b: startersB,
      });

      expect(error).not.toBeNull();
      expect(error?.message).toContain('INVALID_LINEUP');
    });
  });

  // 2. Scoring RPC tests
  describe('2. record_basketball_score', () => {
    it('records 1pt, 2pt, and 3pt scores with authoritative point derivation and projection updates', async () => {
      const setup = await createBasketballMatch('Scoring Matrix');
      const { data: initData } = await supabaseAdmin.rpc('init_basketball_match', {
        p_match_id: setup.matchId,
        p_starters_side_a: setup.startersA,
        p_starters_side_b: setup.startersB,
      });
      const periodId = initData.period_id;

      // 1-PT Free Throw
      const { data: ftData, error: ftErr } = await supabaseAdmin.rpc('record_basketball_score', {
        p_match_id: setup.matchId,
        p_period_id: periodId,
        p_client_event_id: crypto.randomUUID(),
        p_side: 'SIDE_A',
        p_participant_id: setup.startersA[0],
        p_scoring_type: 'FREE_THROW_1PT',
      });
      expect(ftErr).toBeNull();
      expect(ftData.points).toBe(1);
      expect(ftData.period_score_side_a).toBe(1);
      expect(ftData.total_score_side_a).toBe(1);

      // 2-PT Field Goal
      const { data: fg2Data, error: fg2Err } = await supabaseAdmin.rpc('record_basketball_score', {
        p_match_id: setup.matchId,
        p_period_id: periodId,
        p_client_event_id: crypto.randomUUID(),
        p_side: 'SIDE_A',
        p_participant_id: setup.startersA[1],
        p_scoring_type: 'FIELD_GOAL_2PT',
      });
      expect(fg2Err).toBeNull();
      expect(fg2Data.points).toBe(2);
      expect(fg2Data.period_score_side_a).toBe(3);

      // 3-PT Field Goal
      const { data: fg3Data, error: fg3Err } = await supabaseAdmin.rpc('record_basketball_score', {
        p_match_id: setup.matchId,
        p_period_id: periodId,
        p_client_event_id: crypto.randomUUID(),
        p_side: 'SIDE_B',
        p_participant_id: setup.startersB[0],
        p_scoring_type: 'FIELD_GOAL_3PT',
      });
      expect(fg3Err).toBeNull();
      expect(fg3Data.points).toBe(3);
      expect(fg3Data.period_score_side_b).toBe(3);
      expect(fg3Data.total_score_side_b).toBe(3);

      // Verify player point projection in basketball_lineups
      const { data: playerA0 } = await supabaseAdmin
        .from('basketball_lineups')
        .select('points_projection')
        .eq('match_id', setup.matchId)
        .eq('participant_id', setup.startersA[0])
        .single();
      expect(playerA0?.points_projection).toBe(1);
    });

    it('rejects score attempt by bench (inactive) player', async () => {
      const setup = await createBasketballMatch('Bench Scoring Reject');
      const { data: initData } = await supabaseAdmin.rpc('init_basketball_match', {
        p_match_id: setup.matchId,
        p_starters_side_a: setup.startersA,
        p_starters_side_b: setup.startersB,
      });

      const { error } = await supabaseAdmin.rpc('record_basketball_score', {
        p_match_id: setup.matchId,
        p_period_id: initData.period_id,
        p_client_event_id: crypto.randomUUID(),
        p_side: 'SIDE_A',
        p_participant_id: setup.benchA[0], // on bench!
        p_scoring_type: 'FIELD_GOAL_2PT',
      });

      expect(error).not.toBeNull();
      expect(error?.message).toContain('PLAYER_NOT_ACTIVE');
    });

    it('provides idempotent replay for duplicate client_event_id without duplicating score', async () => {
      const setup = await createBasketballMatch('Idempotency Scoring');
      const { data: initData } = await supabaseAdmin.rpc('init_basketball_match', {
        p_match_id: setup.matchId,
        p_starters_side_a: setup.startersA,
        p_starters_side_b: setup.startersB,
      });

      const clientEventId = crypto.randomUUID();

      const { data: firstCall } = await supabaseAdmin.rpc('record_basketball_score', {
        p_match_id: setup.matchId,
        p_period_id: initData.period_id,
        p_client_event_id: clientEventId,
        p_side: 'SIDE_A',
        p_participant_id: setup.startersA[0],
        p_scoring_type: 'FIELD_GOAL_2PT',
      });
      expect(firstCall.status).toBe('created');
      expect(firstCall.period_score_side_a).toBe(2);

      // Replay same clientEventId
      const { data: secondCall, error } = await supabaseAdmin.rpc('record_basketball_score', {
        p_match_id: setup.matchId,
        p_period_id: initData.period_id,
        p_client_event_id: clientEventId,
        p_side: 'SIDE_A',
        p_participant_id: setup.startersA[0],
        p_scoring_type: 'FIELD_GOAL_2PT',
      });
      expect(error).toBeNull();
      expect(secondCall.status).toBe('idempotent_replay');
      expect(secondCall.period_score_side_a).toBe(2); // Still 2, not 4!
    });
  });

  // 3. Fouls, Bonus, and Foul-Out tests
  describe('3. record_basketball_foul', () => {
    it('increments personal and team fouls, triggers bonus at 5, and fouls out player at limit', async () => {
      const setup = await createBasketballMatch('Fouls Test', { foul_out_limit: 5, team_foul_penalty_threshold: 5 });
      const { data: initData } = await supabaseAdmin.rpc('init_basketball_match', {
        p_match_id: setup.matchId,
        p_starters_side_a: setup.startersA,
        p_starters_side_b: setup.startersB,
      });
      const periodId = initData.period_id;
      const targetPlayer = setup.startersA[0];

      // Commit 4 personal fouls on targetPlayer
      for (let i = 1; i <= 4; i++) {
        const { data, error } = await supabaseAdmin.rpc('record_basketball_foul', {
          p_match_id: setup.matchId,
          p_period_id: periodId,
          p_client_event_id: crypto.randomUUID(),
          p_side: 'SIDE_A',
          p_participant_id: targetPlayer,
          p_foul_type: 'PERSONAL',
        });
        expect(error).toBeNull();
        expect(data.personal_fouls).toBe(i);
        expect(data.team_fouls).toBe(i);
        expect(data.is_fouled_out).toBe(false);
        expect(data.is_bonus).toBe(false);
      }

      // 5th foul: Reaches bonus (5) and triggers foul-out (5)
      const { data: fifthFoul, error: fifthErr } = await supabaseAdmin.rpc('record_basketball_foul', {
        p_match_id: setup.matchId,
        p_period_id: periodId,
        p_client_event_id: crypto.randomUUID(),
        p_side: 'SIDE_A',
        p_participant_id: targetPlayer,
        p_foul_type: 'PERSONAL',
      });
      expect(fifthErr).toBeNull();
      expect(fifthFoul.personal_fouls).toBe(5);
      expect(fifthFoul.team_fouls).toBe(5);
      expect(fifthFoul.is_bonus).toBe(true); // BONUS triggered!
      expect(fifthFoul.is_fouled_out).toBe(true); // FOULED OUT!

      // Verify player removed from on-court in database
      const { data: lineup } = await supabaseAdmin
        .from('basketball_lineups')
        .select('*')
        .eq('match_id', setup.matchId)
        .eq('participant_id', targetPlayer)
        .single();
      expect(lineup?.is_fouled_out).toBe(true);
      expect(lineup?.is_on_court).toBe(false);

      // Verify fouled-out player cannot commit further fouls or score
      const { error: rejectFoulErr } = await supabaseAdmin.rpc('record_basketball_foul', {
        p_match_id: setup.matchId,
        p_period_id: periodId,
        p_client_event_id: crypto.randomUUID(),
        p_side: 'SIDE_A',
        p_participant_id: targetPlayer,
        p_foul_type: 'PERSONAL',
      });
      expect(rejectFoulErr).not.toBeNull();
      expect(rejectFoulErr?.message).toContain('PLAYER_FOULED_OUT');

      const { error: rejectScoreErr } = await supabaseAdmin.rpc('record_basketball_score', {
        p_match_id: setup.matchId,
        p_period_id: periodId,
        p_client_event_id: crypto.randomUUID(),
        p_side: 'SIDE_A',
        p_participant_id: targetPlayer,
        p_scoring_type: 'FIELD_GOAL_2PT',
      });
      expect(rejectScoreErr).not.toBeNull();
      expect(rejectScoreErr?.message).toContain('PLAYER_FOULED_OUT');
    });
  });

  // 4. Server-Authoritative Game Clock tests
  describe('4. update_basketball_clock', () => {
    it('starts clock, pauses clock with server-calculated elapsed time, and sets custom time', async () => {
      const setup = await createBasketballMatch('Clock Operations');
      const { data: initData } = await supabaseAdmin.rpc('init_basketball_match', {
        p_match_id: setup.matchId,
        p_starters_side_a: setup.startersA,
        p_starters_side_b: setup.startersB,
      });
      const periodId = initData.period_id;

      // 1. START clock
      const { data: startData, error: startErr } = await supabaseAdmin.rpc('update_basketball_clock', {
        p_match_id: setup.matchId,
        p_period_id: periodId,
        p_action: 'START',
        p_client_event_id: crypto.randomUUID(),
      });
      expect(startErr).toBeNull();
      expect(startData.clock_status).toBe('RUNNING');
      expect(startData.clock_last_started_at).not.toBeNull();

      // Starting already running clock should be rejected
      const { error: doubleStartErr } = await supabaseAdmin.rpc('update_basketball_clock', {
        p_match_id: setup.matchId,
        p_period_id: periodId,
        p_action: 'START',
      });
      expect(doubleStartErr).not.toBeNull();
      expect(doubleStartErr?.message).toContain('CLOCK_ALREADY_RUNNING');

      // 2. Wait ~1.2s to test elapsed calculation
      await new Promise((r) => setTimeout(r, 1200));

      // 3. PAUSE clock
      const { data: pauseData, error: pauseErr } = await supabaseAdmin.rpc('update_basketball_clock', {
        p_match_id: setup.matchId,
        p_period_id: periodId,
        p_action: 'PAUSE',
        p_client_event_id: crypto.randomUUID(),
      });
      expect(pauseErr).toBeNull();
      expect(pauseData.clock_status).toBe('STOPPED');
      expect(pauseData.time_remaining_seconds).toBeLessThan(600);
      expect(pauseData.time_remaining_seconds).toBeGreaterThanOrEqual(597);

      // 4. SET_TIME operation
      const { data: setTimeData, error: setTimeErr } = await supabaseAdmin.rpc('update_basketball_clock', {
        p_match_id: setup.matchId,
        p_period_id: periodId,
        p_action: 'SET_TIME',
        p_seconds: 120,
        p_client_event_id: crypto.randomUUID(),
      });
      expect(setTimeErr).toBeNull();
      expect(setTimeData.time_remaining_seconds).toBe(120);

      // 5. Test invalid SET_TIME rejects negative or over-duration seconds
      const { error: invalidTimeErr } = await supabaseAdmin.rpc('update_basketball_clock', {
        p_match_id: setup.matchId,
        p_period_id: periodId,
        p_action: 'SET_TIME',
        p_seconds: 9999,
      });
      expect(invalidTimeErr).not.toBeNull();
      expect(invalidTimeErr?.message).toContain('INVALID_TIME');
    });
  });

  // 5. Substitutions tests
  describe('5. substitute_basketball_player', () => {
    it('executes dead-ball substitution while enforcing 5-player invariant', async () => {
      const setup = await createBasketballMatch('Substitutions Test');
      const { data: initData } = await supabaseAdmin.rpc('init_basketball_match', {
        p_match_id: setup.matchId,
        p_starters_side_a: setup.startersA,
        p_starters_side_b: setup.startersB,
      });
      const periodId = initData.period_id;

      const outgoing = setup.startersA[4]; // active on-court
      const incoming = setup.benchA[0]; // bench substitute

      // Normal valid swap
      const { data: subData, error: subErr } = await supabaseAdmin.rpc('substitute_basketball_player', {
        p_match_id: setup.matchId,
        p_period_id: periodId,
        p_client_event_id: crypto.randomUUID(),
        p_side: 'SIDE_A',
        p_outgoing_participant_id: outgoing,
        p_incoming_participant_id: incoming,
      });
      expect(subErr).toBeNull();
      expect(subData.status).toBe('substituted');

      // Verify on-court lineup states
      const { data: outLineup } = await supabaseAdmin
        .from('basketball_lineups')
        .select('is_on_court')
        .eq('match_id', setup.matchId)
        .eq('participant_id', outgoing)
        .single();
      const { data: inLineup } = await supabaseAdmin
        .from('basketball_lineups')
        .select('is_on_court')
        .eq('match_id', setup.matchId)
        .eq('participant_id', incoming)
        .single();

      expect(outLineup?.is_on_court).toBe(false);
      expect(inLineup?.is_on_court).toBe(true);

      // Verify exactly 5 on court for Side A
      const { data: onCourtA } = await supabaseAdmin
        .from('basketball_lineups')
        .select('*')
        .eq('match_id', setup.matchId)
        .eq('competitor_id', setup.compAId)
        .eq('is_on_court', true);
      expect(onCourtA?.length).toBe(5);

      // Reject substitution if clock is RUNNING
      await supabaseAdmin.rpc('update_basketball_clock', {
        p_match_id: setup.matchId,
        p_period_id: periodId,
        p_action: 'START',
      });

      const { error: runningSubErr } = await supabaseAdmin.rpc('substitute_basketball_player', {
        p_match_id: setup.matchId,
        p_period_id: periodId,
        p_client_event_id: crypto.randomUUID(),
        p_side: 'SIDE_A',
        p_outgoing_participant_id: incoming,
        p_incoming_participant_id: outgoing,
      });
      expect(runningSubErr).not.toBeNull();
      expect(runningSubErr?.message).toContain('CLOCK_NOT_STOPPED');
    });

    it('rejects substituting a fouled-out player back into the court', async () => {
      const setup = await createBasketballMatch('Foul-Out Sub Reject', { foul_out_limit: 1 });
      const { data: initData } = await supabaseAdmin.rpc('init_basketball_match', {
        p_match_id: setup.matchId,
        p_starters_side_a: setup.startersA,
        p_starters_side_b: setup.startersB,
      });

      // Foul out player 0
      await supabaseAdmin.rpc('record_basketball_foul', {
        p_match_id: setup.matchId,
        p_period_id: initData.period_id,
        p_client_event_id: crypto.randomUUID(),
        p_side: 'SIDE_A',
        p_participant_id: setup.startersA[0],
        p_foul_type: 'PERSONAL',
      });

      // Try substituting fouled-out player back onto court
      const { error } = await supabaseAdmin.rpc('substitute_basketball_player', {
        p_match_id: setup.matchId,
        p_period_id: initData.period_id,
        p_client_event_id: crypto.randomUUID(),
        p_side: 'SIDE_A',
        p_outgoing_participant_id: setup.startersA[1],
        p_incoming_participant_id: setup.startersA[0], // fouled out!
      });

      expect(error).not.toBeNull();
      expect(error?.message).toContain('PLAYER_FOULED_OUT');
    });
  });

  // 6. Timeouts tests
  describe('6. record_basketball_timeout', () => {
    it('stops the clock, decrements timeouts, and rejects when exhausted', async () => {
      const setup = await createBasketballMatch('Timeouts Test', { timeouts_per_team_regulation: 2 });
      const { data: initData } = await supabaseAdmin.rpc('init_basketball_match', {
        p_match_id: setup.matchId,
        p_starters_side_a: setup.startersA,
        p_starters_side_b: setup.startersB,
      });
      const periodId = initData.period_id;

      // Start clock first
      await supabaseAdmin.rpc('update_basketball_clock', {
        p_match_id: setup.matchId,
        p_period_id: periodId,
        p_action: 'START',
      });

      // Timeout 1
      const { data: t1, error: t1Err } = await supabaseAdmin.rpc('record_basketball_timeout', {
        p_match_id: setup.matchId,
        p_period_id: periodId,
        p_client_event_id: crypto.randomUUID(),
        p_side: 'SIDE_A',
      });
      expect(t1Err).toBeNull();
      expect(t1.remaining_timeouts).toBe(1);

      // Verify clock stopped by timeout
      const { data: periodState } = await supabaseAdmin
        .from('basketball_periods')
        .select('clock_status')
        .eq('id', periodId)
        .single();
      expect(periodState?.clock_status).toBe('STOPPED');

      // Timeout 2
      const { data: t2, error: t2Err } = await supabaseAdmin.rpc('record_basketball_timeout', {
        p_match_id: setup.matchId,
        p_period_id: periodId,
        p_client_event_id: crypto.randomUUID(),
        p_side: 'SIDE_A',
      });
      expect(t2Err).toBeNull();
      expect(t2.remaining_timeouts).toBe(0);

      // Timeout 3 -> Must be rejected (exhausted!)
      const { error: t3Err } = await supabaseAdmin.rpc('record_basketball_timeout', {
        p_match_id: setup.matchId,
        p_period_id: periodId,
        p_client_event_id: crypto.randomUUID(),
        p_side: 'SIDE_A',
      });
      expect(t3Err).not.toBeNull();
      expect(t3Err?.message).toContain('TIMEOUT_EXHAUSTED');
    });
  });

  // 7. Undo tests
  describe('7. undo_basketball_event', () => {
    it('soft-voids latest scoring event and atomically decrements points', async () => {
      const setup = await createBasketballMatch('Undo Score');
      const { data: initData } = await supabaseAdmin.rpc('init_basketball_match', {
        p_match_id: setup.matchId,
        p_starters_side_a: setup.startersA,
        p_starters_side_b: setup.startersB,
      });

      // Score +3
      const { data: scoreData } = await supabaseAdmin.rpc('record_basketball_score', {
        p_match_id: setup.matchId,
        p_period_id: initData.period_id,
        p_client_event_id: crypto.randomUUID(),
        p_side: 'SIDE_A',
        p_participant_id: setup.startersA[0],
        p_scoring_type: 'FIELD_GOAL_3PT',
      });
      expect(scoreData.period_score_side_a).toBe(3);

      // Undo latest event
      const { data: undoData, error: undoErr } = await supabaseAdmin.rpc('undo_basketball_event', {
        p_match_id: setup.matchId,
        p_event_id: scoreData.event_id,
      });
      expect(undoErr).toBeNull();
      expect(undoData.status).toBe('undone');
      expect(undoData.event_type).toBe('SCORE');

      // Verify period score restored to 0
      const { data: periodAfter } = await supabaseAdmin
        .from('basketball_periods')
        .select('side_a_score')
        .eq('id', initData.period_id)
        .single();
      expect(periodAfter?.side_a_score).toBe(0);

      // Verify event is soft-voided (voided_at IS NOT NULL)
      const { data: voidedEv } = await supabaseAdmin
        .from('basketball_events')
        .select('voided_at')
        .eq('id', scoreData.event_id)
        .single();
      expect(voidedEv?.voided_at).not.toBeNull();
    });

    it('undoes foul that caused foul-out and restores player eligibility', async () => {
      const setup = await createBasketballMatch('Undo Foul-Out', { foul_out_limit: 1 });
      const { data: initData } = await supabaseAdmin.rpc('init_basketball_match', {
        p_match_id: setup.matchId,
        p_starters_side_a: setup.startersA,
        p_starters_side_b: setup.startersB,
      });

      const { data: foulData } = await supabaseAdmin.rpc('record_basketball_foul', {
        p_match_id: setup.matchId,
        p_period_id: initData.period_id,
        p_client_event_id: crypto.randomUUID(),
        p_side: 'SIDE_A',
        p_participant_id: setup.startersA[0],
        p_foul_type: 'PERSONAL',
      });
      expect(foulData.is_fouled_out).toBe(true);

      // Undo foul
      const { error: undoErr } = await supabaseAdmin.rpc('undo_basketball_event', {
        p_match_id: setup.matchId,
        p_event_id: foulData.event_id,
      });
      expect(undoErr).toBeNull();

      // Verify player eligibility restored
      const { data: lineup } = await supabaseAdmin
        .from('basketball_lineups')
        .select('*')
        .eq('match_id', setup.matchId)
        .eq('participant_id', setup.startersA[0])
        .single();
      expect(lineup?.fouls_projection).toBe(0);
      expect(lineup?.is_fouled_out).toBe(false);
    });
  });

  // 8. Period progression and Overtime tests
  describe('8. progress_basketball_period & Overtime', () => {
    it('progresses Q1 -> Q2 -> Q3 -> Q4, resets team fouls, and finalizes with regulation winner', async () => {
      const setup = await createBasketballMatch('Regulation Progression');
      const { data: initData } = await supabaseAdmin.rpc('init_basketball_match', {
        p_match_id: setup.matchId,
        p_starters_side_a: setup.startersA,
        p_starters_side_b: setup.startersB,
      });
      let currentPeriodId = initData.period_id;

      // Score 2 points for Side A in Q1 and commit a foul
      await supabaseAdmin.rpc('record_basketball_score', {
        p_match_id: setup.matchId,
        p_period_id: currentPeriodId,
        p_client_event_id: crypto.randomUUID(),
        p_side: 'SIDE_A',
        p_participant_id: setup.startersA[0],
        p_scoring_type: 'FIELD_GOAL_2PT',
      });
      await supabaseAdmin.rpc('record_basketball_foul', {
        p_match_id: setup.matchId,
        p_period_id: currentPeriodId,
        p_client_event_id: crypto.randomUUID(),
        p_side: 'SIDE_A',
        p_participant_id: setup.startersA[1],
        p_foul_type: 'PERSONAL',
      });

      // Progress Q1 -> Q2
      const { data: q2Data, error: q2Err } = await supabaseAdmin.rpc('progress_basketball_period', {
        p_match_id: setup.matchId,
      });
      expect(q2Err).toBeNull();
      expect(q2Data.status).toBe('period_progressed');
      expect(q2Data.period_number).toBe(2);
      currentPeriodId = q2Data.period_id;

      // Verify team fouls reset to 0 in Q2
      const { data: q2Row } = await supabaseAdmin
        .from('basketball_periods')
        .select('side_a_fouls, side_b_fouls')
        .eq('id', currentPeriodId)
        .single();
      expect(q2Row?.side_a_fouls).toBe(0);
      expect(q2Row?.side_b_fouls).toBe(0);

      // Progress Q2 -> Q3
      const { data: q3Data } = await supabaseAdmin.rpc('progress_basketball_period', { p_match_id: setup.matchId });
      expect(q3Data.period_number).toBe(3);

      // Progress Q3 -> Q4
      const { data: q4Data } = await supabaseAdmin.rpc('progress_basketball_period', { p_match_id: setup.matchId });
      expect(q4Data.period_number).toBe(4);

      // Conclude Q4 with Side A leading 2 - 0 -> Must complete match!
      const { data: matchEndData, error: endErr } = await supabaseAdmin.rpc('progress_basketball_period', {
        p_match_id: setup.matchId,
      });
      expect(endErr).toBeNull();
      expect(matchEndData.status).toBe('match_completed');
      expect(matchEndData.winner_side).toBe('SIDE_A');

      // Verify matches table status
      const { data: finishedMatch } = await supabaseAdmin
        .from('matches')
        .select('status, winner_side, result_summary')
        .eq('id', setup.matchId)
        .single();
      expect(finishedMatch?.status).toBe('COMPLETED');
      expect(finishedMatch?.winner_side).toBe('SIDE_A');
      expect(finishedMatch?.result_summary).toContain('won 2 - 0');
    });

    it('triggers Overtime on tied Q4, and handles sequential OT periods', async () => {
      const setup = await createBasketballMatch('Overtime Tie Test', {
        regulation_period_count: 4,
        overtime_enabled: true,
        overtime_duration_seconds: 300,
      });
      const { data: initData } = await supabaseAdmin.rpc('init_basketball_match', {
        p_match_id: setup.matchId,
        p_starters_side_a: setup.startersA,
        p_starters_side_b: setup.startersB,
      });

      // Equal score 2 - 2 in Q1
      await supabaseAdmin.rpc('record_basketball_score', {
        p_match_id: setup.matchId,
        p_period_id: initData.period_id,
        p_client_event_id: crypto.randomUUID(),
        p_side: 'SIDE_A',
        p_participant_id: setup.startersA[0],
        p_scoring_type: 'FIELD_GOAL_2PT',
      });
      await supabaseAdmin.rpc('record_basketball_score', {
        p_match_id: setup.matchId,
        p_period_id: initData.period_id,
        p_client_event_id: crypto.randomUUID(),
        p_side: 'SIDE_B',
        p_participant_id: setup.startersB[0],
        p_scoring_type: 'FIELD_GOAL_2PT',
      });

      // Progress Q1 -> Q2 -> Q3 -> Q4
      await supabaseAdmin.rpc('progress_basketball_period', { p_match_id: setup.matchId }); // Q2
      await supabaseAdmin.rpc('progress_basketball_period', { p_match_id: setup.matchId }); // Q3
      const { data: q4Data } = await supabaseAdmin.rpc('progress_basketball_period', { p_match_id: setup.matchId }); // Q4
      expect(q4Data.period_number).toBe(4);

      // Progress at end of Q4 with 2-2 tie -> Must create OT1 (period_number = 5)!
      const { data: ot1Data, error: ot1Err } = await supabaseAdmin.rpc('progress_basketball_period', {
        p_match_id: setup.matchId,
      });
      expect(ot1Err).toBeNull();
      expect(ot1Data.status).toBe('overtime_created');
      expect(ot1Data.period_number).toBe(5);
      expect(ot1Data.period_type).toBe('OVERTIME');
      expect(ot1Data.duration_seconds).toBe(300);

      // Side B scores in OT1 to win
      await supabaseAdmin.rpc('record_basketball_score', {
        p_match_id: setup.matchId,
        p_period_id: ot1Data.period_id,
        p_client_event_id: crypto.randomUUID(),
        p_side: 'SIDE_B',
        p_participant_id: setup.startersB[1],
        p_scoring_type: 'FIELD_GOAL_3PT',
      });

      // Progress OT1 -> Finalizes match with Side B victory
      const { data: otFinal, error: otFinalErr } = await supabaseAdmin.rpc('progress_basketball_period', {
        p_match_id: setup.matchId,
      });
      expect(otFinalErr).toBeNull();
      expect(otFinal.status).toBe('match_completed');
      expect(otFinal.winner_side).toBe('SIDE_B');
    });

    it('completes as DRAW when overtime is disabled and Q4 ends tied', async () => {
      const setup = await createBasketballMatch('Draw Test', {
        regulation_period_count: 4,
        overtime_enabled: false,
      });
      const { data: initData } = await supabaseAdmin.rpc('init_basketball_match', {
        p_match_id: setup.matchId,
        p_starters_side_a: setup.startersA,
        p_starters_side_b: setup.startersB,
      });

      // Tie at 0 - 0 through Q4
      await supabaseAdmin.rpc('progress_basketball_period', { p_match_id: setup.matchId }); // Q2
      await supabaseAdmin.rpc('progress_basketball_period', { p_match_id: setup.matchId }); // Q3
      await supabaseAdmin.rpc('progress_basketball_period', { p_match_id: setup.matchId }); // Q4
      const { data: drawData, error } = await supabaseAdmin.rpc('progress_basketball_period', {
        p_match_id: setup.matchId,
      });

      expect(error).toBeNull();
      expect(drawData.status).toBe('match_completed');
      expect(drawData.winner_side).toBe('DRAW');
    });
  });

  // 9. Cross-Sport Protection and Security tests
  describe('9. Cross-Sport Defense and RBAC Security', () => {
    it('rejects Basketball RPC calls on Cricket and Badminton matches', async () => {
      // 1. Create a Cricket Match
      const { data: cricketMatch } = await supabaseAdmin
        .from('matches')
        .insert({
          title: 'Cricket Match Test',
          sport_id: cricketSportId,
          organization_id: orgId,
          match_format: 'TEAM',
          status: 'DRAFT',
          created_by: userOwner,
        })
        .select('id')
        .single();

      const { error: cricketErr } = await supabaseAdmin.rpc('init_basketball_match', {
        p_match_id: cricketMatch!.id,
      });
      expect(cricketErr).not.toBeNull();
      expect(cricketErr?.message).toContain('INVALID_SPORT');

      // 2. Create a Badminton Match
      const { data: badmintonMatch } = await supabaseAdmin
        .from('matches')
        .insert({
          title: 'Badminton Match Test',
          sport_id: badmintonSportId,
          organization_id: orgId,
          match_format: 'SINGLES',
          status: 'DRAFT',
          created_by: userOwner,
        })
        .select('id')
        .single();

      const { error: badmErr } = await supabaseAdmin.rpc('record_basketball_score', {
        p_match_id: badmintonMatch!.id,
        p_period_id: crypto.randomUUID(),
        p_client_event_id: crypto.randomUUID(),
        p_side: 'SIDE_A',
        p_participant_id: crypto.randomUUID(),
        p_scoring_type: 'FIELD_GOAL_2PT',
      });
      expect(badmErr).not.toBeNull();
      expect(badmErr?.message).toContain('INVALID_SPORT');
    });

    it('rejects anonymous unauthenticated mutation calls', async () => {
      const setup = await createBasketballMatch('Anon Rejection Test');
      const { error } = await supabaseAnon.rpc('init_basketball_match', {
        p_match_id: setup.matchId,
      });
      expect(error).not.toBeNull();
      // Permission denied or unauthenticated
      expect(error?.message).toMatch(/UNAUTHENTICATED|permission denied|FORBIDDEN/i);
    });
  });

  // 10. Concurrency and Row-Locking tests
  describe('10. Concurrency Protection & Row-Locking', () => {
    it('handles simultaneous +2 scores without lost updates (+4 total)', async () => {
      const setup = await createBasketballMatch('Concurrent Scores');
      const { data: initData } = await supabaseAdmin.rpc('init_basketball_match', {
        p_match_id: setup.matchId,
        p_starters_side_a: setup.startersA,
        p_starters_side_b: setup.startersB,
      });
      const periodId = initData.period_id;

      // Two concurrent score requests
      const [res1, res2] = await Promise.all([
        supabaseAdmin.rpc('record_basketball_score', {
          p_match_id: setup.matchId,
          p_period_id: periodId,
          p_client_event_id: crypto.randomUUID(),
          p_side: 'SIDE_A',
          p_participant_id: setup.startersA[0],
          p_scoring_type: 'FIELD_GOAL_2PT',
        }),
        supabaseAdmin.rpc('record_basketball_score', {
          p_match_id: setup.matchId,
          p_period_id: periodId,
          p_client_event_id: crypto.randomUUID(),
          p_side: 'SIDE_A',
          p_participant_id: setup.startersA[1],
          p_scoring_type: 'FIELD_GOAL_2PT',
        }),
      ]);

      expect(res1.error).toBeNull();
      expect(res2.error).toBeNull();

      // Read authoritative period score: must be exactly 4!
      const { data: period } = await supabaseAdmin
        .from('basketball_periods')
        .select('side_a_score')
        .eq('id', periodId)
        .single();
      expect(period?.side_a_score).toBe(4);

      // Verify two distinct events exist in ledger
      const { data: events } = await supabaseAdmin
        .from('basketball_events')
        .select('id, sequence_number')
        .eq('period_id', periodId)
        .eq('event_type', 'SCORE');
      expect(events?.length).toBe(2);
      const seqs = events?.map((e) => e.sequence_number).sort();
      expect(seqs).toEqual([1, 2]);
    });

    it('serializes concurrent duplicate requests to avoid double counting', async () => {
      const setup = await createBasketballMatch('Concurrent Duplicate Replay');
      const { data: initData } = await supabaseAdmin.rpc('init_basketball_match', {
        p_match_id: setup.matchId,
        p_starters_side_a: setup.startersA,
        p_starters_side_b: setup.startersB,
      });

      const clientEventId = crypto.randomUUID();

      // Send same client event twice concurrently
      const [res1, res2] = await Promise.all([
        supabaseAdmin.rpc('record_basketball_score', {
          p_match_id: setup.matchId,
          p_period_id: initData.period_id,
          p_client_event_id: clientEventId,
          p_side: 'SIDE_A',
          p_participant_id: setup.startersA[0],
          p_scoring_type: 'FIELD_GOAL_3PT',
        }),
        supabaseAdmin.rpc('record_basketball_score', {
          p_match_id: setup.matchId,
          p_period_id: initData.period_id,
          p_client_event_id: clientEventId,
          p_side: 'SIDE_A',
          p_participant_id: setup.startersA[0],
          p_scoring_type: 'FIELD_GOAL_3PT',
        }),
      ]);

      expect(res1.error || res2.error).toBeNull();

      // Verify period score is strictly 3 (not 6!)
      const { data: period } = await supabaseAdmin
        .from('basketball_periods')
        .select('side_a_score')
        .eq('id', initData.period_id)
        .single();
      expect(period?.side_a_score).toBe(3);

      // Verify exactly 1 event logged
      const { data: events } = await supabaseAdmin
        .from('basketball_events')
        .select('id')
        .eq('period_id', initData.period_id);
      expect(events?.length).toBe(1);
    });

    it('handles simultaneous timeout attempts and deducts only one for duplicate request', async () => {
      const setup = await createBasketballMatch('Concurrent Timeout');
      const { data: initData } = await supabaseAdmin.rpc('init_basketball_match', {
        p_match_id: setup.matchId,
        p_starters_side_a: setup.startersA,
        p_starters_side_b: setup.startersB,
      });

      const clientEventId = crypto.randomUUID();

      const [res1, res2] = await Promise.all([
        supabaseAdmin.rpc('record_basketball_timeout', {
          p_match_id: setup.matchId,
          p_period_id: initData.period_id,
          p_client_event_id: clientEventId,
          p_side: 'SIDE_A',
        }),
        supabaseAdmin.rpc('record_basketball_timeout', {
          p_match_id: setup.matchId,
          p_period_id: initData.period_id,
          p_client_event_id: clientEventId,
          p_side: 'SIDE_A',
        }),
      ]);

      expect(res1.error || res2.error).toBeNull();

      // Verify only 1 timeout event logged
      const { data: timeouts } = await supabaseAdmin
        .from('basketball_events')
        .select('id')
        .eq('match_id', setup.matchId)
        .eq('event_type', 'TIMEOUT');
      expect(timeouts?.length).toBe(1);
    });

    it('serializes clock start and pause operations safely', async () => {
      const setup = await createBasketballMatch('Clock Concurrency');
      const { data: initData } = await supabaseAdmin.rpc('init_basketball_match', {
        p_match_id: setup.matchId,
        p_starters_side_a: setup.startersA,
        p_starters_side_b: setup.startersB,
      });

      // Start clock
      await supabaseAdmin.rpc('update_basketball_clock', {
        p_match_id: setup.matchId,
        p_period_id: initData.period_id,
        p_action: 'START',
      });

      // Concurrent pause calls
      const [res1, res2] = await Promise.all([
        supabaseAdmin.rpc('update_basketball_clock', {
          p_match_id: setup.matchId,
          p_period_id: initData.period_id,
          p_action: 'PAUSE',
        }),
        supabaseAdmin.rpc('update_basketball_clock', {
          p_match_id: setup.matchId,
          p_period_id: initData.period_id,
          p_action: 'PAUSE',
        }),
      ]);

      expect(res1.error).toBeNull();
      expect(res2.error).toBeNull();

      const { data: period } = await supabaseAdmin
        .from('basketball_periods')
        .select('clock_status, time_remaining_seconds')
        .eq('id', initData.period_id)
        .single();
      expect(period?.clock_status).toBe('STOPPED');
      expect(period?.time_remaining_seconds).toBeLessThanOrEqual(600);
      expect(period?.time_remaining_seconds).toBeGreaterThanOrEqual(0);
    });
  });

  // 11. Complete Match RPC & Undo Substitution / Timeout tests
  describe('11. complete_basketball_match & Advanced Undo', () => {
    it('rejects match completion while game clock is RUNNING', async () => {
      const setup = await createBasketballMatch('Complete Clock Running');
      const { data: initData } = await supabaseAdmin.rpc('init_basketball_match', {
        p_match_id: setup.matchId,
        p_starters_side_a: setup.startersA,
        p_starters_side_b: setup.startersB,
      });

      // Start clock
      await supabaseAdmin.rpc('update_basketball_clock', {
        p_match_id: setup.matchId,
        p_period_id: initData.period_id,
        p_action: 'START',
      });

      const { error } = await supabaseAdmin.rpc('complete_basketball_match', {
        p_match_id: setup.matchId,
      });

      expect(error).not.toBeNull();
      expect(error?.message).toContain('CLOCK_RUNNING');
    });

    it('completes match authoritatively when clock is stopped and determines winner', async () => {
      const setup = await createBasketballMatch('Complete Valid Match');
      const { data: initData } = await supabaseAdmin.rpc('init_basketball_match', {
        p_match_id: setup.matchId,
        p_starters_side_a: setup.startersA,
        p_starters_side_b: setup.startersB,
      });

      // Score 2 for Side A
      await supabaseAdmin.rpc('record_basketball_score', {
        p_match_id: setup.matchId,
        p_period_id: initData.period_id,
        p_client_event_id: crypto.randomUUID(),
        p_side: 'SIDE_A',
        p_participant_id: setup.startersA[0],
        p_scoring_type: 'FIELD_GOAL_2PT',
      });

      const { data: compResult, error } = await supabaseAdmin.rpc('complete_basketball_match', {
        p_match_id: setup.matchId,
      });

      expect(error).toBeNull();
      expect(compResult.status).toBe('match_completed');
      expect(compResult.winner_side).toBe('SIDE_A');
      expect(compResult.total_score_side_a).toBe(2);
      expect(compResult.total_score_side_b).toBe(0);

      // Verify terminal state in database
      const { data: m } = await supabaseAdmin
        .from('matches')
        .select('status, winner_side, result_summary')
        .eq('id', setup.matchId)
        .single();
      expect(m?.status).toBe('COMPLETED');
      expect(m?.winner_side).toBe('SIDE_A');
    });

    it('undoes substitution and restores exact active/bench lineup state', async () => {
      const setup = await createBasketballMatch('Undo Substitution');
      const { data: initData } = await supabaseAdmin.rpc('init_basketball_match', {
        p_match_id: setup.matchId,
        p_starters_side_a: setup.startersA,
        p_starters_side_b: setup.startersB,
      });

      const outPlayer = setup.startersA[4];
      const inPlayer = setup.benchA[0];

      // Perform substitution
      const { data: subData } = await supabaseAdmin.rpc('substitute_basketball_player', {
        p_match_id: setup.matchId,
        p_period_id: initData.period_id,
        p_client_event_id: crypto.randomUUID(),
        p_side: 'SIDE_A',
        p_outgoing_participant_id: outPlayer,
        p_incoming_participant_id: inPlayer,
      });

      // Undo substitution
      const { data: undoData, error } = await supabaseAdmin.rpc('undo_basketball_event', {
        p_match_id: setup.matchId,
        p_event_id: subData.event_id,
      });

      expect(error).toBeNull();
      expect(undoData.status).toBe('undone');
      expect(undoData.event_type).toBe('SUBSTITUTION');

      // Verify outPlayer is back on court, inPlayer is back on bench
      const { data: outRow } = await supabaseAdmin
        .from('basketball_lineups')
        .select('is_on_court')
        .eq('match_id', setup.matchId)
        .eq('participant_id', outPlayer)
        .single();
      const { data: inRow } = await supabaseAdmin
        .from('basketball_lineups')
        .select('is_on_court')
        .eq('match_id', setup.matchId)
        .eq('participant_id', inPlayer)
        .single();

      expect(outRow?.is_on_court).toBe(true);
      expect(inRow?.is_on_court).toBe(false);
    });

    it('get_basketball_match_state returns comprehensive snapshot', async () => {
      const setup = await createBasketballMatch('Match State Snapshot');
      const { data: initData } = await supabaseAdmin.rpc('init_basketball_match', {
        p_match_id: setup.matchId,
        p_starters_side_a: setup.startersA,
        p_starters_side_b: setup.startersB,
      });

      const { data: state, error } = await supabaseAdmin.rpc('get_basketball_match_state', {
        p_match_id: setup.matchId,
      });

      expect(error).toBeNull();
      expect(state.match_id).toBe(setup.matchId);
      expect(state.match_status).toBe('LIVE');
      expect(state.active_period.period_number).toBe(1);
      expect(state.periods.length).toBe(1);
      expect(state.lineups_side_a.length).toBe(7);
      expect(state.lineups_side_b.length).toBe(7);
      expect(state.timeouts_remaining_side_a).toBe(4);
      expect(state.timeouts_remaining_side_b).toBe(4);
    });
  });
});
