/**
 * Cricket Full Statistical Scorecard & Match Analytics
 *
 * Implements deterministic, authoritative statistical derivation from
 * `cricket_deliveries` and `cricket_innings` according to standard cricket rules.
 *
 * CRITICAL RULE:
 * A delivery where `voided_at IS NOT NULL` is an undone delivery and MUST NEVER
 * contribute to batting, bowling, extras, wickets, maidens, or fall of wickets statistics.
 */

export type CricketExtrasType = 'NONE' | 'WIDE' | 'NO_BALL' | 'BYE' | 'LEG_BYE' | 'PENALTY';

export type CricketDismissalType =
  | 'BOWLED'
  | 'CAUGHT'
  | 'LBW'
  | 'RUN_OUT'
  | 'STUMPED'
  | 'HIT_WICKET'
  | 'RETIRED_HURT';

export interface CricketDeliveryRecord {
  id: string;
  match_id: string;
  innings_id: string;
  sequence_number: number;
  over_number: number;
  ball_number: number;
  striker_participant_id: string;
  non_striker_participant_id: string;
  bowler_participant_id: string;
  runs_off_bat: number;
  extras_amount: number;
  extras_type: CricketExtrasType;
  is_legal_delivery: boolean;
  is_wicket: boolean;
  dismissal_type?: CricketDismissalType | null;
  dismissed_participant_id?: string | null;
  fielder_participant_id?: string | null;
  client_event_id?: string;
  voided_at?: string | null;
  created_at?: string;
}

export interface CricketInningsRecord {
  id: string;
  match_id: string;
  innings_number: number;
  batting_competitor_id: string;
  bowling_competitor_id: string;
  total_runs: number;
  total_wickets: number;
  legal_balls: number;
  target_runs?: number | null;
  is_declared?: boolean;
  is_completed?: boolean;
  created_at?: string;
  updated_at?: string;
}

export interface ParticipantInfo {
  id: string;
  competitor_id: string;
  display_name: string;
  role?: string;
  jersey_number?: number | null;
}

export interface CompetitorInfo {
  id: string;
  side: 'SIDE_A' | 'SIDE_B';
  name: string;
}

export interface BattingScorecardRow {
  participantId: string;
  playerName: string;
  runs: number;
  ballsFaced: number;
  fours: number;
  sixes: number;
  strikeRate: string; // e.g. "145.45" or "—" if 0 balls faced
  dismissalText: string; // e.g. "b Bowler", "c Fielder b Bowler", "not out", "did not bat"
  isOut: boolean;
  hasBatted: boolean;
  dismissalType?: CricketDismissalType | null;
}

export interface BowlingScorecardRow {
  participantId: string;
  playerName: string;
  legalDeliveries: number;
  overs: string; // e.g. "3.2"
  maidens: number;
  runsConceded: number;
  wickets: number;
  economy: string; // e.g. "6.50" or "—" if 0 legal balls
}

export interface ExtrasBreakdown {
  wides: number;
  noBalls: number;
  byes: number;
  legByes: number;
  penalty: number;
  total: number;
}

export interface FallOfWicket {
  wicketNumber: number;
  dismissedParticipantId: string;
  dismissedPlayerName: string;
  score: number;
  overs: string;
}

export interface InningsReconciliation {
  derivedRuns: number;
  snapshotRuns: number;
  runsMatch: boolean;
  derivedWickets: number;
  snapshotWickets: number;
  wicketsMatch: boolean;
  derivedLegalBalls: number;
  snapshotLegalBalls: number;
  legalBallsMatch: boolean;
  isFullyReconciled: boolean;
  discrepancyNote?: string;
}

export interface InningsScorecard {
  innings: CricketInningsRecord;
  battingCompetitorId: string;
  bowlingCompetitorId: string;
  battingTeamName: string;
  bowlingTeamName: string;
  batting: BattingScorecardRow[];
  bowling: BowlingScorecardRow[];
  extras: ExtrasBreakdown;
  fallOfWickets: FallOfWicket[];
  reconciliation: InningsReconciliation;
  runRate: string;
  oversFormatted: string;
}

