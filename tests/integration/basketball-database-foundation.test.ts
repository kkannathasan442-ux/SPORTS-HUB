import { describe, it, expect, beforeAll } from 'vitest';
import { createClient, SupabaseClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });

describe('SPORTSHUB STEP 20B — Basketball Database Foundation Tests', () => {
  let supabaseAdmin: SupabaseClient;
  let supabaseAnon: SupabaseClient;
  let basketballSportId: string;
  let cricketSportId: string;
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

    expect(bball).toBeDefined();
    expect(bball?.supports_live_scoring).toBe(true);
    basketballSportId = bball!.id;
    cricketSportId = cricket!.id;

    // Fetch an owner user
    const { data: profiles } = await supabaseAdmin.from('profiles').select('id').limit(1);
    userOwner = profiles![0].id;

    // Create an Organization
    const { data: org, error: orgErr } = await supabaseAdmin
      .from('organizations')
      .insert({
        name: 'Basketball Foundation Arena ' + Date.now(),
        slug: 'bball-foundation-' + Date.now(),
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
        name: 'Lakers Test ' + Date.now(),
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
        name: 'Celtics Test ' + Date.now(),
        sport_id: basketballSportId,
        organization_id: orgId,
        created_by: userOwner,
      })
      .select('id')
      .single();
    teamBId = teamB!.id;
  });

  // Helper to create a basketball match with competitors and participants
  async function createBasketballMatch(title: string) {
    const now = new Date();
    const scheduledStart = new Date(now.getTime() + 60000).toISOString();
    const scheduledEnd = new Date(now.getTime() + 7200000).toISOString();

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
          basketball_config: {
            format: '5V5',
            players_on_court: 5,
            regulation_period_count: 4,
            period_duration_seconds: 600,
            overtime_enabled: true,
            overtime_duration_seconds: 300,
            foul_out_limit: 5,
            team_foul_penalty_threshold: 5,
            timeouts_per_regulation: 4,
            timeouts_per_overtime: 1,
          },
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
        competitor_name: 'Team Alpha',
      })
      .select('id')
      .single();

    const { data: compB } = await supabaseAdmin
      .from('match_competitors')
      .insert({
        match_id: match!.id,
        side: 'SIDE_B',
        team_id: teamBId,
        competitor_name: 'Team Bravo',
      })
      .select('id')
      .single();

    // Create 5 participants for each team
    const partAIds: string[] = [];
    const partBIds: string[] = [];

    for (let i = 1; i <= 5; i++) {
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

    // Now transition match from DRAFT -> SCHEDULED -> LIVE
    await supabaseAdmin.from('matches').update({ status: 'SCHEDULED' }).eq('id', match!.id);
    await supabaseAdmin.from('matches').update({ status: 'LIVE' }).eq('id', match!.id);

    return { matchId: match!.id, compAId: compA!.id, compBId: compB!.id, partAIds, partBIds };
  }

  // 1. Periods table tests
  it('1. verifies basketball_periods creation, duration constraints, and Q1..Q4 progression', async () => {
    const { matchId } = await createBasketballMatch('Periods Test');

    // Create Q1
    const { data: q1, error: q1Err } = await supabaseAdmin
      .from('basketball_periods')
      .insert({
        match_id: matchId,
        period_number: 1,
        period_type: 'REGULAR',
        duration_seconds: 600,
        time_remaining_seconds: 600,
        clock_status: 'STOPPED',
      })
      .select('*')
      .single();

    expect(q1Err).toBeNull();
    expect(q1.period_number).toBe(1);
    expect(q1.period_type).toBe('REGULAR');
    expect(q1.time_remaining_seconds).toBe(600);
    expect(q1.clock_status).toBe('STOPPED');

    // Create Q2, Q3, Q4
    for (let p = 2; p <= 4; p++) {
      const { error } = await supabaseAdmin.from('basketball_periods').insert({
        match_id: matchId,
        period_number: p,
        period_type: 'REGULAR',
        duration_seconds: 600,
        time_remaining_seconds: 600,
      });
      expect(error).toBeNull();
    }

    // Overtime OT1 (period_number = 5)
    const { data: ot1, error: otErr } = await supabaseAdmin
      .from('basketball_periods')
      .insert({
        match_id: matchId,
        period_number: 5,
        period_type: 'OVERTIME',
        duration_seconds: 300,
        time_remaining_seconds: 300,
      })
      .select('*')
      .single();

    expect(otErr).toBeNull();
    expect(ot1.period_type).toBe('OVERTIME');
    expect(ot1.duration_seconds).toBe(300);
  });

  it('2. rejects invalid period constraints (duplicate sequence, invalid duration, invalid type/number combo)', async () => {
    const { matchId } = await createBasketballMatch('Period Constraints Test');

    // Insert Q1
    await supabaseAdmin.from('basketball_periods').insert({
      match_id: matchId,
      period_number: 1,
      period_type: 'REGULAR',
      duration_seconds: 600,
      time_remaining_seconds: 600,
    });

    // Duplicate Q1 must fail (unique constraint)
    const { error: dupErr } = await supabaseAdmin.from('basketball_periods').insert({
      match_id: matchId,
      period_number: 1,
      period_type: 'REGULAR',
      duration_seconds: 600,
      time_remaining_seconds: 600,
    });
    expect(dupErr).not.toBeNull();

    // REGULAR period with period_number > 4 must fail check constraint
    const { error: regErr } = await supabaseAdmin.from('basketball_periods').insert({
      match_id: matchId,
      period_number: 5,
      period_type: 'REGULAR',
      duration_seconds: 600,
      time_remaining_seconds: 600,
    });
    expect(regErr).not.toBeNull();

    // OVERTIME period with period_number < 5 must fail check constraint
    const { error: otErr } = await supabaseAdmin.from('basketball_periods').insert({
      match_id: matchId,
      period_number: 2,
      period_type: 'OVERTIME',
      duration_seconds: 300,
      time_remaining_seconds: 300,
    });
    expect(otErr).not.toBeNull();

    // time_remaining_seconds > duration_seconds must fail
    const { error: timeErr } = await supabaseAdmin.from('basketball_periods').insert({
      match_id: matchId,
      period_number: 2,
      period_type: 'REGULAR',
      duration_seconds: 600,
      time_remaining_seconds: 700,
    });
    expect(timeErr).not.toBeNull();
  });

  // 2. Events table tests
  it('3. verifies basketball_events insertion, scoring integrity, and idempotency', async () => {
    const { matchId, compAId, partAIds } = await createBasketballMatch('Events Test');

    // Create Q1
    const { data: q1 } = await supabaseAdmin
      .from('basketball_periods')
      .insert({
        match_id: matchId,
        period_number: 1,
        period_type: 'REGULAR',
        duration_seconds: 600,
        time_remaining_seconds: 600,
      })
      .select('id')
      .single();

    const clientEventId = crypto.randomUUID();

    // 1-Point Free Throw
    const { data: ftEvent, error: ftErr } = await supabaseAdmin
      .from('basketball_events')
      .insert({
        match_id: matchId,
        period_id: q1!.id,
        sequence_number: 1,
        client_event_id: clientEventId,
        side: 'SIDE_A',
        competitor_id: compAId,
        participant_id: partAIds[0],
        event_type: 'SCORE',
        scoring_type: 'FREE_THROW_1PT',
        points: 1,
        game_clock_seconds: 590,
      })
      .select('*')
      .single();

    expect(ftErr).toBeNull();
    expect(ftEvent.points).toBe(1);
    expect(ftEvent.scoring_type).toBe('FREE_THROW_1PT');

    // 2-Point Field Goal
    const { data: fg2Event, error: fg2Err } = await supabaseAdmin
      .from('basketball_events')
      .insert({
        match_id: matchId,
        period_id: q1!.id,
        sequence_number: 2,
        client_event_id: crypto.randomUUID(),
        side: 'SIDE_A',
        competitor_id: compAId,
        participant_id: partAIds[1],
        event_type: 'SCORE',
        scoring_type: 'FIELD_GOAL_2PT',
        points: 2,
        game_clock_seconds: 575,
      })
      .select('*')
      .single();

    expect(fg2Err).toBeNull();
    expect(fg2Event.points).toBe(2);

    // 3-Point Field Goal
    const { data: fg3Event, error: fg3Err } = await supabaseAdmin
      .from('basketball_events')
      .insert({
        match_id: matchId,
        period_id: q1!.id,
        sequence_number: 3,
        client_event_id: crypto.randomUUID(),
        side: 'SIDE_A',
        competitor_id: compAId,
        participant_id: partAIds[2],
        event_type: 'SCORE',
        scoring_type: 'FIELD_GOAL_3PT',
        points: 3,
        game_clock_seconds: 560,
      })
      .select('*')
      .single();

    expect(fg3Err).toBeNull();
    expect(fg3Event.points).toBe(3);

    // Idempotency: Duplicate client_event_id in the same match must fail
    const { error: dupClientErr } = await supabaseAdmin
      .from('basketball_events')
      .insert({
        match_id: matchId,
        period_id: q1!.id,
        sequence_number: 4,
        client_event_id: clientEventId, // Duplicate!
        side: 'SIDE_A',
        competitor_id: compAId,
        participant_id: partAIds[0],
        event_type: 'SCORE',
        scoring_type: 'FREE_THROW_1PT',
        points: 1,
        game_clock_seconds: 550,
      });

    expect(dupClientErr).not.toBeNull();
  });

  it('4. rejects invalid scoring and foul constraints on basketball_events', async () => {
    const { matchId, compAId, partAIds } = await createBasketballMatch('Event Constraint Rejections');

    const { data: q1 } = await supabaseAdmin
      .from('basketball_periods')
      .insert({
        match_id: matchId,
        period_number: 1,
        duration_seconds: 600,
        time_remaining_seconds: 600,
      })
      .select('id')
      .single();

    // Mismatched points (points = 3 with FREE_THROW_1PT) must fail check constraint
    const { error: mismatchErr } = await supabaseAdmin.from('basketball_events').insert({
      match_id: matchId,
      period_id: q1!.id,
      sequence_number: 1,
      client_event_id: crypto.randomUUID(),
      side: 'SIDE_A',
      competitor_id: compAId,
      participant_id: partAIds[0],
      event_type: 'SCORE',
      scoring_type: 'FREE_THROW_1PT',
      points: 3, // INVALID!
      game_clock_seconds: 500,
    });
    expect(mismatchErr).not.toBeNull();

    // Non-SCORE event with non-zero points must fail
    const { error: nonScoreErr } = await supabaseAdmin.from('basketball_events').insert({
      match_id: matchId,
      period_id: q1!.id,
      sequence_number: 2,
      client_event_id: crypto.randomUUID(),
      side: 'SIDE_A',
      competitor_id: compAId,
      participant_id: partAIds[0],
      event_type: 'TIMEOUT',
      points: 2, // INVALID!
      game_clock_seconds: 500,
    });
    expect(nonScoreErr).not.toBeNull();

    // FOUL event without foul_type must fail
    const { error: foulErr } = await supabaseAdmin.from('basketball_events').insert({
      match_id: matchId,
      period_id: q1!.id,
      sequence_number: 3,
      client_event_id: crypto.randomUUID(),
      side: 'SIDE_A',
      competitor_id: compAId,
      participant_id: partAIds[0],
      event_type: 'FOUL',
      foul_type: null, // INVALID!
      game_clock_seconds: 500,
    });
    expect(foulErr).not.toBeNull();
  });

  // 3. Lineups table tests
  it('5. verifies basketball_lineups registration and uniqueness', async () => {
    const { matchId, compAId, partAIds } = await createBasketballMatch('Lineup Test');

    // Register starting 5
    for (let i = 0; i < 5; i++) {
      const { error } = await supabaseAdmin.from('basketball_lineups').insert({
        match_id: matchId,
        competitor_id: compAId,
        participant_id: partAIds[i],
        is_starter: true,
        is_on_court: true,
      });
      expect(error).toBeNull();
    }

    // Duplicate participant in same match lineup must fail
    const { error: dupPlayerErr } = await supabaseAdmin.from('basketball_lineups').insert({
      match_id: matchId,
      competitor_id: compAId,
      participant_id: partAIds[0],
      is_starter: false,
      is_on_court: false,
    });
    expect(dupPlayerErr).not.toBeNull();
  });

  // 4. Cross-sport protection
  it('6. rejects basketball period or event creation for non-basketball match', async () => {
    // Create a Cricket match
    const now = new Date();
    const { data: cricketMatch } = await supabaseAdmin
      .from('matches')
      .insert({
        title: 'Cricket Protection Test',
        sport_id: cricketSportId,
        organization_id: orgId,
        match_format: 'TEAM',
        status: 'DRAFT',
        scheduled_start: now.toISOString(),
        scheduled_end: new Date(now.getTime() + 3600000).toISOString(),
        created_by: userOwner,
      })
      .select('id')
      .single();

    // Attempting to insert basketball_periods on cricket match must trigger exception
    const { error: crossSportErr } = await supabaseAdmin.from('basketball_periods').insert({
      match_id: cricketMatch!.id,
      period_number: 1,
      period_type: 'REGULAR',
      duration_seconds: 600,
      time_remaining_seconds: 600,
    });

    expect(crossSportErr).not.toBeNull();
    expect(crossSportErr!.message).toContain('INVALID_SPORT');
  });

  // 5. RLS Public Read tests
  it('7. verifies public spectator read access on non-draft basketball matches', async () => {
    const { matchId, compAId, partAIds } = await createBasketballMatch('Public Read Test');

    // Insert Q1
    const { data: q1 } = await supabaseAdmin
      .from('basketball_periods')
      .insert({
        match_id: matchId,
        period_number: 1,
        period_type: 'REGULAR',
        duration_seconds: 600,
        time_remaining_seconds: 600,
      })
      .select('id')
      .single();

    // Insert an event
    await supabaseAdmin.from('basketball_events').insert({
      match_id: matchId,
      period_id: q1!.id,
      sequence_number: 1,
      client_event_id: crypto.randomUUID(),
      side: 'SIDE_A',
      competitor_id: compAId,
      participant_id: partAIds[0],
      event_type: 'SCORE',
      scoring_type: 'FIELD_GOAL_2PT',
      points: 2,
      game_clock_seconds: 580,
    });

    // Public / anon client can read periods
    const { data: anonPeriods, error: anonPeriodErr } = await supabaseAnon
      .from('basketball_periods')
      .select('*')
      .eq('match_id', matchId);

    expect(anonPeriodErr).toBeNull();
    expect(anonPeriods?.length).toBe(1);

    // Public / anon client can read events
    const { data: anonEvents, error: anonEventErr } = await supabaseAnon
      .from('basketball_events')
      .select('*')
      .eq('match_id', matchId);

    expect(anonEventErr).toBeNull();
    expect(anonEvents?.length).toBe(1);
    expect(anonEvents![0].points).toBe(2);
  });
});
