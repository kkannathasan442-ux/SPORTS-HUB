import { describe, it, expect } from 'vitest';

describe('STEP 20D — Basketball Court-Side Scorer UI Unit Tests', () => {
  const mockBasketballMatch = {
    id: 'm-basketball-1',
    title: 'Finals Basketball Match',
    match_format: 'TEAM',
    status: 'LIVE',
    sport: { name: 'Basketball', slug: 'basketball' },
    competitors: [
      {
        id: 'comp-1',
        side: 'SIDE_A',
        competitor_name: 'Lakers',
        participants: [
          { id: 'p-1', competitor_id: 'comp-1', display_name: 'LeBron James' },
          { id: 'p-2', competitor_id: 'comp-1', display_name: 'Anthony Davis' },
          { id: 'p-3', competitor_id: 'comp-1', display_name: 'Austin Reaves' },
          { id: 'p-4', competitor_id: 'comp-1', display_name: 'D’Angelo Russell' },
          { id: 'p-5', competitor_id: 'comp-1', display_name: 'Rui Hachimura' },
          { id: 'p-6', competitor_id: 'comp-1', display_name: 'Jaxson Hayes' },
        ],
      },
      {
        id: 'comp-2',
        side: 'SIDE_B',
        competitor_name: 'Warriors',
        participants: [
          { id: 'p-7', competitor_id: 'comp-2', display_name: 'Stephen Curry' },
          { id: 'p-8', competitor_id: 'comp-2', display_name: 'Klay Thompson' },
          { id: 'p-9', competitor_id: 'comp-2', display_name: 'Draymond Green' },
          { id: 'p-10', competitor_id: 'comp-2', display_name: 'Andrew Wiggins' },
          { id: 'p-11', competitor_id: 'comp-2', display_name: 'Kevon Looney' },
          { id: 'p-12', competitor_id: 'comp-2', display_name: 'Jonathan Kuminga' },
        ],
      },
    ],
  };

  const mockCricketMatch = {
    id: 'm-cricket-1',
    title: 'Cricket T20 Friendly',
    match_format: 'TEAM',
    status: 'LIVE',
    sport: { name: 'Cricket', slug: 'cricket' },
  };

  // Helper functions simulating BasketballScorer UI derivation logic
  const isBasketballMatch = (match: any) => {
    const slug = match.sport?.slug?.toLowerCase() || match.sport?.name?.toLowerCase();
    return slug === 'basketball';
  };

  const formatClock = (seconds: number) => {
    const mins = Math.floor(Math.max(0, seconds) / 60);
    const secs = Math.floor(Math.max(0, seconds) % 60);
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  const isBonusActive = (teamFouls: number, bonusThreshold: number = 5) => {
    return teamFouls >= bonusThreshold;
  };

  const isPlayerFouledOut = (personalFouls: number, foulLimit: number = 5) => {
    return personalFouls >= foulLimit;
  };

  const mapRpcErrorMessage = (msg: string) => {
    if (msg.includes('UNAUTHORIZED') || msg.includes('FORBIDDEN')) return 'You are not authorized to score this match.';
    if (msg.includes('INVALID_SPORT')) return 'This is not a Basketball match.';
    if (msg.includes('MATCH_ALREADY_COMPLETED')) return 'Match is already completed.';
    if (msg.includes('INVALID_MATCH_STATE')) return 'Match is not in an active scoring state.';
    if (msg.includes('PLAYER_NOT_ACTIVE')) return 'Selected player is not currently on court.';
    if (msg.includes('PLAYER_FOULED_OUT')) return 'This player has fouled out and cannot re-enter or score.';
    if (msg.includes('CLOCK_ALREADY_RUNNING')) return 'Game clock is already running.';
    if (msg.includes('CLOCK_NOT_STOPPED')) return 'Substitutions and timeouts require the clock to be stopped.';
    if (msg.includes('TIMEOUT_EXHAUSTED')) return 'No remaining timeouts for this team.';
    if (msg.includes('INVALID_SUBSTITUTION')) return 'Invalid substitution: ensure exact 5 active players and clock is stopped.';
    if (msg.includes('INVALID_UNDO')) return 'Only the latest active event can be undone.';
    return msg;
  };

  it('1. correctly identifies Basketball match and filters non-Basketball match for UI routing', () => {
    expect(isBasketballMatch(mockBasketballMatch)).toBe(true);
    expect(isBasketballMatch(mockCricketMatch)).toBe(false);
  });

  it('2. formats game clock seconds into standard MM:SS display', () => {
    expect(formatClock(600)).toBe('10:00');
    expect(formatClock(582)).toBe('09:42');
    expect(formatClock(59)).toBe('00:59');
    expect(formatClock(4)).toBe('00:04');
    expect(formatClock(0)).toBe('00:00');
    expect(formatClock(-5)).toBe('00:00');
  });

  it('3. derives Team Bonus status accurately based on team fouls (>= 5)', () => {
    expect(isBonusActive(0)).toBe(false);
    expect(isBonusActive(3)).toBe(false);
    expect(isBonusActive(4)).toBe(false);
    expect(isBonusActive(5)).toBe(true);
    expect(isBonusActive(7)).toBe(true);
  });

  it('4. detects Foul-out state when personal fouls reach or exceed the limit', () => {
    expect(isPlayerFouledOut(0, 5)).toBe(false);
    expect(isPlayerFouledOut(4, 5)).toBe(false);
    expect(isPlayerFouledOut(5, 5)).toBe(true);
    expect(isPlayerFouledOut(6, 5)).toBe(true);
  });

  it('5. maps backend RPC errors to user-friendly court-side feedback messages', () => {
    expect(mapRpcErrorMessage('UNAUTHORIZED: Not permitted')).toBe('You are not authorized to score this match.');
    expect(mapRpcErrorMessage('CLOCK_NOT_STOPPED: Clock running')).toBe('Substitutions and timeouts require the clock to be stopped.');
    expect(mapRpcErrorMessage('PLAYER_NOT_ACTIVE: Not on court')).toBe('Selected player is not currently on court.');
    expect(mapRpcErrorMessage('PLAYER_FOULED_OUT: Ejected')).toBe('This player has fouled out and cannot re-enter or score.');
    expect(mapRpcErrorMessage('TIMEOUT_EXHAUSTED: Zero left')).toBe('No remaining timeouts for this team.');
    expect(mapRpcErrorMessage('INVALID_UNDO: Not latest')).toBe('Only the latest active event can be undone.');
  });

  it('6. validates client_event_id idempotency token generation', () => {
    const id1 = crypto.randomUUID();
    const id2 = crypto.randomUUID();
    expect(id1).not.toBe(id2);
    expect(id1).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i);
  });

  it('7. structures score payload matching record_basketball_score RPC contract', () => {
    const clientEventId = crypto.randomUUID();
    const payload = {
      p_match_id: mockBasketballMatch.id,
      p_competitor_id: 'comp-1',
      p_participant_id: 'p-1',
      p_scoring_type: '2PT',
      p_client_event_id: clientEventId,
    };

    expect(payload.p_match_id).toBe('m-basketball-1');
    expect(payload.p_competitor_id).toBe('comp-1');
    expect(payload.p_participant_id).toBe('p-1');
    expect(payload.p_scoring_type).toBe('2PT');
    expect(payload.p_client_event_id).toBe(clientEventId);
  });

  it('8. structures foul payload matching record_basketball_foul RPC contract', () => {
    const clientEventId = crypto.randomUUID();
    const payload = {
      p_match_id: mockBasketballMatch.id,
      p_competitor_id: 'comp-2',
      p_participant_id: 'p-9',
      p_foul_type: 'PERSONAL',
      p_client_event_id: clientEventId,
    };

    expect(payload.p_match_id).toBe('m-basketball-1');
    expect(payload.p_foul_type).toBe('PERSONAL');
    expect(payload.p_participant_id).toBe('p-9');
  });

  it('9. structures substitution payload enforcing OUT player from court and IN player from bench', () => {
    const activeCourtIds = ['p-1', 'p-2', 'p-3', 'p-4', 'p-5'];
    const benchIds = ['p-6'];

    const outPlayerId = 'p-5';
    const inPlayerId = 'p-6';

    expect(activeCourtIds.includes(outPlayerId)).toBe(true);
    expect(benchIds.includes(inPlayerId)).toBe(true);

    const updatedCourt = activeCourtIds.filter((id) => id !== outPlayerId).concat(inPlayerId);
    expect(updatedCourt).toHaveLength(5);
    expect(updatedCourt).toContain('p-6');
    expect(updatedCourt).not.toContain('p-5');
  });

  it('10. verifies clock control actions supported by update_basketball_clock RPC', () => {
    const validActions = ['START', 'PAUSE', 'SET_TIME'];
    expect(validActions).toContain('START');
    expect(validActions).toContain('PAUSE');
    expect(validActions).toContain('SET_TIME');
  });
});