export interface FullMatchScorecard {
  matchId: string;
  status: string;
  resultSummary: string | null;
  innings: InningsScorecard[];
}

/**
 * Formats balls into standard cricket overs notation (e.g. 19 legal balls => "3.1").
 */
export function formatCricketOvers(legalBalls: number): string {
  if (legalBalls <= 0) return '0.0';
  const fullOvers = Math.floor(legalBalls / 6);
  const remainder = legalBalls % 6;
  return `${fullOvers}.${remainder}`;
}

/**
 * Formats a strike rate string or "—" if 0 balls faced.
 */
export function calculateStrikeRate(runs: number, balls: number): string {
  if (balls <= 0) return '—';
  return ((runs / balls) * 100).toFixed(2);
}

/**
 * Formats bowling economy string or "—" if 0 legal deliveries.
 */
export function calculateEconomy(runsConceded: number, legalDeliveries: number): string {
  if (legalDeliveries <= 0) return '—';
  return ((runsConceded * 6) / legalDeliveries).toFixed(2);
}

/**
 * Generates human-readable dismissal description according to standard cricket conventions.
 */
export function formatDismissalText(
  dismissalType: CricketDismissalType | null | undefined,
  bowlerName: string,
  fielderName?: string | null
): string {
  if (!dismissalType) return 'not out';

  switch (dismissalType) {
    case 'BOWLED':
      return `b ${bowlerName}`;
    case 'CAUGHT':
      if (fielderName && fielderName.toLowerCase() === bowlerName.toLowerCase()) {
        return `c & b ${bowlerName}`;
      }
      return fielderName ? `c ${fielderName} b ${bowlerName}` : `c b ${bowlerName}`;
    case 'LBW':
      return `lbw b ${bowlerName}`;
    case 'STUMPED':
      return fielderName ? `st †${fielderName} b ${bowlerName}` : `st b ${bowlerName}`;
    case 'RUN_OUT':
      return fielderName ? `run out (${fielderName})` : 'run out';
    case 'HIT_WICKET':
      return `hit wicket b ${bowlerName}`;
    case 'RETIRED_HURT':
      return 'retired hurt';
    default:
      return 'out';
  }
}

/**
 * Filters out voided deliveries (soft undo support) and returns active deliveries
 * sorted sequentially.
 */
export function getActiveDeliveries(deliveries: CricketDeliveryRecord[]): CricketDeliveryRecord[] {
  return (deliveries || [])
    .filter((d) => !d.voided_at)
    .sort((a, b) => (a.sequence_number || 0) - (b.sequence_number || 0));
}

/**
 * Calculates extras breakdown strictly from active deliveries.
 */
export function calculateExtras(activeDeliveries: CricketDeliveryRecord[]): ExtrasBreakdown {
  const breakdown: ExtrasBreakdown = {
    wides: 0,
    noBalls: 0,
    byes: 0,
    legByes: 0,
    penalty: 0,
    total: 0,
  };

  for (const d of activeDeliveries) {
    if (d.extras_amount > 0) {
      switch (d.extras_type) {
        case 'WIDE':
          breakdown.wides += d.extras_amount;
          break;
        case 'NO_BALL':
          breakdown.noBalls += d.extras_amount;
          break;
        case 'BYE':
          breakdown.byes += d.extras_amount;
          break;
        case 'LEG_BYE':
          breakdown.legByes += d.extras_amount;
          break;
        case 'PENALTY':
          breakdown.penalty += d.extras_amount;
          break;
      }
    }
  }

  breakdown.total =
    breakdown.wides +
    breakdown.noBalls +
    breakdown.byes +
    breakdown.legByes +
    breakdown.penalty;

  return breakdown;
}

/**
 * Builds the Batting Scorecard from active deliveries.
 */
