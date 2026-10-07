import { describe, it, expect } from 'vitest';
import {
  calculateStrikeRate,
  calculateEconomy,
  formatCricketOvers,
  formatDismissalText,
  getActiveDeliveries,
  calculateExtras,
  calculateBattingScorecard,
  calculateBowlingScorecard,
  calculateFallOfWickets,
  reconcileInnings,
  buildInningsScorecard,
  deriveCricketMatchResult,
  buildFullMatchScorecard,
  CricketDeliveryRecord,
  CricketInningsRecord,
  ParticipantInfo,
  CompetitorInfo,
} from '../../apps/web/src/lib/matches/cricket-scorecard';

describe('STEP 16H — Cricket Scorecard & Analytics Unit Tests', () => {
  const pBatter1: ParticipantInfo = { id: 'p-bat-1', competitor_id: 'comp-a', display_name: 'Alice Batter' };
  const pBatter2: ParticipantInfo = { id: 'p-bat-2', competitor_id: 'comp-a', display_name: 'Bob Opener' };
  const pBatter3: ParticipantInfo = { id: 'p-bat-3', competitor_id: 'comp-a', display_name: 'Charlie Three' };
  const pBowler1: ParticipantInfo = { id: 'p-bowl-1', competitor_id: 'comp-b', display_name: 'Dave Bowler' };
  const pBowler2: ParticipantInfo = { id: 'p-bowl-2', competitor_id: 'comp-b', display_name: 'Evan Spinner' };
  const pFielder: ParticipantInfo = { id: 'p-field-1', competitor_id: 'comp-b', display_name: 'Frank Fielder' };

  const allParticipants = [pBatter1, pBatter2, pBatter3, pBowler1, pBowler2, pFielder];
  const participantMap = new Map<string, ParticipantInfo>(allParticipants.map((p) => [p.id, p]));

  const compA: CompetitorInfo = { id: 'comp-a', side: 'SIDE_A', name: 'Alpha Kings' };
  const compB: CompetitorInfo = { id: 'comp-b', side: 'SIDE_B', name: 'Beta Royals' };
  const competitors = [compA, compB];

  describe('Formatting & Rate Calculations', () => {
    it('formats cricket overs correctly', () => {
      expect(formatCricketOvers(0)).toBe('0.0');
      expect(formatCricketOvers(1)).toBe('0.1');
      expect(formatCricketOvers(5)).toBe('0.5');
      expect(formatCricketOvers(6)).toBe('1.0');
      expect(formatCricketOvers(19)).toBe('3.1');
      expect(formatCricketOvers(120)).toBe('20.0');
    });

    it('calculates strike rate and economy safely with no false 0 or NaN', () => {
      expect(calculateStrikeRate(0, 0)).toBe('—');
      expect(calculateStrikeRate(15, 0)).toBe('—');
      expect(calculateStrikeRate(25, 10)).toBe('250.00');
      expect(calculateStrikeRate(40, 30)).toBe('133.33');

      expect(calculateEconomy(0, 0)).toBe('—');
      expect(calculateEconomy(24, 24)).toBe('6.00'); // 4 overs, 24 runs = 6.00
      expect(calculateEconomy(25, 20)).toBe('7.50'); // 3.2 overs (20 legal balls)
    });

    it('formats dismissal descriptions according to cricket conventions', () => {
      expect(formatDismissalText(null, 'Dave Bowler')).toBe('not out');
      expect(formatDismissalText('BOWLED', 'Dave Bowler')).toBe('b Dave Bowler');
      expect(formatDismissalText('CAUGHT', 'Dave Bowler', 'Frank Fielder')).toBe('c Frank Fielder b Dave Bowler');
      expect(formatDismissalText('CAUGHT', 'Dave Bowler', 'Dave Bowler')).toBe('c & b Dave Bowler');
      expect(formatDismissalText('LBW', 'Dave Bowler')).toBe('lbw b Dave Bowler');
      expect(formatDismissalText('STUMPED', 'Dave Bowler', 'Frank Fielder')).toBe('st †Frank Fielder b Dave Bowler');
      expect(formatDismissalText('RUN_OUT', 'Dave Bowler', 'Frank Fielder')).toBe('run out (Frank Fielder)');
      expect(formatDismissalText('HIT_WICKET', 'Dave Bowler')).toBe('hit wicket b Dave Bowler');
      expect(formatDismissalText('RETIRED_HURT', 'Dave Bowler')).toBe('retired hurt');
    });
  });

  describe('Active Deliveries & Soft Undo Filter', () => {
    it('strictly excludes voided deliveries (voided_at IS NOT NULL)', () => {
      const deliveries: CricketDeliveryRecord[] = [
        {
          id: 'd1',
          match_id: 'm1',
          innings_id: 'inn1',
          sequence_number: 1,
          over_number: 0,
          ball_number: 1,
          striker_participant_id: pBatter1.id,
          non_striker_participant_id: pBatter2.id,
          bowler_participant_id: pBowler1.id,
          runs_off_bat: 4,
          extras_amount: 0,
          extras_type: 'NONE',
          is_legal_delivery: true,
          is_wicket: false,
          voided_at: null,
        },
        {
          id: 'd2',
          match_id: 'm1',
          innings_id: 'inn1',
          sequence_number: 2,
          over_number: 0,
          ball_number: 2,
          striker_participant_id: pBatter1.id,
          non_striker_participant_id: pBatter2.id,
          bowler_participant_id: pBowler1.id,
          runs_off_bat: 6,
          extras_amount: 0,
          extras_type: 'NONE',
          is_legal_delivery: true,
          is_wicket: false,
          voided_at: '2026-10-06T10:00:00Z', // UNDONE / VOIDED!
        },
      ];

      const active = getActiveDeliveries(deliveries);
      expect(active.length).toBe(1);
      expect(active[0].id).toBe('d1');
      expect(active[0].runs_off_bat).toBe(4);
    });
  });

  describe('Extras Calculation', () => {
    it('aggregates all extras types accurately', () => {
      const deliveries: CricketDeliveryRecord[] = [
        {
          id: 'd1', match_id: 'm1', innings_id: 'inn1', sequence_number: 1,
          over_number: 0, ball_number: 1, striker_participant_id: pBatter1.id,
          non_striker_participant_id: pBatter2.id, bowler_participant_id: pBowler1.id,
          runs_off_bat: 0, extras_amount: 1, extras_type: 'WIDE', is_legal_delivery: false, is_wicket: false,
        },
        {
          id: 'd2', match_id: 'm1', innings_id: 'inn1', sequence_number: 2,
          over_number: 0, ball_number: 1, striker_participant_id: pBatter1.id,
          non_striker_participant_id: pBatter2.id, bowler_participant_id: pBowler1.id,
          runs_off_bat: 0, extras_amount: 1, extras_type: 'NO_BALL', is_legal_delivery: false, is_wicket: false,
        },
        {
          id: 'd3', match_id: 'm1', innings_id: 'inn1', sequence_number: 3,
          over_number: 0, ball_number: 1, striker_participant_id: pBatter1.id,
          non_striker_participant_id: pBatter2.id, bowler_participant_id: pBowler1.id,
          runs_off_bat: 0, extras_amount: 4, extras_type: 'BYE', is_legal_delivery: true, is_wicket: false,
        },
        {
          id: 'd4', match_id: 'm1', innings_id: 'inn1', sequence_number: 4,
          over_number: 0, ball_number: 2, striker_participant_id: pBatter1.id,
          non_striker_participant_id: pBatter2.id, bowler_participant_id: pBowler1.id,
          runs_off_bat: 0, extras_amount: 2, extras_type: 'LEG_BYE', is_legal_delivery: true, is_wicket: false,
        },
        {
          id: 'd5', match_id: 'm1', innings_id: 'inn1', sequence_number: 5,
          over_number: 0, ball_number: 3, striker_participant_id: pBatter1.id,
          non_striker_participant_id: pBatter2.id, bowler_participant_id: pBowler1.id,
          runs_off_bat: 0, extras_amount: 5, extras_type: 'PENALTY', is_legal_delivery: true, is_wicket: false,
        },
      ];

      const extras = calculateExtras(deliveries);
      expect(extras.wides).toBe(1);
      expect(extras.noBalls).toBe(1);
      expect(extras.byes).toBe(4);
      expect(extras.legByes).toBe(2);
      expect(extras.penalty).toBe(5);
      expect(extras.total).toBe(13);
    });
  });

  describe('Batting Scorecard Statistics', () => {
    it('does not count wides towards balls faced or batter runs', () => {
      const deliveries: CricketDeliveryRecord[] = [
        {
          id: 'd1', match_id: 'm1', innings_id: 'inn1', sequence_number: 1,
          over_number: 0, ball_number: 1, striker_participant_id: pBatter1.id,
          non_striker_participant_id: pBatter2.id, bowler_participant_id: pBowler1.id,
          runs_off_bat: 0, extras_amount: 1, extras_type: 'WIDE', is_legal_delivery: false, is_wicket: false,
        },
        {
          id: 'd2', match_id: 'm1', innings_id: 'inn1', sequence_number: 2,
          over_number: 0, ball_number: 1, striker_participant_id: pBatter1.id,
          non_striker_participant_id: pBatter2.id, bowler_participant_id: pBowler1.id,
          runs_off_bat: 4, extras_amount: 0, extras_type: 'NONE', is_legal_delivery: true, is_wicket: false,
        },
      ];

      const rows = calculateBattingScorecard(deliveries, [pBatter1, pBatter2, pBatter3], participantMap);
      const row1 = rows.find((r) => r.participantId === pBatter1.id)!;

      expect(row1.runs).toBe(4);
      expect(row1.ballsFaced).toBe(1); // wide does NOT count as ball faced!
      expect(row1.fours).toBe(1);
      expect(row1.sixes).toBe(0);
      expect(row1.strikeRate).toBe('400.00');
      expect(row1.dismissalText).toBe('not out');

      // Batter 3 did not bat
      const row3 = rows.find((r) => r.participantId === pBatter3.id)!;
      expect(row3.hasBatted).toBe(false);
      expect(row3.dismissalText).toBe('did not bat');
    });

    it('counts no-balls as balls faced by striker', () => {
      const deliveries: CricketDeliveryRecord[] = [
        {
          id: 'd1', match_id: 'm1', innings_id: 'inn1', sequence_number: 1,
          over_number: 0, ball_number: 1, striker_participant_id: pBatter1.id,
          non_striker_participant_id: pBatter2.id, bowler_participant_id: pBowler1.id,
          runs_off_bat: 2, extras_amount: 1, extras_type: 'NO_BALL', is_legal_delivery: false, is_wicket: false,
        },
      ];

      const rows = calculateBattingScorecard(deliveries, [pBatter1], participantMap);
      const row1 = rows.find((r) => r.participantId === pBatter1.id)!;
      expect(row1.runs).toBe(2);
      expect(row1.ballsFaced).toBe(1); // Faced the no-ball
    });

    it('records dismissal correctly for bowled and caught', () => {
      const deliveries: CricketDeliveryRecord[] = [
        {
          id: 'd1', match_id: 'm1', innings_id: 'inn1', sequence_number: 1,
          over_number: 0, ball_number: 1, striker_participant_id: pBatter1.id,
          non_striker_participant_id: pBatter2.id, bowler_participant_id: pBowler1.id,
          runs_off_bat: 0, extras_amount: 0, extras_type: 'NONE', is_legal_delivery: true,
          is_wicket: true, dismissal_type: 'BOWLED', dismissed_participant_id: pBatter1.id,
        },
      ];

      const rows = calculateBattingScorecard(deliveries, [pBatter1], participantMap);
      const row1 = rows.find((r) => r.participantId === pBatter1.id)!;
      expect(row1.isOut).toBe(true);
      expect(row1.dismissalText).toBe('b Dave Bowler');
    });
  });

  describe('Bowling Scorecard Statistics & Maidens', () => {
    it('charges runs off bat, wides, and no-balls to bowler, but excludes byes and leg-byes', () => {
      const deliveries: CricketDeliveryRecord[] = [
        {
          id: 'd1', match_id: 'm1', innings_id: 'inn1', sequence_number: 1,
          over_number: 0, ball_number: 1, striker_participant_id: pBatter1.id,
          non_striker_participant_id: pBatter2.id, bowler_participant_id: pBowler1.id,
          runs_off_bat: 2, extras_amount: 0, extras_type: 'NONE', is_legal_delivery: true, is_wicket: false,
        },
        {
          id: 'd2', match_id: 'm1', innings_id: 'inn1', sequence_number: 2,
          over_number: 0, ball_number: 1, striker_participant_id: pBatter1.id,
          non_striker_participant_id: pBatter2.id, bowler_participant_id: pBowler1.id,
          runs_off_bat: 0, extras_amount: 1, extras_type: 'WIDE', is_legal_delivery: false, is_wicket: false,
        },
        {
          id: 'd3', match_id: 'm1', innings_id: 'inn1', sequence_number: 3,
          over_number: 0, ball_number: 2, striker_participant_id: pBatter1.id,
          non_striker_participant_id: pBatter2.id, bowler_participant_id: pBowler1.id,
          runs_off_bat: 0, extras_amount: 4, extras_type: 'BYE', is_legal_delivery: true, is_wicket: false,
        },
      ];

      const rows = calculateBowlingScorecard(deliveries, participantMap);
      const bRow = rows.find((r) => r.participantId === pBowler1.id)!;

      expect(bRow.legalDeliveries).toBe(2);
      expect(bRow.overs).toBe('0.2');
      // Conceded: 2 (off bat) + 1 (wide) = 3 runs. Byes are 0 against bowler!
      expect(bRow.runsConceded).toBe(3);
      expect(bRow.economy).toBe('9.00'); // (3 runs * 6) / 2 legal balls = 9.00
    });

    it('credits bowler with wickets (bowled, caught) but NOT run-out or retired hurt', () => {
      const deliveries: CricketDeliveryRecord[] = [
        {
          id: 'd1', match_id: 'm1', innings_id: 'inn1', sequence_number: 1,
          over_number: 0, ball_number: 1, striker_participant_id: pBatter1.id,
          non_striker_participant_id: pBatter2.id, bowler_participant_id: pBowler1.id,
          runs_off_bat: 0, extras_amount: 0, extras_type: 'NONE', is_legal_delivery: true,
          is_wicket: true, dismissal_type: 'BOWLED', dismissed_participant_id: pBatter1.id,
        },
        {
          id: 'd2', match_id: 'm1', innings_id: 'inn1', sequence_number: 2,
          over_number: 0, ball_number: 2, striker_participant_id: pBatter2.id,
          non_striker_participant_id: pBatter3.id, bowler_participant_id: pBowler1.id,
          runs_off_bat: 0, extras_amount: 0, extras_type: 'NONE', is_legal_delivery: true,
          is_wicket: true, dismissal_type: 'RUN_OUT', dismissed_participant_id: pBatter3.id,
        },
      ];

      const rows = calculateBowlingScorecard(deliveries, participantMap);
      const bRow = rows.find((r) => r.participantId === pBowler1.id)!;

      expect(bRow.wickets).toBe(1); // Only the BOWLED dismissal counts!
    });

    it('accurately identifies maiden overs (6 legal balls, 0 conceded runs, byes allowed)', () => {
      // 6 legal balls in over 0 conceding 0 runs off bat, but with 2 byes (which do not break maiden)
      const deliveries: CricketDeliveryRecord[] = [1, 2, 3, 4, 5, 6].map((ballNum) => ({
        id: `d${ballNum}`,
        match_id: 'm1',
        innings_id: 'inn1',
        sequence_number: ballNum,
        over_number: 0,
        ball_number: ballNum,
        striker_participant_id: pBatter1.id,
        non_striker_participant_id: pBatter2.id,
        bowler_participant_id: pBowler1.id,
        runs_off_bat: 0,
        extras_amount: ballNum === 3 ? 2 : 0,
        extras_type: ballNum === 3 ? 'BYE' : 'NONE',
        is_legal_delivery: true,
        is_wicket: false,
      }));

      const rows = calculateBowlingScorecard(deliveries, participantMap);
      const bRow = rows.find((r) => r.participantId === pBowler1.id)!;

      expect(bRow.legalDeliveries).toBe(6);
      expect(bRow.overs).toBe('1.0');
      expect(bRow.runsConceded).toBe(0);
      expect(bRow.maidens).toBe(1); // Maiden achieved!
    });
  });

  describe('Fall of Wickets', () => {
    it('constructs sequential fall of wickets with cumulative scores and overs', () => {
      const deliveries: CricketDeliveryRecord[] = [
        {
          id: 'd1', match_id: 'm1', innings_id: 'inn1', sequence_number: 1,
          over_number: 0, ball_number: 1, striker_participant_id: pBatter1.id,
          non_striker_participant_id: pBatter2.id, bowler_participant_id: pBowler1.id,
          runs_off_bat: 4, extras_amount: 0, extras_type: 'NONE', is_legal_delivery: true, is_wicket: false,
        },
        {
          id: 'd2', match_id: 'm1', innings_id: 'inn1', sequence_number: 2,
          over_number: 0, ball_number: 2, striker_participant_id: pBatter1.id,
          non_striker_participant_id: pBatter2.id, bowler_participant_id: pBowler1.id,
          runs_off_bat: 0, extras_amount: 0, extras_type: 'NONE', is_legal_delivery: true,
          is_wicket: true, dismissal_type: 'BOWLED', dismissed_participant_id: pBatter1.id,
        },
        {
          id: 'd3', match_id: 'm1', innings_id: 'inn1', sequence_number: 3,
          over_number: 0, ball_number: 3, striker_participant_id: pBatter3.id,
          non_striker_participant_id: pBatter2.id, bowler_participant_id: pBowler1.id,
          runs_off_bat: 6, extras_amount: 0, extras_type: 'NONE', is_legal_delivery: true, is_wicket: false,
        },
        {
          id: 'd4', match_id: 'm1', innings_id: 'inn1', sequence_number: 4,
          over_number: 0, ball_number: 4, striker_participant_id: pBatter3.id,
          non_striker_participant_id: pBatter2.id, bowler_participant_id: pBowler1.id,
          runs_off_bat: 0, extras_amount: 0, extras_type: 'NONE', is_legal_delivery: true,
          is_wicket: true, dismissal_type: 'LBW', dismissed_participant_id: pBatter3.id,
        },
      ];

      const fow = calculateFallOfWickets(deliveries, participantMap);
      expect(fow.length).toBe(2);
      expect(fow[0]).toEqual({
        wicketNumber: 1,
        dismissedParticipantId: pBatter1.id,
        dismissedPlayerName: 'Alice Batter',
        score: 4,
        overs: '0.2',
      });
      expect(fow[1]).toEqual({
        wicketNumber: 2,
        dismissedParticipantId: pBatter3.id,
        dismissedPlayerName: 'Charlie Three',
        score: 10,
        overs: '0.4',
      });
    });
  });

  describe('Reconciliation', () => {
    it('verifies that derived totals reconcile with the authoritative snapshot', () => {
      const innings: CricketInningsRecord = {
        id: 'inn1',
        match_id: 'm1',
        innings_number: 1,
        batting_competitor_id: 'comp-a',
        bowling_competitor_id: 'comp-b',
        total_runs: 10,
        total_wickets: 1,
        legal_balls: 5,
      };

      const deliveries: CricketDeliveryRecord[] = [
        {
          id: 'd1', match_id: 'm1', innings_id: 'inn1', sequence_number: 1,
          over_number: 0, ball_number: 1, striker_participant_id: pBatter1.id,
          non_striker_participant_id: pBatter2.id, bowler_participant_id: pBowler1.id,
          runs_off_bat: 4, extras_amount: 0, extras_type: 'NONE', is_legal_delivery: true, is_wicket: false,
        },
        {
          id: 'd2', match_id: 'm1', innings_id: 'inn1', sequence_number: 2,
          over_number: 0, ball_number: 2, striker_participant_id: pBatter1.id,
          non_striker_participant_id: pBatter2.id, bowler_participant_id: pBowler1.id,
          runs_off_bat: 0, extras_amount: 1, extras_type: 'WIDE', is_legal_delivery: false, is_wicket: false,
        },
        {
          id: 'd3', match_id: 'm1', innings_id: 'inn1', sequence_number: 3,
          over_number: 0, ball_number: 2, striker_participant_id: pBatter1.id,
          non_striker_participant_id: pBatter2.id, bowler_participant_id: pBowler1.id,
          runs_off_bat: 1, extras_amount: 0, extras_type: 'NONE', is_legal_delivery: true, is_wicket: false,
        },
        {
          id: 'd4', match_id: 'm1', innings_id: 'inn1', sequence_number: 4,
          over_number: 0, ball_number: 3, striker_participant_id: pBatter2.id,
          non_striker_participant_id: pBatter1.id, bowler_participant_id: pBowler1.id,
          runs_off_bat: 4, extras_amount: 0, extras_type: 'NONE', is_legal_delivery: true, is_wicket: false,
        },
        {
          id: 'd5', match_id: 'm1', innings_id: 'inn1', sequence_number: 5,
          over_number: 0, ball_number: 4, striker_participant_id: pBatter2.id,
          non_striker_participant_id: pBatter1.id, bowler_participant_id: pBowler1.id,
          runs_off_bat: 0, extras_amount: 0, extras_type: 'NONE', is_legal_delivery: true,
          is_wicket: true, dismissal_type: 'BOWLED', dismissed_participant_id: pBatter2.id,
        },
        {
          id: 'd6', match_id: 'm1', innings_id: 'inn1', sequence_number: 6,
          over_number: 0, ball_number: 5, striker_participant_id: pBatter3.id,
          non_striker_participant_id: pBatter1.id, bowler_participant_id: pBowler1.id,
          runs_off_bat: 0, extras_amount: 0, extras_type: 'NONE', is_legal_delivery: true, is_wicket: false,
        },
      ];

      const batting = calculateBattingScorecard(deliveries, [pBatter1, pBatter2, pBatter3], participantMap);
      const extras = calculateExtras(deliveries);
      const recon = reconcileInnings(innings, batting, extras, deliveries);

      expect(recon.runsMatch).toBe(true);
      expect(recon.wicketsMatch).toBe(true);
      expect(recon.legalBallsMatch).toBe(true);
      expect(recon.isFullyReconciled).toBe(true);
      expect(recon.discrepancyNote).toBeUndefined();
    });

    it('detects and flags discrepancies if snapshot does not match derived values', () => {
      const corruptInnings: CricketInningsRecord = {
        id: 'inn1',
        match_id: 'm1',
        innings_number: 1,
        batting_competitor_id: 'comp-a',
        bowling_competitor_id: 'comp-b',
        total_runs: 50, // Corrupt! Derived is only 4
        total_wickets: 0,
        legal_balls: 1,
      };

      const deliveries: CricketDeliveryRecord[] = [
        {
          id: 'd1', match_id: 'm1', innings_id: 'inn1', sequence_number: 1,
          over_number: 0, ball_number: 1, striker_participant_id: pBatter1.id,
          non_striker_participant_id: pBatter2.id, bowler_participant_id: pBowler1.id,
          runs_off_bat: 4, extras_amount: 0, extras_type: 'NONE', is_legal_delivery: true, is_wicket: false,
        },
      ];

      const batting = calculateBattingScorecard(deliveries, [pBatter1], participantMap);
      const extras = calculateExtras(deliveries);
      const recon = reconcileInnings(corruptInnings, batting, extras, deliveries);

      expect(recon.runsMatch).toBe(false);
      expect(recon.isFullyReconciled).toBe(false);
      expect(recon.discrepancyNote).toContain('Runs: derived 4 vs snapshot 50');
    });
  });

  describe('Result Derivation', () => {
    it('returns null for non-completed matches', () => {
      expect(deriveCricketMatchResult('LIVE', [], competitors)).toBeNull();
      expect(deriveCricketMatchResult('WARMUP', [], competitors)).toBeNull();
    });

    it('determines win by wickets when second innings exceeds target', () => {
      const inn1: CricketInningsRecord = {
        id: 'inn1', match_id: 'm1', innings_number: 1,
        batting_competitor_id: compA.id, bowling_competitor_id: compB.id,
        total_runs: 150, total_wickets: 7, legal_balls: 120,
      };
      const inn2: CricketInningsRecord = {
        id: 'inn2', match_id: 'm1', innings_number: 2,
        batting_competitor_id: compB.id, bowling_competitor_id: compA.id,
        total_runs: 151, total_wickets: 4, legal_balls: 110,
      };

      const result = deriveCricketMatchResult('COMPLETED', [inn1, inn2], competitors);
      expect(result).toBe('Beta Royals won by 6 wickets');
    });

    it('determines win by runs when first innings score is greater', () => {
      const inn1: CricketInningsRecord = {
        id: 'inn1', match_id: 'm1', innings_number: 1,
        batting_competitor_id: compA.id, bowling_competitor_id: compB.id,
        total_runs: 180, total_wickets: 5, legal_balls: 120,
      };
      const inn2: CricketInningsRecord = {
        id: 'inn2', match_id: 'm1', innings_number: 2,
        batting_competitor_id: compB.id, bowling_competitor_id: compA.id,
        total_runs: 165, total_wickets: 9, legal_balls: 120,
      };

      const result = deriveCricketMatchResult('COMPLETED', [inn1, inn2], competitors);
      expect(result).toBe('Alpha Kings won by 15 runs');
    });

    it('determines a tie when scores are equal', () => {
      const inn1: CricketInningsRecord = {
        id: 'inn1', match_id: 'm1', innings_number: 1,
        batting_competitor_id: compA.id, bowling_competitor_id: compB.id,
        total_runs: 140, total_wickets: 8, legal_balls: 120,
      };
      const inn2: CricketInningsRecord = {
        id: 'inn2', match_id: 'm1', innings_number: 2,
        batting_competitor_id: compB.id, bowling_competitor_id: compA.id,
        total_runs: 140, total_wickets: 10, legal_balls: 118,
      };

      const result = deriveCricketMatchResult('COMPLETED', [inn1, inn2], competitors);
      expect(result).toBe('Match Tied');
    });
  });

  describe('Full Scorecard Assembly', () => {
    it('assembles a full multi-innings match scorecard with zero errors', () => {
      const inn1: CricketInningsRecord = {
        id: 'inn1', match_id: 'm1', innings_number: 1,
        batting_competitor_id: compA.id, bowling_competitor_id: compB.id,
        total_runs: 4, total_wickets: 0, legal_balls: 1,
      };
      const deliveries: CricketDeliveryRecord[] = [
        {
          id: 'd1', match_id: 'm1', innings_id: 'inn1', sequence_number: 1,
          over_number: 0, ball_number: 1, striker_participant_id: pBatter1.id,
          non_striker_participant_id: pBatter2.id, bowler_participant_id: pBowler1.id,
          runs_off_bat: 4, extras_amount: 0, extras_type: 'NONE', is_legal_delivery: true, is_wicket: false,
        },
      ];

      const fullCard = buildFullMatchScorecard(
        'm1',
        'COMPLETED',
        null,
        [inn1],
        deliveries,
        allParticipants,
        competitors
      );

      expect(fullCard.matchId).toBe('m1');
      expect(fullCard.status).toBe('COMPLETED');
      expect(fullCard.innings.length).toBe(1);
      expect(fullCard.innings[0].batting.length).toBeGreaterThan(0);
      expect(fullCard.innings[0].bowling.length).toBe(1);
      expect(fullCard.innings[0].reconciliation.isFullyReconciled).toBe(true);
    });
  });
});
