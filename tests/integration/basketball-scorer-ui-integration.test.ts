import { describe, it, expect, beforeAll } from 'vitest';
import { createClient, SupabaseClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });

describe('SPORTSHUB STEP 20D — Basketball Scorer UI Authoritative Backend Integration Tests', () => {
  let supabaseAdmin: SupabaseClient;
  let scorerClient: SupabaseClient;
  let spectatorClient: SupabaseClient;
  let otherTenantClient: SupabaseClient;

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || 'http://127.0.0.1:54321';
  const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || '';
  const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '';

  const runId = Date.now();
  const testPassword = 'Password123!QA';
  const scorerEmail = `bb.scorer.${runId}@test.sportshub.internal`;
  const otherTenantEmail = `bb.otherorg.${runId}@test.sportshub.internal`;

  let scorerUserId: string;
  let otherTenantUserId: string;

  let basketballSportId: string;
  let cricketSportId: string;
  let orgAId: string;
  let orgBId: string;
  let matchId: string;
  let cricketMatchId: string;
  let compAId: string;
  let compBId: string;
  let partAIds: string[] = [];
  let partBIds: string[] = [];
  let activePeriodId: string;

  beforeAll(async () => {
    supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey);
    spectatorClient = createClient(supabaseUrl, supabaseAnonKey);

    // 1. Fetch Sports
    const { data: sports, error: sportsErr } = await supabaseAdmin.from('sports').select('id, slug, name');
    expect(sportsErr).toBeNull();
    const bbSport = sports?.find((s) => s.slug === 'basketball');
    const crkSport = sports?.find((s) => s.slug === 'cricket');
    expect(bbSport).toBeDefined();
    expect(crkSport).toBeDefined();
    basketballSportId = bbSport!.id;
    cricketSportId = crkSport!.id;

    // 2. Create Users
    const createAuthUser = async (email: string) => {
      const { data, error } = await supabaseAdmin.auth.admin.createUser({
        email,
        password: testPassword,
        email_confirm: true,
      });
      expect(error).toBeNull();
      return data.user!.id;
    };

    scorerUserId = await createAuthUser(scorerEmail);
    otherTenantUserId = await createAuthUser(otherTenantEmail);

    // 3. Create Organizations
    const { data: orgA, error: orgAErr } = await supabaseAdmin
      .from('organizations')
      .insert({ name: `Org A BB ${runId}`, slug: `org-a-bb-${runId}` })
      .select()
      .single();
    expect(orgAErr).toBeNull();
    orgAId = orgA.id;

    const { data: orgB, error: orgBErr } = await supabaseAdmin
      .from('organizations')
      .insert({ name: `Org B BB ${runId}`, slug: `org-b-bb-${runId}` })
      .select()
      .single();
    expect(orgBErr).toBeNull();
    orgBId = orgB.id;

    // 4. Assign Member Roles (Scorer role)
    await supabaseAdmin.from('organization_members').insert([
      { organization_id: orgAId, user_id: scorerUserId, role: 'scorer' },
      { organization_id: orgBId, user_id: otherTenantUserId, role: 'scorer' },
    ]);

    // 5. Create Authenticated Clients
    scorerClient = createClient(supabaseUrl, supabaseAnonKey);
    const { error: signInErr } = await scorerClient.auth.signInWithPassword({
      email: scorerEmail,
      password: testPassword,
    });
    expect(signInErr).toBeNull();

    otherTenantClient = createClient(supabaseUrl, supabaseAnonKey);
    const { error: signInOtherErr } = await otherTenantClient.auth.signInWithPassword({
      email: otherTenantEmail,
      password: testPassword,
    });
    expect(signInOtherErr).toBeNull();

    // 5.5 Create Teams for TEAM format match
    const { data: teamA, error: teamAErr } = await supabaseAdmin
      .from('teams')
      .insert({
        name: `Lakers ${runId}`,
        sport_id: basketballSportId,
        organization_id: orgAId,
        created_by: scorerUserId,
      })
      .select('id')
      .single();
    expect(teamAErr).toBeNull();

    const { data: teamB, error: teamBErr } = await supabaseAdmin
      .from('teams')
      .insert({
        name: `Celtics ${runId}`,
        sport_id: basketballSportId,
        organization_id: orgAId,
        created_by: scorerUserId,
      })
      .select('id')
      .single();
    expect(teamBErr).toBeNull();

    // 6. Create Basketball Match in DRAFT status
    const scheduledStart = new Date(Date.now() + 3600000).toISOString();
    const scheduledEnd = new Date(Date.now() + 7200000).toISOString();

    const { data: match, error: matchErr } = await supabaseAdmin
      .from('matches')
      .insert({
        organization_id: orgAId,
        sport_id: basketballSportId,
        title: `Lakers vs Celtics ${runId}`,
        match_format: 'TEAM',
        status: 'DRAFT',
        scheduled_start: scheduledStart,
        scheduled_end: scheduledEnd,
        created_by: scorerUserId,
        scorer_user_id: scorerUserId,
        metadata: {
          basketball_config: {
            period_duration_seconds: 600,
            regulation_period_count: 4,
            overtime_duration_seconds: 300,
            foul_out_limit: 5,
            team_foul_penalty_threshold: 5,
            timeouts_per_team_regulation: 4,
            timeouts_per_team_overtime: 1,
          },
        },
      })
      .select()
      .single();
    expect(matchErr).toBeNull();
    matchId = match.id;

    // 7. Create Competitors Side A & Side B
    const { data: compA, error: compAErr } = await supabaseAdmin
      .from('match_competitors')
      .insert({ match_id: matchId, side: 'SIDE_A', team_id: teamA!.id, competitor_name: 'Lakers' })
      .select()
      .single();
    expect(compAErr).toBeNull();
    compAId = compA.id;

    const { data: compB, error: compBErr } = await supabaseAdmin
      .from('match_competitors')
      .insert({ match_id: matchId, side: 'SIDE_B', team_id: teamB!.id, competitor_name: 'Celtics' })
      .select()
      .single();
    expect(compBErr).toBeNull();
    compBId = compB.id;

    // 8. Create Participants (6 players per team: 5 starters + 1 bench substitute)
    for (let i = 1; i <= 6; i++) {
      const { data: pA } = await supabaseAdmin
        .from('match_participants')
        .insert({
          match_id: matchId,
          competitor_id: compAId,
          display_name: `Lakers Player ${i}`,
          jersey_number: i,
          role: 'PLAYER',
        })
        .select('id')
        .single();
      partAIds.push(pA!.id);

      const { data: pB } = await supabaseAdmin
        .from('match_participants')
        .insert({
          match_id: matchId,
          competitor_id: compBId,
          display_name: `Celtics Player ${i}`,
          jersey_number: i + 10,
          role: 'PLAYER',
        })
        .select('id')
        .single();
      partBIds.push(pB!.id);
    }

    // 9. Create a Cricket match for cross-sport protection test
    const { data: crkMatch } = await supabaseAdmin
      .from('matches')
      .insert({
        organization_id: orgAId,
        sport_id: cricketSportId,
        title: `Org A Cricket ${runId}`,
        match_format: 'TEAM',
        status: 'DRAFT',
        created_by: scorerUserId,
      })
      .select()
      .single();
    cricketMatchId = crkMatch!.id;
  });

  it('1. init_basketball_match initializes Q1 with starters and STOPPED clock', async () => {
    const { data, error } = await scorerClient.rpc('init_basketball_match', {
      p_match_id: matchId,
      p_starters_side_a: partAIds.slice(0, 5),
      p_starters_side_b: partBIds.slice(0, 5),
    });

    expect(error).toBeNull();
    expect(data.status).toBe('initialized');
    expect(data.period_number).toBe(1);
    expect(data.duration_seconds).toBe(600);
    expect(data.time_remaining_seconds).toBe(600);
    expect(data.clock_status).toBe('STOPPED');
    activePeriodId = data.period_id;
  });

  it('2. get_basketball_match_state hydrates full UI state on page load', async () => {
    const { data, error } = await scorerClient.rpc('get_basketball_match_state', {
      p_match_id: matchId,
    });

    expect(error).toBeNull();
    expect(data.match_id).toBe(matchId);
    expect(data.total_score_side_a).toBe(0);
    expect(data.total_score_side_b).toBe(0);
    expect(data.active_period).toBeDefined();
    expect(data.active_period.period_number).toBe(1);
    expect(data.active_period.clock_status).toBe('STOPPED');
    expect(data.lineups_side_a.filter((p: any) => p.is_on_court)).toHaveLength(5);
    expect(data.lineups_side_b.filter((p: any) => p.is_on_court)).toHaveLength(5);
    expect(data.timeouts_remaining_side_a).toBe(4);
    expect(data.timeouts_remaining_side_b).toBe(4);

    if (data.active_period?.id) {
      activePeriodId = data.active_period.id;
    }
  });

  it('3. update_basketball_clock START and PAUSE commands update clock authoritatively', async () => {
    // START
    const { data: startData, error: startErr } = await scorerClient.rpc('update_basketball_clock', {
      p_match_id: matchId,
      p_period_id: activePeriodId,
      p_action: 'START',
      p_client_event_id: crypto.randomUUID(),
    });
    expect(startErr).toBeNull();
    expect(startData.clock_status).toBe('RUNNING');

    // Wait 250ms
    await new Promise((r) => setTimeout(r, 250));

    // PAUSE
    const { data: pauseData, error: pauseErr } = await scorerClient.rpc('update_basketball_clock', {
      p_match_id: matchId,
      p_period_id: activePeriodId,
      p_action: 'PAUSE',
      p_client_event_id: crypto.randomUUID(),
    });
    expect(pauseErr).toBeNull();
    expect(pauseData.clock_status).toBe('STOPPED');
    expect(pauseData.time_remaining_seconds).toBeLessThanOrEqual(600);
  });

  it('4. record_basketball_score records +1, +2, +3 and updates player & team scores authoritatively', async () => {
    // Record 2PT for Side A player 1
    const { data: score2, error: err2 } = await scorerClient.rpc('record_basketball_score', {
      p_match_id: matchId,
      p_period_id: activePeriodId,
      p_client_event_id: crypto.randomUUID(),
      p_side: 'SIDE_A',
      p_participant_id: partAIds[0],
      p_scoring_type: 'FIELD_GOAL_2PT',
    });
    expect(err2).toBeNull();
    expect(score2.status).toBe('created');
    expect(score2.points).toBe(2);
    expect(score2.total_score_side_a).toBe(2);

    // Record 3PT for Side B player 1
    const { data: score3, error: err3 } = await scorerClient.rpc('record_basketball_score', {
      p_match_id: matchId,
      p_period_id: activePeriodId,
      p_client_event_id: crypto.randomUUID(),
      p_side: 'SIDE_B',
      p_participant_id: partBIds[0],
      p_scoring_type: 'FIELD_GOAL_3PT',
    });
    expect(err3).toBeNull();
    expect(score3.points).toBe(3);
    expect(score3.total_score_side_b).toBe(3);

    // Record FT (1PT) for Side A player 1
    const { data: score1, error: err1 } = await scorerClient.rpc('record_basketball_score', {
      p_match_id: matchId,
      p_period_id: activePeriodId,
      p_client_event_id: crypto.randomUUID(),
      p_side: 'SIDE_A',
      p_participant_id: partAIds[0],
      p_scoring_type: 'FREE_THROW_1PT',
    });
    expect(err1).toBeNull();
    expect(score1.points).toBe(1);
    expect(score1.total_score_side_a).toBe(3);
  });

  it('5. record_basketball_foul increments personal and team fouls, triggers BONUS at threshold', async () => {
    // Record 4 fouls on Side B player 2
    for (let i = 0; i < 4; i++) {
      const { data, error } = await scorerClient.rpc('record_basketball_foul', {
        p_match_id: matchId,
        p_period_id: activePeriodId,
        p_client_event_id: crypto.randomUUID(),
        p_side: 'SIDE_B',
        p_participant_id: partBIds[1],
        p_foul_type: 'PERSONAL',
      });
      expect(error).toBeNull();
      expect(data.status).toBe('created');
      expect(data.personal_fouls).toBe(i + 1);
    }

    // Record 5th team foul on Side B player 3 to trigger BONUS
    const { data: bonusData, error: bonusErr } = await scorerClient.rpc('record_basketball_foul', {
      p_match_id: matchId,
      p_period_id: activePeriodId,
      p_client_event_id: crypto.randomUUID(),
      p_side: 'SIDE_B',
      p_participant_id: partBIds[2],
      p_foul_type: 'PERSONAL',
    });
    expect(bonusErr).toBeNull();
    expect(bonusData.team_fouls).toBe(5);
    expect(bonusData.is_bonus).toBe(true);

    // Verify state reflects BONUS
    const { data: state } = await scorerClient.rpc('get_basketball_match_state', { p_match_id: matchId });
    expect(state.active_period.side_b_fouls).toBe(5);
  });

  it('6. substitute_basketball_player replaces player with bench substitute while clock is STOPPED', async () => {
    // Sub in bench player (partBIds[5]) for active player (partBIds[2])
    const { data, error } = await scorerClient.rpc('substitute_basketball_player', {
      p_match_id: matchId,
      p_period_id: activePeriodId,
      p_client_event_id: crypto.randomUUID(),
      p_side: 'SIDE_B',
      p_outgoing_participant_id: partBIds[2],
      p_incoming_participant_id: partBIds[5],
    });

    expect(error).toBeNull();
    expect(data.status).toBe('substituted');

    const { data: state } = await scorerClient.rpc('get_basketball_match_state', { p_match_id: matchId });
    const subbedIn = state.lineups_side_b.find((p: any) => p.participant_id === partBIds[5]);
    const subbedOut = state.lineups_side_b.find((p: any) => p.participant_id === partBIds[2]);
    expect(subbedIn.is_on_court).toBe(true);
    expect(subbedOut.is_on_court).toBe(false);
  });

  it('7. record_basketball_timeout pauses clock and decrements remaining timeout count', async () => {
    // Start clock first to verify timeout stops it
    await scorerClient.rpc('update_basketball_clock', {
      p_match_id: matchId,
      p_period_id: activePeriodId,
      p_action: 'START',
      p_client_event_id: crypto.randomUUID(),
    });

    const { data, error } = await scorerClient.rpc('record_basketball_timeout', {
      p_match_id: matchId,
      p_period_id: activePeriodId,
      p_client_event_id: crypto.randomUUID(),
      p_side: 'SIDE_A',
    });

    expect(error).toBeNull();
    expect(data.status).toBe('timeout_recorded');
    expect(data.remaining_timeouts).toBe(3); // Was 4, now 3

    // Verify clock is now STOPPED
    const { data: state } = await scorerClient.rpc('get_basketball_match_state', { p_match_id: matchId });
    expect(state.active_period.clock_status).toBe('STOPPED');
    expect(state.timeouts_remaining_side_a).toBe(3);
  });

  it('8. undo_basketball_event reverses the latest event and restores state authoritatively', async () => {
    const { data, error } = await scorerClient.rpc('undo_basketball_event', {
      p_match_id: matchId,
    });

    expect(error).toBeNull();
    expect(data.status).toBe('undone');
    expect(data.event_type).toBe('TIMEOUT');

    // Verify timeouts restored back to 4
    const { data: state } = await scorerClient.rpc('get_basketball_match_state', { p_match_id: matchId });
    expect(state.timeouts_remaining_side_a).toBe(4);
  });

  it('9. progress_basketball_period advances Q1 to Q2 and resets period team fouls and bonus', async () => {
    const { data, error } = await scorerClient.rpc('progress_basketball_period', {
      p_match_id: matchId,
    });

    expect(error).toBeNull();
    expect(data.status).toBe('period_progressed');
    expect(data.period_number).toBe(2);
    expect(data.duration_seconds).toBe(600);

    // Verify state in Q2: period team fouls reset, bonus reset, scores persist
    const { data: state } = await scorerClient.rpc('get_basketball_match_state', { p_match_id: matchId });
    expect(state.active_period.period_number).toBe(2);
    expect(state.active_period.side_b_fouls).toBe(0);
    expect(state.total_score_side_a).toBe(3);
    expect(state.total_score_side_b).toBe(3);
  });

  it('10. Spectators can read match state but cannot mutate court-side RPCs', async () => {
    // Read works for spectator
    const { data: state, error: readErr } = await spectatorClient.rpc('get_basketball_match_state', {
      p_match_id: matchId,
    });
    expect(readErr).toBeNull();
    expect(state.match_id).toBe(matchId);

    // Mutation is forbidden for spectator
    const { error: mutErr } = await spectatorClient.rpc('record_basketball_score', {
      p_match_id: matchId,
      p_period_id: activePeriodId,
      p_client_event_id: crypto.randomUUID(),
      p_side: 'SIDE_A',
      p_participant_id: partAIds[0],
      p_scoring_type: 'FIELD_GOAL_2PT',
    });
    expect(mutErr).not.toBeNull();
  });

  it('11. Other-tenant scorer is rejected from scoring Org A basketball match', async () => {
    const { error } = await otherTenantClient.rpc('record_basketball_score', {
      p_match_id: matchId,
      p_period_id: activePeriodId,
      p_client_event_id: crypto.randomUUID(),
      p_side: 'SIDE_A',
      p_participant_id: partAIds[0],
      p_scoring_type: 'FIELD_GOAL_2PT',
    });
    expect(error).not.toBeNull();
  });

  it('12. Basketball RPC rejects non-basketball cricket match with INVALID_SPORT', async () => {
    const { error } = await scorerClient.rpc('init_basketball_match', {
      p_match_id: cricketMatchId,
    });
    expect(error).not.toBeNull();
    expect(error?.message).toContain('INVALID_SPORT');
  });
});
