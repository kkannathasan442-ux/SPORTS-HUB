import { describe, it, expect } from 'vitest';
const uuidv4 = () => Math.random().toString(36).substring(2, 10);
import {
  buildInningsScorecard,
  buildFullMatchScorecard,
  deriveCricketMatchResult,
  calculateStrikeRate,
  calculateEconomy,
  formatCricketOvers,
  formatDismissalText,
  getActiveDeliveries,
  CricketDeliveryRecord,
  CricketInningsRecord,
  ParticipantInfo,
  CompetitorInfo,
  CricketExtrasType,
  CricketDismissalType,
} from '../../apps/web/src/lib/matches/cricket-scorecard';

/**
 * Realistic Match Simulation Engine
 * Emulates the authoritative PostgreSQL RPC behavior in-memory:
 * - Locks and updates innings snapshot (total_runs, total_wickets, legal_balls)
 * - Validates strict sequence numbers
 * - Enforces idempotency via client_event_id
 * - Executes soft undo (voided_at) with snapshot recalculation
 */
class SimulatedCricketEngine {
  public matchId: string;
  public matchStatus: string = 'LIVE';
  public innings: CricketInningsRecord[] = [];
  public deliveries: CricketDeliveryRecord[] = [];

  constructor(matchId: string) {
    this.matchId = matchId;
  }

  createInnings(
    inningsNumber: number,
    battingCompetitorId: string,
    bowlingCompetitorId: string,
    targetRuns?: number
  ): CricketInningsRecord {
    const inn: CricketInningsRecord = {
      id: `inn-${inningsNumber}-${uuidv4().substring(0, 8)}`,
      match_id: this.matchId,
      innings_number: inningsNumber,
      batting_competitor_id: battingCompetitorId,
      bowling_competitor_id: bowlingCompetitorId,
      total_runs: 0,
      total_wickets: 0,
      legal_balls: 0,
      target_runs: targetRuns || null,
      is_completed: false,
    };
    this.innings.push(inn);
    return inn;
  }

  recordDelivery(params: {
    inningsId: string;
    sequenceNumber: number;
    overNumber: number;
    ballNumber: number;
    strikerId: string;
    nonStrikerId: string;
    bowlerId: string;
    runsOffBat: number;
    extrasAmount: number;
    extrasType: CricketExtrasType;
    isLegalDelivery: boolean;
    isWicket: boolean;
    dismissalType?: CricketDismissalType | null;
    dismissedId?: string | null;
    fielderId?: string | null;
    clientEventId: string;
  }): { delivery: CricketDeliveryRecord; innings: CricketInningsRecord; isDuplicate: boolean } {
    // 1. Idempotency Check
    const existing = this.deliveries.find(
      (d) => d.match_id === this.matchId && d.client_event_id === params.clientEventId
    );
    if (existing) {
      if (existing.voided_at) {
        throw new Error('IDEMPOTENCY_CONFLICT: Event exists but is voided');
      }
      const inn = this.innings.find((i) => i.id === params.inningsId)!;
      return { delivery: existing, innings: inn, isDuplicate: true };
    }

    // 2. Innings Lock & State Check
    const inn = this.innings.find((i) => i.id === params.inningsId);
    if (!inn) throw new Error('NOT_FOUND: Innings not found');
    if (inn.is_completed) throw new Error('INNINGS_COMPLETED: Innings is completed');

    // 3. Strict Sequence Validation
    const activeInningsDeliveries = this.deliveries.filter(
      (d) => d.innings_id === params.inningsId && !d.voided_at
    );
    const expectedSeq = activeInningsDeliveries.length + 1;
    if (params.sequenceNumber !== expectedSeq) {
      throw new Error(`INVALID_SEQUENCE: Expected ${expectedSeq}, got ${params.sequenceNumber}`);
    }

    // 4. Create Delivery Record
    const delivery: CricketDeliveryRecord = {
      id: `del-${uuidv4().substring(0, 8)}`,
      match_id: this.matchId,
      innings_id: params.inningsId,
      sequence_number: params.sequenceNumber,
      over_number: params.overNumber,
      ball_number: params.ballNumber,
      striker_participant_id: params.strikerId,
      non_striker_participant_id: params.nonStrikerId,
      bowler_participant_id: params.bowlerId,
      runs_off_bat: params.runsOffBat,
      extras_amount: params.extrasAmount,
      extras_type: params.extrasType,
      is_legal_delivery: params.isLegalDelivery,
      is_wicket: params.isWicket,
      dismissal_type: params.dismissalType || null,
      dismissed_participant_id: params.dismissedId || null,
      fielder_participant_id: params.fielderId || null,
      client_event_id: params.clientEventId,
      voided_at: null,
      created_at: new Date().toISOString(),
    };
    this.deliveries.push(delivery);

    // 5. Update Innings Snapshot Atomically
    inn.total_runs += params.runsOffBat + params.extrasAmount;
    if (params.isWicket) inn.total_wickets += 1;
    if (params.isLegalDelivery) inn.legal_balls += 1;

    return { delivery, innings: inn, isDuplicate: false };
  }

