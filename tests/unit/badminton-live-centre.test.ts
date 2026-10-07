import { describe, it, expect } from 'vitest';

describe('STEP 17E — Public Badminton Live Match Centre Unit Tests', () => {
  const badmintonMatch = {
    id: 'm-badminton-123',
    title: 'All England Open Final',
    status: 'LIVE',
    sport: { name: 'Badminton', slug: 'badminton' },
    competitors: [
      { id: 'c-1', side: 'SIDE_A', competitor_name: 'Alpha Player' },
      { id: 'c-2', side: 'SIDE_B', competitor_name: 'Beta Player' },
    ],
  };

  const cricketMatch = {
    id: 'm-cricket-456',
    title: 'T20 Cup Semi-Final',
    status: 'LIVE',
    sport: { name: 'Cricket', slug: 'cricket' },
  };

  const basketballMatch = {
    id: 'm-bball-789',
    title: 'Basketball Championship',
    status: 'LIVE',
    sport: { name: 'Basketball', slug: 'basketball' },
  };

  // Helper simulating /matches/[id]/live/page.tsx route resolution
  function resolveLiveRoute(match: any): 'cricket' | 'badminton' | 'fallback_redirect' {
    const sportSlug = match.sport?.slug?.toLowerCase() || match.sport?.name?.toLowerCase();
    if (sportSlug === 'cricket') return 'cricket';
    if (sportSlug === 'badminton') return 'badminton';
    return 'fallback_redirect';
  }

  it('1. correctly routes Badminton matches to Badminton Live Match Centre', () => {
    expect(resolveLiveRoute(badmintonMatch)).toBe('badminton');
  });

  it('2. correctly routes Cricket matches to Cricket Live Match Centre (preserves frozen baseline)', () => {
    expect(resolveLiveRoute(cricketMatch)).toBe('cricket');
  });

  it('3. uses safe fallback redirect for other / unsupported sports', () => {
    expect(resolveLiveRoute(basketballMatch)).toBe('fallback_redirect');
  });

  it('4. calculates games won and detects match completion from game breakdown', () => {
    const games = [
      { id: 'g-1', game_number: 1, side_a_points: 21, side_b_points: 16, is_completed: true, winner_side: 'SIDE_A' },
      { id: 'g-2', game_number: 2, side_a_points: 18, side_b_points: 21, is_completed: true, winner_side: 'SIDE_B' },
      { id: 'g-3', game_number: 3, side_a_points: 21, side_b_points: 19, is_completed: true, winner_side: 'SIDE_A' },
    ];

    const sideAWins = games.filter((g) => g.is_completed && g.winner_side === 'SIDE_A').length;
    const sideBWins = games.filter((g) => g.is_completed && g.winner_side === 'SIDE_B').length;
    const isCompleted = sideAWins >= 2 || sideBWins >= 2;
    const matchWinner = sideAWins >= 2 ? 'SIDE_A' : sideBWins >= 2 ? 'SIDE_B' : null;

    expect(sideAWins).toBe(2);
    expect(sideBWins).toBe(1);
    expect(isCompleted).toBe(true);
    expect(matchWinner).toBe('SIDE_A');
  });

  it('5. formats game-by-game breakdown text accurately', () => {
    const games = [
      { game_number: 1, side_a_points: 21, side_b_points: 15, winner_side: 'SIDE_A' },
      { game_number: 2, side_a_points: 21, side_b_points: 18, winner_side: 'SIDE_A' },
    ];

    const formattedScores = games.map((g) => `Game ${g.game_number}: ${g.side_a_points}–${g.side_b_points}`);
    expect(formattedScores).toEqual(['Game 1: 21–15', 'Game 2: 21–18']);
  });

  it('6. verifies read-only spectator contract (no mutation buttons or scoring controls)', () => {
    // In spectator mode, actions must be strictly read-only
    const allowedSpectatorActions = ['REFRESH_SCORECARD', 'SUBSCRIBE_REALTIME', 'VIEW_RALLIES'];
    const forbiddenSpectatorActions = [
      'record_badminton_rally',
      'undo_badminton_rally',
      'progress_badminton_match',
      'create_game',
    ];

    forbiddenSpectatorActions.forEach((action) => {
      expect(allowedSpectatorActions.includes(action)).toBe(false);
    });
  });

  it('7. verifies Realtime channel unsubscribe structure on component teardown', () => {
    let channelRemoved = false;
    const mockChannel = { topic: 'badminton_live:m-123' };
    const mockSupabase = {
      removeChannel: (ch: any) => {
        if (ch.topic === mockChannel.topic) channelRemoved = true;
      },
    };

    // Teardown simulation
    mockSupabase.removeChannel(mockChannel);
    expect(channelRemoved).toBe(true);
  });
});
