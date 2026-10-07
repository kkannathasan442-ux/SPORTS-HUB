'use client';

import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { createSupabaseBrowserClient } from '@/lib/supabase/browser';
import { Card } from '@/components/ui/Card';
import {
  Loader2,
  Activity,
  Trophy,
  CheckCircle2,
  AlertCircle,
  MapPin,
  Calendar,
  Layers,
} from 'lucide-react';
import {
  buildFullMatchScorecard,
  formatCricketOvers,
  type FullMatchScorecard,
  type InningsScorecard,
  type CricketDeliveryRecord,
  type CricketInningsRecord,
  type ParticipantInfo,
  type CompetitorInfo,
} from '@/lib/matches/cricket-scorecard';

export function LiveMatchCentre({ match: initialMatch }: { match: any }) {
  const supabase = createSupabaseBrowserClient();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [match, setMatch] = useState<any>(initialMatch);
  const [inningsList, setInningsList] = useState<CricketInningsRecord[]>([]);
  const [deliveries, setDeliveries] = useState<CricketDeliveryRecord[]>([]);
  const [selectedInningsIndex, setSelectedInningsIndex] = useState<number>(0);

  const teamA = match.competitors?.find((c: any) => c.side === 'SIDE_A');
  const teamB = match.competitors?.find((c: any) => c.side === 'SIDE_B');

  const competitors: CompetitorInfo[] = useMemo(() => {
    const list: CompetitorInfo[] = [];
    if (teamA) {
      list.push({
        id: teamA.id,
        side: 'SIDE_A',
        name: teamA.competitor_name || teamA.team?.name || 'Team A',
      });
    }
    if (teamB) {
      list.push({
        id: teamB.id,
        side: 'SIDE_B',
        name: teamB.competitor_name || teamB.team?.name || 'Team B',
      });
    }
    return list;
  }, [teamA, teamB]);

  const allParticipants: ParticipantInfo[] = useMemo(() => {
    const partsA = (teamA?.participants || []).map((p: any) => ({
      id: p.id,
      competitor_id: p.competitor_id || teamA.id,
      display_name: p.display_name || p.profile?.full_name || 'Player',
      role: p.role,
      jersey_number: p.jersey_number,
    }));
    const partsB = (teamB?.participants || []).map((p: any) => ({
      id: p.id,
      competitor_id: p.competitor_id || teamB.id,
      display_name: p.display_name || p.profile?.full_name || 'Player',
      role: p.role,
      jersey_number: p.jersey_number,
    }));
    return [...partsA, ...partsB];
  }, [teamA, teamB]);

  const participantMap = useMemo(() => {
    return new Map<string, ParticipantInfo>(allParticipants.map((p) => [p.id, p]));
  }, [allParticipants]);

  const getParticipantName = useCallback(
    (id: string) => {
      return participantMap.get(id)?.display_name || 'Unknown Player';
    },
    [participantMap]
  );

  const loadAuthoritativeState = useCallback(async () => {
    try {
      setError(null);

      // 1. Fetch latest match state
      const { data: updatedMatch, error: matchError } = await supabase
        .from('matches')
        .select('id, status, winner_side, result_summary, scheduled_start, actual_start, actual_end')
        .eq('id', match.id)
        .single();

      if (matchError && matchError.code !== 'PGRST116') {
        throw new Error(matchError.message);
      }
      if (updatedMatch) {
        setMatch((prev: any) => ({
          ...prev,
          status: updatedMatch.status,
          winner_side: updatedMatch.winner_side,
          result_summary: updatedMatch.result_summary,
        }));
      }

      // 2. Fetch all innings ordered sequentially
      const { data: allInningsData, error: inningsError } = await supabase
        .from('cricket_innings')
        .select('*')
        .eq('match_id', match.id)
        .order('innings_number', { ascending: true });

      if (inningsError && inningsError.code !== 'PGRST116') {
        throw new Error(inningsError.message);
      }

      const inningsRecords: CricketInningsRecord[] = allInningsData || [];
      setInningsList(inningsRecords);

      // Default active innings view to the latest innings
      if (inningsRecords.length > 0) {
        setSelectedInningsIndex(inningsRecords.length - 1);
      }

      // 3. Fetch all active deliveries for all innings
      const { data: delData, error: delError } = await supabase
        .from('cricket_deliveries')
        .select('*')
        .eq('match_id', match.id)
        .is('voided_at', null)
        .order('sequence_number', { ascending: true });

      if (delError) {
        throw new Error(delError.message);
      }

      setDeliveries(delData || []);
    } catch (err: any) {
      setError(err.message || 'Failed to load match state.');
    } finally {
      setLoading(false);
    }
  }, [supabase, match.id]);

  useEffect(() => {
    loadAuthoritativeState();

    // Authoritative Realtime Subscriptions
    const channel = supabase
      .channel(`public:match_${match.id}`)
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'matches', filter: `id=eq.${match.id}` },
        () => loadAuthoritativeState()
      )
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'cricket_innings', filter: `match_id=eq.${match.id}` },
        () => loadAuthoritativeState()
      )
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'cricket_deliveries', filter: `match_id=eq.${match.id}` },
        () => loadAuthoritativeState()
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [match.id, supabase, loadAuthoritativeState]);

  // Aggregate authoritative scorecard
  const fullScorecard: FullMatchScorecard = useMemo(() => {
    return buildFullMatchScorecard(
      match.id,
      match.status,
      match.result_summary,
      inningsList,
      deliveries,
      allParticipants,
      competitors
    );
  }, [match.id, match.status, match.result_summary, inningsList, deliveries, allParticipants, competitors]);

  const currentInningsScorecard: InningsScorecard | undefined =
    fullScorecard.innings[selectedInningsIndex] || fullScorecard.innings[0];

  const recentDeliveries = useMemo(() => {
    if (!currentInningsScorecard) return [];
    return deliveries
      .filter((d) => d.innings_id === currentInningsScorecard.innings.id)
      .slice(-12);
  }, [deliveries, currentInningsScorecard]);

  // Current live batters and bowler from latest delivery of active innings
  const latestDelivery = recentDeliveries[recentDeliveries.length - 1];

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center p-16 gap-3">
        <Loader2 className="w-10 h-10 animate-spin text-slate-400" />
        <p className="text-sm font-semibold text-slate-500">Loading live scorecard...</p>
      </div>
    );
  }

  const isCompleted = match.status === 'COMPLETED';
  const isLive = match.status === 'LIVE';

  return (
    <div className="max-w-4xl mx-auto flex flex-col gap-6">
      {/* Header Bar */}
      <div className="flex flex-col sm:flex-row justify-between sm:items-center bg-white p-4 sm:p-5 rounded-2xl border border-slate-200 shadow-sm gap-3">
        <div>
          <div className="flex items-center gap-2 text-xs font-bold text-slate-500 uppercase tracking-widest mb-1">
            {match.sport?.name || 'Cricket'}
            {match.venue?.name && (
              <>
                <span>•</span>
                <span className="flex items-center gap-1 font-medium">
                  <MapPin className="w-3.5 h-3.5 text-slate-400" />
                  {match.venue.name}
                </span>
              </>
            )}
          </div>
          <h1 className="text-xl sm:text-2xl font-black text-slate-900 tracking-tight">
            {isCompleted ? 'Match Scorecard & Results' : 'Live Cricket Match Centre'}
          </h1>
        </div>

        <div className="flex items-center gap-2 self-start sm:self-auto">
          {isLive && (
            <div className="flex items-center gap-2 px-3.5 py-1.5 bg-rose-50 text-rose-600 font-black rounded-full text-xs uppercase tracking-wider border border-rose-200">
              <Activity className="w-4 h-4 animate-pulse" />
              Live
            </div>
          )}
          {isCompleted && (
            <div className="flex items-center gap-2 px-3.5 py-1.5 bg-emerald-50 text-emerald-700 font-black rounded-full text-xs uppercase tracking-wider border border-emerald-200">
              <CheckCircle2 className="w-4 h-4" />
              Completed
            </div>
          )}
          {!isLive && !isCompleted && (
            <div className="px-3 py-1 bg-slate-100 text-slate-700 font-bold rounded-full text-xs uppercase tracking-wider">
              {match.status}
            </div>
          )}
        </div>
      </div>

      {error && (
        <div className="bg-rose-50 text-rose-800 p-4 rounded-xl flex items-center gap-3 border border-rose-200">
          <AlertCircle className="w-5 h-5 shrink-0" />
          <p className="text-sm font-medium">{error}</p>
        </div>
      )}

      {/* Main Score Hero Card */}
      <Card className="p-6 sm:p-8 bg-slate-950 text-white shadow-2xl relative overflow-hidden rounded-2xl border border-slate-800">
        <div className="absolute top-0 inset-x-0 h-1.5 bg-gradient-to-r from-emerald-500 via-indigo-500 to-sky-400" />

        <div className="flex flex-col md:flex-row items-center justify-between gap-6">
          {/* Team A */}
          <div className="text-center md:text-left flex-1">
            <h2 className="text-lg sm:text-xl font-bold tracking-tight text-slate-100">
              {teamA?.competitor_name || teamA?.team?.name || 'Team A'}
            </h2>
            {fullScorecard.innings.length > 0 && (
              <div className="text-slate-400 text-sm font-semibold mt-1">
                {(() => {
                  const innA = fullScorecard.innings.find(
                    (i) => i.battingCompetitorId === teamA?.id
                  );
                  return innA
                    ? `${innA.innings.total_runs}/${innA.innings.total_wickets} (${innA.oversFormatted} ov)`
                    : 'Yet to bat';
                })()}
              </div>
            )}
          </div>

          {/* Center VS & Result */}
          <div className="text-center shrink-0">
            <div className="text-xs font-black tracking-widest text-slate-500 uppercase px-3 py-1 rounded-full bg-slate-900 border border-slate-800">
              VS
            </div>
            {fullScorecard.resultSummary && (
              <div className="mt-3 inline-flex items-center gap-2 bg-gradient-to-r from-emerald-500/20 to-sky-500/20 text-emerald-300 border border-emerald-500/30 px-4 py-1.5 rounded-full text-xs sm:text-sm font-bold tracking-wide">
                <Trophy className="w-4 h-4 text-amber-400" />
                {fullScorecard.resultSummary}
              </div>
            )}
          </div>

          {/* Team B */}
          <div className="text-center md:text-right flex-1">
            <h2 className="text-lg sm:text-xl font-bold tracking-tight text-slate-100">
              {teamB?.competitor_name || teamB?.team?.name || 'Team B'}
            </h2>
            {fullScorecard.innings.length > 0 && (
              <div className="text-slate-400 text-sm font-semibold mt-1">
                {(() => {
                  const innB = fullScorecard.innings.find(
                    (i) => i.battingCompetitorId === teamB?.id
                  );
                  return innB
                    ? `${innB.innings.total_runs}/${innB.innings.total_wickets} (${innB.oversFormatted} ov)`
                    : 'Yet to bat';
                })()}
              </div>
            )}
          </div>
        </div>

        {/* Current Active Innings Big Score */}
        {currentInningsScorecard && (
          <div className="mt-8 pt-6 border-t border-slate-800/80 flex flex-col items-center">
            <div className="text-xs font-bold text-slate-400 uppercase tracking-widest mb-1">
              {currentInningsScorecard.battingTeamName} • Innings {currentInningsScorecard.innings.innings_number}
            </div>
            <div className="text-5xl sm:text-7xl font-black tracking-tight text-white my-2">
              {currentInningsScorecard.innings.total_runs}
              <span className="text-slate-500 font-light mx-2">/</span>
              {currentInningsScorecard.innings.total_wickets}
            </div>
            <div className="flex items-center gap-4 text-sm font-bold text-slate-300">
              <span>{currentInningsScorecard.oversFormatted} OVERS</span>
              <span>•</span>
              <span>CRR: {currentInningsScorecard.runRate}</span>
              {currentInningsScorecard.innings.target_runs && (
                <>
                  <span>•</span>
                  <span className="text-amber-400">
                    TARGET: {currentInningsScorecard.innings.target_runs}
                  </span>
                </>
              )}
            </div>
          </div>
        )}
      </Card>

      {/* Live Ball-by-ball & At-Crease Section (Visible when match is in progress) */}
      {!isCompleted && currentInningsScorecard && recentDeliveries.length > 0 && (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {/* Recent Deliveries */}
          <Card className="p-5 md:col-span-3 bg-white">
            <h3 className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-3">
              Recent Deliveries
            </h3>
            <div className="flex flex-wrap items-center gap-2">
              {recentDeliveries.map((d) => (
                <div
                  key={d.id}
                  className={`w-10 h-10 rounded-full flex items-center justify-center font-black text-xs shadow-sm border transition-transform ${
                    d.is_wicket
                      ? 'bg-rose-100 text-rose-700 border-rose-300 scale-105'
                      : d.extras_type !== 'NONE'
                      ? 'bg-amber-50 text-amber-800 border-amber-300'
                      : d.runs_off_bat === 4 || d.runs_off_bat === 6
                      ? 'bg-indigo-50 text-indigo-700 border-indigo-300'
                      : 'bg-slate-50 text-slate-800 border-slate-200'
                  }`}
                  title={`Over ${d.over_number}.${d.ball_number} - Striker: ${getParticipantName(d.striker_participant_id)}`}
                >
                  {d.is_wicket
                    ? 'W'
                    : d.extras_type !== 'NONE'
                    ? `${d.extras_amount}${
                        d.extras_type === 'WIDE'
                          ? 'wd'
                          : d.extras_type === 'NO_BALL'
                          ? 'nb'
                          : d.extras_type === 'LEG_BYE'
                          ? 'lb'
                          : 'b'
                      }`
                    : d.runs_off_bat}
                </div>
              ))}
            </div>
          </Card>

          {/* Current Batters */}
          {latestDelivery && (
            <>
              <Card className="p-5 md:col-span-2 bg-white">
                <h3 className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-3">
                  Batters at Crease
                </h3>
                <div className="space-y-3">
                  {(() => {
                    const strikerStats = currentInningsScorecard.batting.find(
                      (b) => b.participantId === latestDelivery.striker_participant_id
                    );
                    const nonStrikerStats = currentInningsScorecard.batting.find(
                      (b) => b.participantId === latestDelivery.non_striker_participant_id
                    );
                    return (
                      <>
                        <div className="flex items-center justify-between p-2.5 bg-slate-50 rounded-xl border border-slate-100">
                          <div className="flex items-center gap-2">
                            <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
                            <span className="font-bold text-slate-900 text-sm">
                              {getParticipantName(latestDelivery.striker_participant_id)}{' '}
                              <span className="text-xs text-slate-500 font-medium">(Striker)</span>
                            </span>
                          </div>
                          <div className="font-mono font-bold text-slate-800 text-sm">
                            {strikerStats?.runs ?? 0}{' '}
                            <span className="text-slate-400 font-normal text-xs">
                              ({strikerStats?.ballsFaced ?? 0}b)
                            </span>
                          </div>
                        </div>

                        <div className="flex items-center justify-between p-2.5 bg-slate-50 rounded-xl border border-slate-100">
                          <div className="flex items-center gap-2">
                            <span className="w-2 h-2 rounded-full bg-slate-300" />
                            <span className="font-bold text-slate-700 text-sm">
                              {getParticipantName(latestDelivery.non_striker_participant_id)}{' '}
                              <span className="text-xs text-slate-500 font-medium">(Non-Striker)</span>
                            </span>
                          </div>
                          <div className="font-mono font-bold text-slate-800 text-sm">
                            {nonStrikerStats?.runs ?? 0}{' '}
                            <span className="text-slate-400 font-normal text-xs">
                              ({nonStrikerStats?.ballsFaced ?? 0}b)
                            </span>
                          </div>
                        </div>
                      </>
                    );
                  })()}
                </div>
              </Card>

              {/* Current Bowler */}
              <Card className="p-5 md:col-span-1 bg-white">
                <h3 className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-3">
                  Current Bowler
                </h3>
                {(() => {
                  const bowlerStats = currentInningsScorecard.bowling.find(
                    (b) => b.participantId === latestDelivery.bowler_participant_id
                  );
                  return (
                    <div className="p-2.5 bg-slate-50 rounded-xl border border-slate-100">
                      <div className="font-bold text-slate-900 text-sm">
                        {getParticipantName(latestDelivery.bowler_participant_id)}
                      </div>
                      <div className="flex items-center justify-between text-xs text-slate-600 mt-2 font-mono">
                        <span>O: {bowlerStats?.overs || '0.0'}</span>
                        <span>M: {bowlerStats?.maidens || 0}</span>
                        <span>R: {bowlerStats?.runsConceded || 0}</span>
                        <span>W: {bowlerStats?.wickets || 0}</span>
                      </div>
                      <div className="text-right text-[11px] font-semibold text-slate-500 mt-1">
                        Econ: {bowlerStats?.economy || '—'}
                      </div>
                    </div>
                  );
                })()}
              </Card>
            </>
          )}
        </div>
      )}

      {/* Innings Tabs (if multiple innings exist) */}
      {fullScorecard.innings.length > 1 && (
        <div className="flex items-center gap-2 border-b border-slate-200 pb-2 overflow-x-auto">
          {fullScorecard.innings.map((inn, idx) => (
            <button
              key={inn.innings.id}
              onClick={() => setSelectedInningsIndex(idx)}
              className={`px-4 py-2 rounded-xl text-xs sm:text-sm font-bold transition-all whitespace-nowrap ${
                selectedInningsIndex === idx
                  ? 'bg-slate-900 text-white shadow-sm'
                  : 'bg-white text-slate-600 hover:bg-slate-100 border border-slate-200'
              }`}
            >
              Innings {inn.innings.innings_number}: {inn.battingTeamName} ({inn.innings.total_runs}/{inn.innings.total_wickets})
            </button>
          ))}
        </div>
      )}

      {/* Detailed Full Scorecard View for Current/Selected Innings */}
      {currentInningsScorecard ? (
        <div className="space-y-6">
          {/* Batting Card */}
          <Card className="p-6 bg-white shadow-sm overflow-hidden border border-slate-200 rounded-2xl">
            <div className="flex items-center justify-between mb-4 border-b pb-3">
              <h3 className="text-base font-extrabold text-slate-900 flex items-center gap-2">
                <Layers className="w-4 h-4 text-indigo-600" />
                {currentInningsScorecard.battingTeamName} — Batting Scorecard
              </h3>
              <div className="text-xs font-semibold text-slate-500">
                {currentInningsScorecard.innings.total_runs} / {currentInningsScorecard.innings.total_wickets} (
                {currentInningsScorecard.oversFormatted} ov)
              </div>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="border-b border-slate-200 text-[11px] font-black uppercase tracking-wider text-slate-400 bg-slate-50/60">
                    <th className="py-2.5 px-3">Batter</th>
                    <th className="py-2.5 px-3">Dismissal</th>
                    <th className="py-2.5 px-3 text-right">R</th>
                    <th className="py-2.5 px-3 text-right">B</th>
                    <th className="py-2.5 px-3 text-right">4s</th>
                    <th className="py-2.5 px-3 text-right">6s</th>
                    <th className="py-2.5 px-3 text-right">SR</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 text-sm">
                  {currentInningsScorecard.batting.map((row) => (
                    <tr
                      key={row.participantId}
                      className={`hover:bg-slate-50/80 transition-colors ${
                        !row.hasBatted ? 'opacity-60 text-slate-400' : ''
                      }`}
                    >
                      <td className="py-3 px-3 font-bold text-slate-900">
                        {row.playerName}
                        {row.hasBatted && !row.isOut && (
                          <span className="text-emerald-600 font-black ml-1">*</span>
                        )}
                      </td>
                      <td className="py-3 px-3 text-xs text-slate-500 font-medium">
                        {row.dismissalText}
                      </td>
                      <td className="py-3 px-3 text-right font-black text-slate-900">
                        {row.hasBatted ? row.runs : '—'}
                      </td>
                      <td className="py-3 px-3 text-right text-slate-600 font-medium">
                        {row.hasBatted ? row.ballsFaced : '—'}
                      </td>
                      <td className="py-3 px-3 text-right text-slate-600 font-medium">
                        {row.hasBatted ? row.fours : '—'}
                      </td>
                      <td className="py-3 px-3 text-right text-slate-600 font-medium">
                        {row.hasBatted ? row.sixes : '—'}
                      </td>
                      <td className="py-3 px-3 text-right text-slate-700 font-bold font-mono">
                        {row.strikeRate}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Extras line */}
            <div className="mt-4 pt-3 border-t border-slate-100 flex flex-col sm:flex-row sm:items-center justify-between text-xs text-slate-600 gap-2">
              <div className="font-semibold">
                Extras:{' '}
                <span className="font-mono font-bold text-slate-900">
                  {currentInningsScorecard.extras.total}
                </span>{' '}
                <span className="text-slate-400 font-normal">
                  (b {currentInningsScorecard.extras.byes}, lb {currentInningsScorecard.extras.legByes}, wd{' '}
                  {currentInningsScorecard.extras.wides}, nb {currentInningsScorecard.extras.noBalls}
                  {currentInningsScorecard.extras.penalty > 0
                    ? `, pen ${currentInningsScorecard.extras.penalty}`
                    : ''}
                  )
                </span>
              </div>
              <div className="font-bold text-slate-800">
                Total:{' '}
                <span className="text-sm font-black text-slate-900">
                  {currentInningsScorecard.innings.total_runs} / {currentInningsScorecard.innings.total_wickets}
                </span>{' '}
                ({currentInningsScorecard.oversFormatted} ov, RR {currentInningsScorecard.runRate})
              </div>
            </div>
          </Card>

          {/* Bowling Card */}
          <Card className="p-6 bg-white shadow-sm overflow-hidden border border-slate-200 rounded-2xl">
            <h3 className="text-base font-extrabold text-slate-900 mb-4 border-b pb-3 flex items-center gap-2">
              <Activity className="w-4 h-4 text-emerald-600" />
              {currentInningsScorecard.bowlingTeamName} — Bowling Scorecard
            </h3>

            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="border-b border-slate-200 text-[11px] font-black uppercase tracking-wider text-slate-400 bg-slate-50/60">
                    <th className="py-2.5 px-3">Bowler</th>
                    <th className="py-2.5 px-3 text-right">O</th>
                    <th className="py-2.5 px-3 text-right">M</th>
                    <th className="py-2.5 px-3 text-right">R</th>
                    <th className="py-2.5 px-3 text-right">W</th>
                    <th className="py-2.5 px-3 text-right">Econ</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 text-sm">
                  {currentInningsScorecard.bowling.map((b) => (
                    <tr key={b.participantId} className="hover:bg-slate-50/80 transition-colors">
                      <td className="py-3 px-3 font-bold text-slate-900">{b.playerName}</td>
                      <td className="py-3 px-3 text-right font-medium text-slate-700">{b.overs}</td>
                      <td className="py-3 px-3 text-right font-medium text-slate-700">{b.maidens}</td>
                      <td className="py-3 px-3 text-right font-bold text-slate-900">{b.runsConceded}</td>
                      <td className="py-3 px-3 text-right font-black text-slate-900">{b.wickets}</td>
                      <td className="py-3 px-3 text-right font-bold text-slate-700 font-mono">
                        {b.economy}
                      </td>
                    </tr>
                  ))}
                  {currentInningsScorecard.bowling.length === 0 && (
                    <tr>
                      <td colSpan={6} className="py-4 text-center text-xs text-slate-400 italic">
                        No bowling statistics recorded for this innings yet.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </Card>

          {/* Fall of Wickets Card */}
          <Card className="p-5 bg-white shadow-sm border border-slate-200 rounded-2xl">
            <h4 className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">
              Fall of Wickets
            </h4>
            {currentInningsScorecard.fallOfWickets.length > 0 ? (
              <div className="flex flex-wrap gap-x-4 gap-y-2 text-xs font-medium text-slate-700">
                {currentInningsScorecard.fallOfWickets.map((fow) => (
                  <span key={fow.wicketNumber} className="bg-slate-50 px-2.5 py-1 rounded-md border border-slate-200">
                    <strong className="text-slate-900 font-bold">
                      {fow.wicketNumber}-{fow.score}
                    </strong>{' '}
                    ({fow.dismissedPlayerName}, {fow.overs} ov)
                  </span>
                ))}
              </div>
            ) : (
              <p className="text-xs text-slate-400 italic">No wickets have fallen in this innings.</p>
            )}
          </Card>

          {/* Reconciliation Metadata */}
          <div className="flex items-center justify-between px-4 py-2 text-[11px] text-slate-400 font-mono">
            <span>
              Snapshot: {currentInningsScorecard.reconciliation.snapshotRuns}R / {currentInningsScorecard.reconciliation.snapshotWickets}W ({formatCricketOvers(currentInningsScorecard.reconciliation.snapshotLegalBalls)} ov)
            </span>
            <span className="flex items-center gap-1">
              {currentInningsScorecard.reconciliation.isFullyReconciled ? (
                <>
                  <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500" />
                  <span className="text-emerald-600 font-semibold">Authoritative Data Reconciled</span>
                </>
              ) : (
                <>
                  <AlertCircle className="w-3.5 h-3.5 text-amber-500" />
                  <span className="text-amber-600 font-semibold" title={currentInningsScorecard.reconciliation.discrepancyNote}>
                    Reconciliation Note
                  </span>
                </>
              )}
            </span>
          </div>
        </div>
      ) : (
        <Card className="p-8 text-center text-slate-400 bg-white">
          <p className="text-sm font-medium">No innings data recorded for this match yet.</p>
        </Card>
      )}
    </div>
  );
}