export function calculateBattingScorecard(
  activeDeliveries: CricketDeliveryRecord[],
  battingParticipants: ParticipantInfo[],
  participantMap: Map<string, ParticipantInfo>
): BattingScorecardRow[] {
  // Track appearance order: map participantId -> first sequence appearance
  const appearanceOrder = new Map<string, number>();

  // Track batting stats per participant
  const statsMap = new Map<
    string,
    {
      runs: number;
      ballsFaced: number;
      fours: number;
      sixes: number;
      isOut: boolean;
      dismissalDelivery?: CricketDeliveryRecord;
      hasBatted: boolean;
    }
  >();

  // Initialize for all known batting squad participants
  for (const p of battingParticipants) {
    statsMap.set(p.id, {
      runs: 0,
      ballsFaced: 0,
      fours: 0,
      sixes: 0,
      isOut: false,
      hasBatted: false,
    });
  }

  // Iterate over active deliveries
  for (const d of activeDeliveries) {
    // Record appearance for striker
    if (!appearanceOrder.has(d.striker_participant_id)) {
      appearanceOrder.set(d.striker_participant_id, d.sequence_number);
    }
    // Record appearance for non-striker
    if (!appearanceOrder.has(d.non_striker_participant_id)) {
      appearanceOrder.set(d.non_striker_participant_id, d.sequence_number);
    }

    // Ensure striker exists in statsMap
    let strikerStats = statsMap.get(d.striker_participant_id);
    if (!strikerStats) {
      strikerStats = {
        runs: 0,
        ballsFaced: 0,
        fours: 0,
        sixes: 0,
        isOut: false,
        hasBatted: true,
      };
      statsMap.set(d.striker_participant_id, strikerStats);
    }
    strikerStats.hasBatted = true;

    // Ensure non-striker exists in statsMap
    let nonStrikerStats = statsMap.get(d.non_striker_participant_id);
    if (!nonStrikerStats) {
      nonStrikerStats = {
        runs: 0,
        ballsFaced: 0,
        fours: 0,
        sixes: 0,
        isOut: false,
        hasBatted: true,
      };
      statsMap.set(d.non_striker_participant_id, nonStrikerStats);
    }
    nonStrikerStats.hasBatted = true;

    // Striker runs: runs_off_bat
    strikerStats.runs += d.runs_off_bat || 0;

    // Striker balls faced:
    // Wides do NOT count as balls faced.
    // Legal deliveries and No-balls (and byes/leg-byes) DO count as balls faced.
    if (d.extras_type !== 'WIDE') {
      strikerStats.ballsFaced += 1;
    }

    // 4s and 6s
    if (d.runs_off_bat === 4) {
      strikerStats.fours += 1;
    } else if (d.runs_off_bat === 6) {
      strikerStats.sixes += 1;
    }

    // Wicket check
    if (d.is_wicket && d.dismissed_participant_id) {
      const dismissedStats = statsMap.get(d.dismissed_participant_id);
      if (dismissedStats) {
        dismissedStats.isOut = true;
        dismissedStats.dismissalDelivery = d;
      }
    }
  }

  // Convert to array and format
  const rows: BattingScorecardRow[] = [];

  for (const [pId, stats] of statsMap.entries()) {
    const participant = participantMap.get(pId);
    const playerName = participant?.display_name || `Player ${pId.substring(0, 6)}`;

    let dismissalText = 'did not bat';
    if (stats.hasBatted) {
      if (stats.isOut && stats.dismissalDelivery) {
        const d = stats.dismissalDelivery;
        const bowler = participantMap.get(d.bowler_participant_id);
        const bowlerName = bowler?.display_name || 'Bowler';
        const fielder = d.fielder_participant_id
          ? participantMap.get(d.fielder_participant_id)
          : null;
        const fielderName = fielder?.display_name;

        dismissalText = formatDismissalText(d.dismissal_type, bowlerName, fielderName);
      } else {
        dismissalText = 'not out';
      }
    }

    rows.push({
      participantId: pId,
      playerName,
      runs: stats.runs,
      ballsFaced: stats.ballsFaced,
      fours: stats.fours,
      sixes: stats.sixes,
      strikeRate: calculateStrikeRate(stats.runs, stats.ballsFaced),
      dismissalText,
      isOut: stats.isOut,
      hasBatted: stats.hasBatted,
      dismissalType: stats.dismissalDelivery?.dismissal_type || null,
    });
  }

  // Sort rows: players who batted ordered by appearance order, followed by did not bat
  rows.sort((a, b) => {
    if (a.hasBatted && !b.hasBatted) return -1;
    if (!a.hasBatted && b.hasBatted) return 1;
    if (a.hasBatted && b.hasBatted) {
      const orderA = appearanceOrder.get(a.participantId) ?? 999999;
      const orderB = appearanceOrder.get(b.participantId) ?? 999999;
      return orderA - orderB;
    }
    return a.playerName.localeCompare(b.playerName);
  });

  return rows;
}