  undoLatestDelivery(inningsId: string, deliveryId: string): CricketInningsRecord {
    const inn = this.innings.find((i) => i.id === inningsId);
    if (!inn) throw new Error('NOT_FOUND: Innings not found');

    const activeDeliveries = this.deliveries.filter(
      (d) => d.innings_id === inningsId && !d.voided_at
    );
    if (activeDeliveries.length === 0) {
      throw new Error('INVALID_UNDO: No active delivery to undo');
    }

    const latest = activeDeliveries[activeDeliveries.length - 1];
    if (latest.id !== deliveryId) {
      throw new Error('INVALID_UNDO: Can only undo the most recent active delivery');
    }

    // Soft undo: mark voided_at
    latest.voided_at = new Date().toISOString();

    // Recalculate snapshot from active event history
    const remainingActive = this.deliveries.filter(
      (d) => d.innings_id === inningsId && !d.voided_at
    );

    inn.total_runs = remainingActive.reduce((sum, d) => sum + d.runs_off_bat + d.extras_amount, 0);
    inn.total_wickets = remainingActive.filter((d) => d.is_wicket).length;
    inn.legal_balls = remainingActive.filter((d) => d.is_legal_delivery).length;

    return inn;
  }

  completeInnings(inningsId: string): void {
    const inn = this.innings.find((i) => i.id === inningsId);
    if (!inn) throw new Error('NOT_FOUND: Innings not found');
    if (inn.is_completed) throw new Error('ALREADY_COMPLETED: Innings already completed');
    inn.is_completed = true;
  }

  completeMatch(): void {
    if (this.matchStatus === 'COMPLETED') {
      throw new Error('INVALID_MATCH_STATE: Match is already finished');
    }
    this.matchStatus = 'COMPLETED';
  }
}

