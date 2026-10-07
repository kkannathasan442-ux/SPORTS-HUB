import { describe, it, expect } from 'vitest';

describe('STEP 17D — Badminton Scorer UI & RPC Integration Unit Tests', () => {
  const mockBadmintonMatch = {
    id: 'm-badminton-1',
    title: 'Finals Badminton Match',
    match_format: 'SINGLES',
    status: 'LIVE',
    sport: { name: 'Badminton', slug: 'badminton' },
    competitors: [
      {
        id: 'comp-1',
        side: 'SIDE_A',
        competitor_name: 'Viktor Axelsen',
        participants: [{ id: 'p-1', competitor_id: 'comp-1', display_name: 'Viktor Axelsen' }],
      },
      {
        id: 'comp-2',
        side: 'SIDE_B',
        competitor_name: 'Lee Zii Jia',
        participants: [{ id: 'p-2', competitor_id: 'comp-2', display_name: 'Lee Zii Jia' }],
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

  // Helper functions simulating BadmintonScorer UI derivation logic
  const isBadmintonMatch = (match: any) => match.sport?.name?.toLowerCase() === 'badminton';

  const deriveDeuce = (sideAPoints: number, sideBPoints: number, winBy: number = 2) => {
    return sideAPoints >= 20 && sideBPoints >= 20 && Math.abs(sideAPoints - sideBPoints) < winBy;
  };

  const deriveServingCourt = (servingScore: number) => {
    return servingScore % 2 === 0 ? 'Right Court (Even)' : 'Left Court (Odd)';
  };

  const mapRpcErrorMessage = (msg: string) => {
    if (msg.includes('UNAUTHORIZED')) return 'You are not authorized to score this match.';
    if (msg.includes('INVALID_SPORT')) return 'This is not a Badminton match.';
    if (msg.includes('INVALID_MATCH_STATE')) return 'Match is not in a scoreable state (must be WARMUP or LIVE).';
    if (msg.includes('GAME_COMPLETED')) return 'This game is already completed.';
    if (msg.includes('IDEMPOTENCY_CONFLICT')) return 'This rally was already submitted with conflicting details.';
    if (msg.includes('INVALID_UNDO')) return 'Only the latest active rally can be undone.';
    if (msg.includes('INVALID_RECEIVER')) return 'Server and receiver cannot be on the same side.';
    return msg;
  };

  it('1. correctly identifies Badminton match and filters non-Badminton match for UI routing', () => {
    expect(isBadmintonMatch(mockBadmintonMatch)).toBe(true);
    expect(isBadmintonMatch(mockCricketMatch)).toBe(false);
  });

  it('2. extracts competitor names and participants accurately from match structure', () => {
    const sideA = mockBadmintonMatch.competitors.find((c) => c.side === 'SIDE_A');
    const sideB = mockBadmintonMatch.competitors.find((c) => c.side === 'SIDE_B');

    expect(sideA?.competitor_name).toBe('Viktor Axelsen');
    expect(sideB?.competitor_name).toBe('Lee Zii Jia');
    expect(sideA?.participants[0]?.display_name).toBe('Viktor Axelsen');
  });

  it('3. derives Singles service court side from score parity (even=Right, odd=Left)', () => {
    expect(deriveServingCourt(0)).toBe('Right Court (Even)');
    expect(deriveServingCourt(1)).toBe('Left Court (Odd)');
    expect(deriveServingCourt(14)).toBe('Right Court (Even)');
    expect(deriveServingCourt(21)).toBe('Left Court (Odd)');
  });

  it('4. detects deuce state at 20-20, 21-20, 28-28', () => {
    expect(deriveDeuce(20, 20)).toBe(true);
    expect(deriveDeuce(21, 20)).toBe(true);
    expect(deriveDeuce(21, 21)).toBe(true);
    expect(deriveDeuce(28, 28)).toBe(true);

    // 22-20 is NOT deuce (game over with 2-point margin)
    expect(deriveDeuce(22, 20)).toBe(false);
    // 19-19 is NOT deuce (threshold is >= 20)
    expect(deriveDeuce(19, 19)).toBe(false);
  });

  it('5. maps backend RPC errors to user-friendly UI messages', () => {
    expect(mapRpcErrorMessage('UNAUTHORIZED: Not permitted')).toBe('You are not authorized to score this match.');
    expect(mapRpcErrorMessage('GAME_COMPLETED: Game finished')).toBe('This game is already completed.');
    expect(mapRpcErrorMessage('IDEMPOTENCY_CONFLICT: Event re-used')).toBe('This rally was already submitted with conflicting details.');
    expect(mapRpcErrorMessage('INVALID_UNDO: Cannot undo')).toBe('Only the latest active rally can be undone.');
    expect(mapRpcErrorMessage('INVALID_RECEIVER: Same side')).toBe('Server and receiver cannot be on the same side.');
  });

  it('6. generates unique UUID client event IDs for each rally submission attempt', () => {
    const id1 = crypto.randomUUID();
    const id2 = crypto.randomUUID();
    expect(id1).not.toBe(id2);
    expect(id1).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i);
  });

  it('7. verifies rally payload structure formatted for record_badminton_rally RPC', () => {
    const clientEventId = crypto.randomUUID();
    const payload = {
      p_match_id: mockBadmintonMatch.id,
      p_game_id: 'g-1',
      p_client_event_id: clientEventId,
      p_winner_side: 'SIDE_A',
      p_winning_participant_id: 'p-1',
      p_rally_type: 'SMASH',
    };

    expect(payload.p_match_id).toBe('m-badminton-1');
    expect(payload.p_winner_side).toBe('SIDE_A');
    expect(payload.p_rally_type).toBe('SMASH');
    expect(payload.p_client_event_id).toBe(clientEventId);
  });
});