/**
 * Builds the Bowling Scorecard from active deliveries.
 */
export function calculateBowlingScorecard(
  activeDeliveries: CricketDeliveryRecord[],
  participantMap: Map<string, ParticipantInfo>
): BowlingScorecardRow[] {
  // Track bowler appearance order (first ball sequence)
  const bowlerAppearance = new Map<string, number>();

  // Bowler stats
  const statsMap = new Map<
    string,
    {
      legalDeliveries: number;
      runsConceded: number;
      wickets: number;
      // Map over_number -> { legalDeliveries: number, runsConceded: number }
      oversMap: Map<number, { legalDeliveries: number; runsConceded: number }>;
    }
  >();

  for (const d of activeDeliveries) {
    const bowlerId = d.bowler_participant_id;
    if (!bowlerAppearance.has(bowlerId)) {
      bowlerAppearance.set(bowlerId, d.sequence_number);
    }

    let bStats = statsMap.get(bowlerId);
    if (!bStats) {
      bStats = {
        legalDeliveries: 0,
        runsConceded: 0,
        wickets: 0,
        oversMap: new Map(),
      };
      statsMap.set(bowlerId, bStats);
    }

    // Legal delivery
    if (d.is_legal_delivery) {
      bStats.legalDeliveries += 1;
    }

    // Runs conceded:
    // Runs off bat + Wides + No-balls
    // Byes, leg-byes, and penalties are NOT charged to bowler
    const bowlerCharge =
      (d.runs_off_bat || 0) +
      (['WIDE', 'NO_BALL'].includes(d.extras_type) ? d.extras_amount || 0 : 0);

    bStats.runsConceded += bowlerCharge;

    // Wickets:
    // Standard cricket rules: RUN_OUT and RETIRED_HURT are NOT credited to bowler.
    // BOWLED, CAUGHT, LBW, STUMPED, HIT_WICKET are credited.
    if (
      d.is_wicket &&
      d.dismissal_type &&
      !['RUN_OUT', 'RETIRED_HURT'].includes(d.dismissal_type)
    ) {
      bStats.wickets += 1;
    }

    // Over breakdown for maiden calculation
    let overRecord = bStats.oversMap.get(d.over_number);
    if (!overRecord) {
      overRecord = { legalDeliveries: 0, runsConceded: 0 };
      bStats.oversMap.set(d.over_number, overRecord);
    }
    if (d.is_legal_delivery) {
      overRecord.legalDeliveries += 1;
    }
    overRecord.runsConceded += bowlerCharge;
  }

  const rows: BowlingScorecardRow[] = [];

  for (const [bId, bStats] of statsMap.entries()) {
    const participant = participantMap.get(bId);
    const playerName = participant?.display_name || `Bowler ${bId.substring(0, 6)}`;

    // Calculate maidens:
    // A complete over (6 legal balls) where bowler conceded 0 runs
    let maidens = 0;
    for (const overRec of bStats.oversMap.values()) {
      if (overRec.legalDeliveries === 6 && overRec.runsConceded === 0) {
        maidens += 1;
      }
    }

    rows.push({
      participantId: bId,
      playerName,
      legalDeliveries: bStats.legalDeliveries,
      overs: formatCricketOvers(bStats.legalDeliveries),
      maidens,
      runsConceded: bStats.runsConceded,
      wickets: bStats.wickets,
      economy: calculateEconomy(bStats.runsConceded, bStats.legalDeliveries),
    });
  }

  // Sort by first over bowled
  rows.sort((a, b) => {
    const orderA = bowlerAppearance.get(a.participantId) ?? 0;
    const orderB = bowlerAppearance.get(b.participantId) ?? 0;
    return orderA - orderB;
  });

  return rows;
}