describe('STEP 16I — Cricket Real-World Match Simulation & Production Readiness Audit', () => {
  // Test Competitors
  const compAlpha: CompetitorInfo = { id: 'team-alpha', side: 'SIDE_A', name: 'Alpha Kings' };
  const compBeta: CompetitorInfo = { id: 'team-beta', side: 'SIDE_B', name: 'Beta Royals' };
  const competitors = [compAlpha, compBeta];

  // Alpha Roster (11 Players)
  const alphaPlayers: ParticipantInfo[] = Array.from({ length: 11 }, (_, i) => ({
    id: `alpha-p${i + 1}`,
    competitor_id: compAlpha.id,
    display_name: `Alpha Player ${i + 1}`,
    jersey_number: i + 1,
  }));

  // Beta Roster (11 Players)
  const betaPlayers: ParticipantInfo[] = Array.from({ length: 11 }, (_, i) => ({
    id: `beta-p${i + 1}`,
    competitor_id: compBeta.id,
    display_name: `Beta Player ${i + 1}`,
    jersey_number: i + 1,
  }));

  const allParticipants = [...alphaPlayers, ...betaPlayers];

  describe('PHASE 4 & 5 — 10-Over Innings Real-World Simulation', () => {
    it('simulates a complete realistic 10-over innings with diverse delivery types and bowler changes', () => {
      const engine = new SimulatedCricketEngine('match-sim-001');
      const inn1 = engine.createInnings(1, compAlpha.id, compBeta.id);

      // Openers
      let striker = alphaPlayers[0].id;
      let nonStriker = alphaPlayers[1].id;
      let nextBatterIdx = 2;

      // 3 Bowlers from Beta
      const bowlerList = [betaPlayers[8].id, betaPlayers[9].id, betaPlayers[10].id];

      let seq = 1;

      // 10 Overs simulation
      for (let over = 0; over < 10; over++) {
        const currentBowler = bowlerList[over % bowlerList.length];
        let legalBallInOver = 0;
        let deliveryInOver = 0;

        while (legalBallInOver < 6) {
          // Generate diverse deliveries based on over and delivery
          let runsOffBat = 0;
          let extrasAmount = 0;
          let extrasType: CricketExtrasType = 'NONE';
          let isLegal = true;
          let isWicket = false;
          let dismissalType: CricketDismissalType | null = null;
          let dismissedId: string | null = null;
          let fielderId: string | null = null;

          // Delivery variation schedule:
          if (over === 0 && deliveryInOver === 0) {
            // Over 0 Ball 1: Dot ball
            runsOffBat = 0;
          } else if (over === 0 && deliveryInOver === 1) {
            // Over 0 Ball 2: Wide delivery!
            extrasAmount = 1;
            extrasType = 'WIDE';
            isLegal = false;
          } else if (over === 0 && deliveryInOver === 2) {
            // Boundary 4
            runsOffBat = 4;
          } else if (over === 1 && deliveryInOver === 2) {
            // Wicket: Caught at boundary
            isWicket = true;
            dismissalType = 'CAUGHT';
            dismissedId = striker;
            fielderId = betaPlayers[4].id;
          } else if (over === 2 && deliveryInOver === 1) {
            // No-ball with 2 runs off bat
            runsOffBat = 2;
            extrasAmount = 1;
            extrasType = 'NO_BALL';
            isLegal = false;
          } else if (over === 3 && deliveryInOver === 3) {
            // Byes: 1 bye
            extrasAmount = 1;
            extrasType = 'BYE';
          } else if (over === 4 && deliveryInOver === 4) {
            // Six!
            runsOffBat = 6;
          } else if (over === 5 && deliveryInOver === 1) {
            // Wicket: Bowled
            isWicket = true;
            dismissalType = 'BOWLED';
            dismissedId = striker;
          } else if (over === 6 && deliveryInOver === 0) {
            // Leg Bye: 2 leg byes
            extrasAmount = 2;
            extrasType = 'LEG_BYE';
          } else if (over === 7 && deliveryInOver === 4) {
            // Wicket: LBW
            isWicket = true;
            dismissalType = 'LBW';
            dismissedId = striker;
          } else if (over === 8 && deliveryInOver === 2) {
            // 3 runs
            runsOffBat = 3;
          } else {
            // Normal rotation: 0, 1, or 2 runs
            runsOffBat = (deliveryInOver % 3 === 0) ? 0 : 1;
          }

          // Record delivery via engine
          const res = engine.recordDelivery({
            inningsId: inn1.id,
            sequenceNumber: seq,
            overNumber: over,
            ballNumber: legalBallInOver + 1,
            strikerId: striker,
            nonStrikerId: nonStriker,
            bowlerId: currentBowler,
            runsOffBat,
            extrasAmount,
            extrasType,
            isLegalDelivery: isLegal,
            isWicket,
            dismissalType,
            dismissedId,
            fielderId,
            clientEventId: `event-${seq}`,
          });

          expect(res.delivery.sequence_number).toBe(seq);
          seq++;

          if (isLegal) {
            legalBallInOver++;
          }
          deliveryInOver++;

          // Handle strike changes and wickets
          if (isWicket) {
            // Next batter comes in
            striker = alphaPlayers[nextBatterIdx].id;
            nextBatterIdx++;
          } else if (runsOffBat % 2 !== 0 || extrasType === 'BYE') {
            // Odd runs rotate strike
            const temp = striker;
            striker = nonStriker;
            nonStriker = temp;
          }
        }

        // Over end rotation
        const temp = striker;
        striker = nonStriker;
        nonStriker = temp;
      }

      // Check Innings 1 state
      expect(inn1.legal_balls).toBe(60); // Exactly 10 overs * 6 legal balls
      expect(inn1.total_wickets).toBe(3); // Exactly 3 wickets fell
      expect(inn1.total_runs).toBeGreaterThan(40); // Realistic total

      // Aggregate full scorecard
      const scorecard = buildInningsScorecard(inn1, engine.deliveries, allParticipants, competitors);

      // Verify batting
      expect(scorecard.batting.length).toBe(11);
      const battersOut = scorecard.batting.filter((b) => b.isOut);
      expect(battersOut.length).toBe(3);

      // Verify bowling
      expect(scorecard.bowling.length).toBe(3);
      const totalBowledLegal = scorecard.bowling.reduce((sum, b) => sum + b.legalDeliveries, 0);
      expect(totalBowledLegal).toBe(60);

      // Verify extras
      expect(scorecard.extras.wides).toBeGreaterThanOrEqual(1);
      expect(scorecard.extras.noBalls).toBeGreaterThanOrEqual(1);
      expect(scorecard.extras.byes).toBeGreaterThanOrEqual(1);
      expect(scorecard.extras.legByes).toBeGreaterThanOrEqual(2);

      // Verify fall of wickets
      expect(scorecard.fallOfWickets.length).toBe(3);
      expect(scorecard.fallOfWickets[0].wicketNumber).toBe(1);
      expect(scorecard.fallOfWickets[1].wicketNumber).toBe(2);
      expect(scorecard.fallOfWickets[2].wicketNumber).toBe(3);

      // Strict Reconciliation Verification
      expect(scorecard.reconciliation.isFullyReconciled).toBe(true);
      expect(scorecard.reconciliation.runsMatch).toBe(true);
      expect(scorecard.reconciliation.wicketsMatch).toBe(true);
      expect(scorecard.reconciliation.legalBallsMatch).toBe(true);
    });
  });

  describe('PHASE 6 — Idempotency Test', () => {
    it('rejects duplicate client_event_id submissions without double-counting', () => {
      const engine = new SimulatedCricketEngine('match-idemp-001');
      const inn = engine.createInnings(1, compAlpha.id, compBeta.id);

      const clientEventId = 'unique-event-xyz';

      // 1st submission
      const firstRes = engine.recordDelivery({
        inningsId: inn.id,
        sequenceNumber: 1,
        overNumber: 0,
        ballNumber: 1,
        strikerId: alphaPlayers[0].id,
        nonStrikerId: alphaPlayers[1].id,
        bowlerId: betaPlayers[9].id,
        runsOffBat: 4,
        extrasAmount: 0,
        extrasType: 'NONE',
        isLegalDelivery: true,
        isWicket: false,
        clientEventId,
      });

      expect(firstRes.isDuplicate).toBe(false);
      expect(inn.total_runs).toBe(4);
      expect(inn.legal_balls).toBe(1);

      // 2nd submission with exact same client_event_id
      const secondRes = engine.recordDelivery({
        inningsId: inn.id,
        sequenceNumber: 1,
        overNumber: 0,
        ballNumber: 1,
        strikerId: alphaPlayers[0].id,
        nonStrikerId: alphaPlayers[1].id,
        bowlerId: betaPlayers[9].id,
        runsOffBat: 4,
        extrasAmount: 0,
        extrasType: 'NONE',
        isLegalDelivery: true,
        isWicket: false,
        clientEventId,
      });

      expect(secondRes.isDuplicate).toBe(true);
      expect(secondRes.delivery.id).toBe(firstRes.delivery.id);

      // Assert total rows and runs did NOT double
      expect(engine.deliveries.length).toBe(1);
      expect(inn.total_runs).toBe(4);
      expect(inn.legal_balls).toBe(1);
    });
  });

  describe('PHASE 7 — Concurrency & Sequence Protection', () => {
    it('detects and rejects out-of-order sequence numbers preventing lost updates', () => {
      const engine = new SimulatedCricketEngine('match-seq-001');
      const inn = engine.createInnings(1, compAlpha.id, compBeta.id);

      // Ball 1 (seq 1)
      engine.recordDelivery({
        inningsId: inn.id,
        sequenceNumber: 1,
        overNumber: 0,
        ballNumber: 1,
        strikerId: alphaPlayers[0].id,
        nonStrikerId: alphaPlayers[1].id,
        bowlerId: betaPlayers[9].id,
        runsOffBat: 1,
        extrasAmount: 0,
        extrasType: 'NONE',
        isLegalDelivery: true,
        isWicket: false,
        clientEventId: 'event-seq-1',
      });

      // Concurrent request with stale sequence 1
      expect(() => {
        engine.recordDelivery({
          inningsId: inn.id,
          sequenceNumber: 1, // Stale! Expected 2
          overNumber: 0,
          ballNumber: 2,
          strikerId: alphaPlayers[1].id,
          nonStrikerId: alphaPlayers[0].id,
          bowlerId: betaPlayers[9].id,
          runsOffBat: 4,
          extrasAmount: 0,
          extrasType: 'NONE',
          isLegalDelivery: true,
          isWicket: false,
          clientEventId: 'event-seq-1-concurrent',
        });
      }).toThrowError(/INVALID_SEQUENCE/);

      // State remains uncorrupted
      expect(inn.total_runs).toBe(1);
      expect(inn.legal_balls).toBe(1);
    });
  });

  describe('PHASE 8 — Soft Undo Test', () => {
    it('soft-voids latest delivery and reverts snapshot, player statistics, and reconciliation', () => {
      const engine = new SimulatedCricketEngine('match-undo-001');
      const inn = engine.createInnings(1, compAlpha.id, compBeta.id);

      // Ball 1: 1 run
      engine.recordDelivery({
        inningsId: inn.id,
        sequenceNumber: 1,
        overNumber: 0,
        ballNumber: 1,
        strikerId: alphaPlayers[0].id,
        nonStrikerId: alphaPlayers[1].id,
        bowlerId: betaPlayers[9].id,
        runsOffBat: 1,
        extrasAmount: 0,
        extrasType: 'NONE',
        isLegalDelivery: true,
        isWicket: false,
        clientEventId: 'undo-event-1',
      });

      // Ball 2: Wicket!
      const ball2 = engine.recordDelivery({
        inningsId: inn.id,
        sequenceNumber: 2,
        overNumber: 0,
        ballNumber: 2,
        strikerId: alphaPlayers[1].id,
        nonStrikerId: alphaPlayers[0].id,
        bowlerId: betaPlayers[9].id,
        runsOffBat: 0,
        extrasAmount: 0,
        extrasType: 'NONE',
        isLegalDelivery: true,
        isWicket: true,
        dismissalType: 'BOWLED',
        dismissedId: alphaPlayers[1].id,
        clientEventId: 'undo-event-2',
      });

      expect(inn.total_wickets).toBe(1);
      expect(inn.legal_balls).toBe(2);

      // Execute Undo on Ball 2
      engine.undoLatestDelivery(inn.id, ball2.delivery.id);

      // Verify row was NOT deleted but soft-voided
      const undoneRow = engine.deliveries.find((d) => d.id === ball2.delivery.id);
      expect(undoneRow).toBeDefined();
      expect(undoneRow?.voided_at).not.toBeNull();

      // Snapshot reverted
      expect(inn.total_wickets).toBe(0);
      expect(inn.legal_balls).toBe(1);
      expect(inn.total_runs).toBe(1);

      // Scorecard excludes undone wicket
      const card = buildInningsScorecard(inn, engine.deliveries, allParticipants, competitors);
      expect(card.fallOfWickets.length).toBe(0);
      const batter2 = card.batting.find((b) => b.participantId === alphaPlayers[1].id);
      expect(batter2?.isOut).toBe(false);
      expect(card.reconciliation.isFullyReconciled).toBe(true);

      // Submitting new Ball 2 after undo
      const newBall2 = engine.recordDelivery({
        inningsId: inn.id,
        sequenceNumber: 2, // Re-uses sequence 2 safely
        overNumber: 0,
        ballNumber: 2,
        strikerId: alphaPlayers[1].id,
        nonStrikerId: alphaPlayers[0].id,
        bowlerId: betaPlayers[9].id,
        runsOffBat: 6,
        extrasAmount: 0,
        extrasType: 'NONE',
        isLegalDelivery: true,
        isWicket: false,
        clientEventId: 'undo-event-new-2',
      });

      expect(inn.total_runs).toBe(7);
      expect(inn.legal_balls).toBe(2);
      expect(newBall2.delivery.runs_off_bat).toBe(6);
    });
  });

  describe('PHASE 9 & 10 — Extras & Wickets Deep Verification', () => {
    it('verifies run out does NOT count towards bowler wickets', () => {
      const engine = new SimulatedCricketEngine('match-wickets-001');
      const inn = engine.createInnings(1, compAlpha.id, compBeta.id);

      // Delivery: Run Out
      engine.recordDelivery({
        inningsId: inn.id,
        sequenceNumber: 1,
        overNumber: 0,
        ballNumber: 1,
        strikerId: alphaPlayers[0].id,
        nonStrikerId: alphaPlayers[1].id,
        bowlerId: betaPlayers[9].id,
        runsOffBat: 1,
        extrasAmount: 0,
        extrasType: 'NONE',
        isLegalDelivery: true,
        isWicket: true,
        dismissalType: 'RUN_OUT',
        dismissedId: alphaPlayers[1].id,
        fielderId: betaPlayers[3].id,
        clientEventId: 'wicket-runout-1',
      });

      const card = buildInningsScorecard(inn, engine.deliveries, allParticipants, competitors);
      const bowler = card.bowling.find((b) => b.participantId === betaPlayers[9].id);
      expect(bowler?.wickets).toBe(0); // Bowler gets 0 wickets for run out!
      expect(inn.total_wickets).toBe(1); // But team wickets increments
    });

    it('verifies caught & bowled dismissal formatting and bowler credit', () => {
      const engine = new SimulatedCricketEngine('match-cb-001');
      const inn = engine.createInnings(1, compAlpha.id, compBeta.id);

      // Delivery: Caught and bowled by bowler betaPlayers[9]
      engine.recordDelivery({
        inningsId: inn.id,
        sequenceNumber: 1,
        overNumber: 0,
        ballNumber: 1,
        strikerId: alphaPlayers[0].id,
        nonStrikerId: alphaPlayers[1].id,
        bowlerId: betaPlayers[9].id,
        runsOffBat: 0,
        extrasAmount: 0,
        extrasType: 'NONE',
        isLegalDelivery: true,
        isWicket: true,
        dismissalType: 'CAUGHT',
        dismissedId: alphaPlayers[0].id,
        fielderId: betaPlayers[9].id, // Bowler is the fielder
        clientEventId: 'wicket-cb-1',
      });

      const card = buildInningsScorecard(inn, engine.deliveries, allParticipants, competitors);
      const batter = card.batting.find((b) => b.participantId === alphaPlayers[0].id);
      expect(batter?.dismissalText).toBe(`c & b ${betaPlayers[9].display_name}`);
      const bowler = card.bowling.find((b) => b.participantId === betaPlayers[9].id);
      expect(bowler?.wickets).toBe(1);
    });
  });

  describe('PHASE 12, 13 & 14 — Match Completion & Result Scenarios', () => {
    it('scenario A: Team Alpha wins by runs', () => {
      const engine = new SimulatedCricketEngine('match-res-runs');
      const inn1 = engine.createInnings(1, compAlpha.id, compBeta.id);
      const inn2 = engine.createInnings(2, compBeta.id, compAlpha.id, 101);

      // Innings 1: Alpha scores 100
      inn1.total_runs = 100;
      inn1.total_wickets = 6;
      inn1.legal_balls = 60;
      engine.completeInnings(inn1.id);

      // Innings 2: Beta scores 85
      inn2.total_runs = 85;
      inn2.total_wickets = 8;
      inn2.legal_balls = 60;
      engine.completeInnings(inn2.id);

      engine.completeMatch();

      const result = deriveCricketMatchResult('COMPLETED', engine.innings, competitors);
      expect(result).toBe('Alpha Kings won by 15 runs');
    });

    it('scenario B: Team Beta wins by wickets (successful chase)', () => {
      const engine = new SimulatedCricketEngine('match-res-wickets');
      const inn1 = engine.createInnings(1, compAlpha.id, compBeta.id);
      const inn2 = engine.createInnings(2, compBeta.id, compAlpha.id, 91);

      // Innings 1: Alpha scores 90
      inn1.total_runs = 90;
      inn1.total_wickets = 9;
      inn1.legal_balls = 60;
      engine.completeInnings(inn1.id);

      // Innings 2: Beta scores 94 with 3 wickets down
      inn2.total_runs = 94;
      inn2.total_wickets = 3;
      inn2.legal_balls = 50;
      engine.completeInnings(inn2.id);

      engine.completeMatch();

      const result = deriveCricketMatchResult('COMPLETED', engine.innings, competitors);
      expect(result).toBe('Beta Royals won by 7 wickets');
    });

    it('scenario C: Match Tied', () => {
      const engine = new SimulatedCricketEngine('match-res-tie');
      const inn1 = engine.createInnings(1, compAlpha.id, compBeta.id);
      const inn2 = engine.createInnings(2, compBeta.id, compAlpha.id, 121);

      inn1.total_runs = 120;
      inn1.total_wickets = 5;
      inn1.legal_balls = 60;
      engine.completeInnings(inn1.id);

      inn2.total_runs = 120;
      inn2.total_wickets = 9;
      inn2.legal_balls = 60;
      engine.completeInnings(inn2.id);

      engine.completeMatch();

      const result = deriveCricketMatchResult('COMPLETED', engine.innings, competitors);
      expect(result).toBe('Match Tied');
    });
  });

  describe('PHASE 22 — Data Corruption & Edge Case Audit', () => {
    it('handles zero-run innings with zero balls safely', () => {
      const emptyInnings: CricketInningsRecord = {
        id: 'inn-zero',
        match_id: 'm-zero',
        innings_number: 1,
        batting_competitor_id: compAlpha.id,
        bowling_competitor_id: compBeta.id,
        total_runs: 0,
        total_wickets: 0,
        legal_balls: 0,
      };

      const card = buildInningsScorecard(emptyInnings, [], allParticipants, competitors);
      expect(card.runRate).toBe('—');
      expect(card.oversFormatted).toBe('0.0');
      expect(card.reconciliation.isFullyReconciled).toBe(true);

      for (const b of card.batting) {
        expect(b.strikeRate).toBe('—');
        expect(b.hasBatted).toBe(false);
      }
      expect(card.bowling.length).toBe(0);
    });

    it('verifies wicket on the first ball of the match', () => {
      const engine = new SimulatedCricketEngine('match-w1-001');
      const inn = engine.createInnings(1, compAlpha.id, compBeta.id);

      // First ball wicket
      engine.recordDelivery({
        inningsId: inn.id,
        sequenceNumber: 1,
        overNumber: 0,
        ballNumber: 1,
        strikerId: alphaPlayers[0].id,
        nonStrikerId: alphaPlayers[1].id,
        bowlerId: betaPlayers[9].id,
        runsOffBat: 0,
        extrasAmount: 0,
        extrasType: 'NONE',
        isLegalDelivery: true,
        isWicket: true,
        dismissalType: 'BOWLED',
        dismissedId: alphaPlayers[0].id,
        clientEventId: 'ball-w1-1',
      });

      const card = buildInningsScorecard(inn, engine.deliveries, allParticipants, competitors);
      expect(card.innings.total_runs).toBe(0);
      expect(card.innings.total_wickets).toBe(1);
      expect(card.fallOfWickets.length).toBe(1);
      expect(card.fallOfWickets[0].score).toBe(0);
      expect(card.fallOfWickets[0].overs).toBe('0.1');
      expect(card.fallOfWickets[0].dismissedPlayerName).toBe(alphaPlayers[0].display_name);
    });
  });
});