/**
 * Calculates Fall of Wickets sequentially from active deliveries.
 */
export function calculateFallOfWickets(
  activeDeliveries: CricketDeliveryRecord[],
  participantMap: Map<string, ParticipantInfo>
): FallOfWicket[] {
  const fow: FallOfWicket[] = [];
  let cumulativeScore = 0;
  let cumulativeLegalBalls = 0;
  let wicketCount = 0;

  for (const d of activeDeliveries) {
    cumulativeScore += (d.runs_off_bat || 0) + (d.extras_amount || 0);
    if (d.is_legal_delivery) {
      cumulativeLegalBalls += 1;
    }

    if (d.is_wicket && d.dismissed_participant_id) {
      wicketCount += 1;
      const dismissed = participantMap.get(d.dismissed_participant_id);
      const dismissedPlayerName = dismissed?.display_name || 'Batter';

      fow.push({
        wicketNumber: wicketCount,
        dismissedParticipantId: d.dismissed_participant_id,
        dismissedPlayerName,
        score: cumulativeScore,
        overs: formatCricketOvers(cumulativeLegalBalls),
      });
    }
  }

  return fow;
}

/**
 * Reconciles derived delivery calculations against authoritative `cricket_innings` snapshot.
 */
export function reconcileInnings(
  snapshot: CricketInningsRecord,
  battingRows: BattingScorecardRow[],
  extras: ExtrasBreakdown,
  activeDeliveries: CricketDeliveryRecord[]
): InningsReconciliation {
  const batterRuns = battingRows.reduce((sum, r) => sum + r.runs, 0);
  const derivedRuns = batterRuns + extras.total;
  const snapshotRuns = snapshot.total_runs || 0;
  const runsMatch = derivedRuns === snapshotRuns;

  const derivedWickets = activeDeliveries.filter((d) => d.is_wicket).length;
  const snapshotWickets = snapshot.total_wickets || 0;
  const wicketsMatch = derivedWickets === snapshotWickets;

  const derivedLegalBalls = activeDeliveries.filter((d) => d.is_legal_delivery).length;
  const snapshotLegalBalls = snapshot.legal_balls || 0;
  const legalBallsMatch = derivedLegalBalls === snapshotLegalBalls;

  const isFullyReconciled = runsMatch && wicketsMatch && legalBallsMatch;

  let discrepancyNote: string | undefined;
  if (!isFullyReconciled) {
    const notes: string[] = [];
    if (!runsMatch) {
      notes.push(`Runs: derived ${derivedRuns} vs snapshot ${snapshotRuns}`);
    }
    if (!wicketsMatch) {
      notes.push(`Wickets: derived ${derivedWickets} vs snapshot ${snapshotWickets}`);
    }
    if (!legalBallsMatch) {
      notes.push(`Legal balls: derived ${derivedLegalBalls} vs snapshot ${snapshotLegalBalls}`);
    }
    discrepancyNote = notes.join('; ');
  }

  return {
    derivedRuns,
    snapshotRuns,
    runsMatch,
    derivedWickets,
    snapshotWickets,
    wicketsMatch,
    derivedLegalBalls,
    snapshotLegalBalls,
    legalBallsMatch,
    isFullyReconciled,
    discrepancyNote,
  };
}

/**
 * Aggregates a single innings scorecard.
 */
export function buildInningsScorecard(
  innings: CricketInningsRecord,
  allDeliveries: CricketDeliveryRecord[],
  participants: ParticipantInfo[],
  competitors: CompetitorInfo[]
): InningsScorecard {
  const activeDeliveries = getActiveDeliveries(
    allDeliveries.filter((d) => d.innings_id === innings.id)
  );

  const participantMap = new Map<string, ParticipantInfo>(participants.map((p) => [p.id, p]));

  const battingParticipants = participants.filter(
    (p) => p.competitor_id === innings.batting_competitor_id
  );

  const battingTeam = competitors.find((c) => c.id === innings.batting_competitor_id);
  const bowlingTeam = competitors.find((c) => c.id === innings.bowling_competitor_id);

  const battingTeamName = battingTeam?.name || 'Batting Team';
  const bowlingTeamName = bowlingTeam?.name || 'Bowling Team';

  const batting = calculateBattingScorecard(activeDeliveries, battingParticipants, participantMap);
  const bowling = calculateBowlingScorecard(activeDeliveries, participantMap);
  const extras = calculateExtras(activeDeliveries);
  const fallOfWickets = calculateFallOfWickets(activeDeliveries, participantMap);
  const reconciliation = reconcileInnings(innings, batting, extras, activeDeliveries);

  const oversFormatted = formatCricketOvers(innings.legal_balls || 0);
  const runRate =
    innings.legal_balls && innings.legal_balls > 0
      ? (((innings.total_runs || 0) * 6) / innings.legal_balls).toFixed(2)
      : '—';

  return {
    innings,
    battingCompetitorId: innings.batting_competitor_id,
    bowlingCompetitorId: innings.bowling_competitor_id,
    battingTeamName,
    bowlingTeamName,
    batting,
    bowling,
    extras,
    fallOfWickets,
    reconciliation,
    runRate,
    oversFormatted,
  };
}

/**
 * Derives authoritative match result from innings and competitors according to standard limited overs rules.
 */
export function deriveCricketMatchResult(
  matchStatus: string,
  inningsList: CricketInningsRecord[],
  competitors: CompetitorInfo[],
  resultSummaryFallback?: string | null
): string | null {
  if (matchStatus !== 'COMPLETED') {
    return null;
  }

  // If already set in matches table, use as fallback
  if (resultSummaryFallback && resultSummaryFallback.trim().length > 0) {
    return resultSummaryFallback;
  }

  if (!inningsList || inningsList.length === 0) {
    return 'Match completed';
  }

  // Sort innings by innings_number ascending
  const sortedInnings = [...inningsList].sort(
    (a, b) => (a.innings_number || 0) - (b.innings_number || 0)
  );

  if (sortedInnings.length >= 2) {
    const inn1 = sortedInnings[0];
    const inn2 = sortedInnings[1];

    const team1 = competitors.find((c) => c.id === inn1.batting_competitor_id);
    const team2 = competitors.find((c) => c.id === inn2.batting_competitor_id);

    const team1Name = team1?.name || 'Team 1';
    const team2Name = team2?.name || 'Team 2';

    if (inn2.total_runs > inn1.total_runs) {
      const wicketsRemaining = 10 - inn2.total_wickets;
      return `${team2Name} won by ${wicketsRemaining} wicket${wicketsRemaining === 1 ? '' : 's'}`;
    } else if (inn1.total_runs > inn2.total_runs) {
      const margin = inn1.total_runs - inn2.total_runs;
      return `${team1Name} won by ${margin} run${margin === 1 ? '' : 's'}`;
    } else {
      return 'Match Tied';
    }
  }

  if (sortedInnings.length === 1) {
    const inn1 = sortedInnings[0];
    const team1 = competitors.find((c) => c.id === inn1.batting_competitor_id);
    return `${team1?.name || 'Batting Team'} scored ${inn1.total_runs}/${inn1.total_wickets} (${formatCricketOvers(inn1.legal_balls)} ov)`;
  }

  return 'Match completed';
}

/**
 * Builds the complete Match Scorecard for all innings in a match.
 */
export function buildFullMatchScorecard(
  matchId: string,
  matchStatus: string,
  resultSummary: string | null,
  inningsList: CricketInningsRecord[],
  allDeliveries: CricketDeliveryRecord[],
  participants: ParticipantInfo[],
  competitors: CompetitorInfo[]
): FullMatchScorecard {
  const sortedInnings = [...inningsList].sort(
    (a, b) => (a.innings_number || 0) - (b.innings_number || 0)
  );

  const calculatedResult = deriveCricketMatchResult(
    matchStatus,
    sortedInnings,
    competitors,
    resultSummary
  );

  const inningsScorecards = sortedInnings.map((inn) =>
    buildInningsScorecard(inn, allDeliveries, participants, competitors)
  );

  return {
    matchId,
    status: matchStatus,
    resultSummary: calculatedResult,
    innings: inningsScorecards,
  };
}
