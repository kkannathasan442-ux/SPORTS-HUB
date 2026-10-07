'use client';

import React, { useState, useEffect, useCallback, useMemo } from 'react';
import Link from 'next/link';
import { ArrowLeft, Trophy, Activity, Radio, RefreshCw, AlertCircle } from 'lucide-react';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { createSupabaseBrowserClient } from '@/lib/supabase/browser';

interface BadmintonLiveMatchCentreProps {
  match: any;
}

interface ScorecardData {
  match: {
    id: string;
    title: string | null;
    match_reference: string | null;
    status: string;
    match_format: string;
    sport_name: string;
    sport_slug: string;
    winner_side: string | null;
    result_summary: string | null;
    actual_start: string | null;
    actual_end: string | null;
  };
  competitor_a: {
    id: string;
    name: string;
    side: string;
    is_winner: boolean | null;
    score_summary: string | null;
    games_won: number;
  };
  competitor_b: {
    id: string;
    name: string;
    side: string;
    is_winner: boolean | null;
    score_summary: string | null;
    games_won: number;
  };
  games: Array<{
    id: string;
    game_number: number;
    side_a_points: number;
    side_b_points: number;
    winner_side: string | null;
    is_completed: boolean;
    serving_side: string;
    server_name: string | null;
    receiver_name: string | null;
  }>;
  current_game: {
    id: string;
    game_number: number;
    side_a_points: number;
    side_b_points: number;
    winner_side: string | null;
    is_completed: boolean;
    serving_side: string;
    server_name: string | null;
    receiver_name: string | null;
    win_by?: number;
  } | null;
  recent_rallies: Array<{
    id: string;
    sequence_number: number;
    winner_side: string;
    score_after_side_a: number;
    score_after_side_b: number;
    rally_type: string;
    voided_at: string | null;
    winning_participant_name: string | null;
  }>;
  summary: {
    side_a_games_won: number;
    side_b_games_won: number;
    is_match_completed: boolean;
    match_winner: string | null;
    result_summary: string | null;
  };
}

export function BadmintonLiveMatchCentre({ match }: BadmintonLiveMatchCentreProps) {
  const supabase = createSupabaseBrowserClient();
  const [scorecard, setScorecard] = useState<ScorecardData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [lastRefreshed, setLastRefreshed] = useState<Date>(new Date());

  const loadScorecard = useCallback(async () => {
    try {
      setError(null);
      const { data, error: rpcErr } = await supabase.rpc('get_badminton_match_scorecard', {
        p_match_id: match.id,
      });

      if (rpcErr) throw new Error(rpcErr.message);
      setScorecard(data as ScorecardData);
      setLastRefreshed(new Date());
    } catch (err: any) {
      setError(err.message || 'Failed to load match scorecard.');
    } finally {
      setLoading(false);
    }
  }, [supabase, match.id]);

  useEffect(() => {
    loadScorecard();
  }, [loadScorecard]);

  // Realtime subscription across matches, badminton_games, and badminton_rallies
  useEffect(() => {
    const channel = supabase
      .channel(`badminton_live:${match.id}`)
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'badminton_games', filter: `match_id=eq.${match.id}` },
        () => loadScorecard()
      )
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'badminton_rallies', filter: `match_id=eq.${match.id}` },
        () => loadScorecard()
      )
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'matches', filter: `id=eq.${match.id}` },
        () => loadScorecard()
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [supabase, match.id, loadScorecard]);

  // Side competitor names
  const sideAName = useMemo(() => {
    if (scorecard?.competitor_a?.name) return scorecard.competitor_a.name;
    const compA = match.competitors?.find((c: any) => c.side === 'SIDE_A');
    return compA?.competitor_name || compA?.team?.name || 'Side A';
  }, [scorecard, match.competitors]);

  const sideBName = useMemo(() => {
    if (scorecard?.competitor_b?.name) return scorecard.competitor_b.name;
    const compB = match.competitors?.find((c: any) => c.side === 'SIDE_B');
    return compB?.competitor_name || compB?.team?.name || 'Side B';
  }, [scorecard, match.competitors]);

  const isDeuce = useMemo(() => {
    if (!scorecard?.current_game) return false;
    const a = scorecard.current_game.side_a_points;
    const b = scorecard.current_game.side_b_points;
    return a >= 20 && b >= 20 && Math.abs(a - b) < 2;
  }, [scorecard]);

  if (loading && !scorecard) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[50vh] text-slate-500">
        <Activity className="w-8 h-8 animate-spin mb-4 text-emerald-600" />
        <p className="font-medium">Connecting to Badminton Live Match Centre...</p>
      </div>
    );
  }

  const isMatchComplete = scorecard?.summary?.is_match_completed || match.status === 'COMPLETED';
  const currentGame = scorecard?.current_game;

  return (
    <div className="max-w-3xl mx-auto space-y-6 pb-12" data-testid="badminton-live-centre">
      {/* Top Header & Navigation */}
      <div className="flex items-center justify-between">
        <Link
          href={`/matches/${match.id}`}
          className="inline-flex items-center text-sm font-medium text-slate-600 hover:text-slate-900 transition-colors"
        >
          <ArrowLeft className="w-4 h-4 mr-1.5" />
          Match Details
        </Link>
        <div className="flex items-center gap-2">
          {isMatchComplete ? (
            <span className="inline-flex items-center px-3 py-1 rounded-full text-xs font-bold bg-slate-900 text-white">
              <Trophy className="w-3.5 h-3.5 mr-1.5 text-amber-400" />
              MATCH COMPLETED
            </span>
          ) : (
            <span className="inline-flex items-center px-3 py-1 rounded-full text-xs font-bold bg-emerald-100 text-emerald-800">
              <span className="w-2 h-2 rounded-full bg-emerald-500 mr-1.5 animate-pulse" />
              LIVE ●
            </span>
          )}
          <Button
            variant="ghost"
            size="sm"
            onClick={() => loadScorecard()}
            className="text-slate-500 hover:text-slate-700 h-8 px-2"
            title="Refresh Scorecard"
          >
            <RefreshCw className="w-3.5 h-3.5" />
          </Button>
        </div>
      </div>

      {/* Error Banner */}
      {error && (
        <div className="flex items-center gap-3 p-3 bg-red-50 border border-red-200 text-red-800 rounded-lg text-sm">
          <AlertCircle className="w-4 h-4 text-red-600" />
          <span>{error}</span>
        </div>
      )}

      {/* Match Title & Format Banner */}
      <div className="text-center space-y-1">
        <div className="inline-flex items-center gap-1.5 text-xs font-bold tracking-wider uppercase text-emerald-700 bg-emerald-50 px-3 py-0.5 rounded-full border border-emerald-200">
          <Radio className="w-3 h-3 text-emerald-600" />
          <span>Badminton Live Match Centre • Best of 3</span>
        </div>
        <h1 className="text-2xl font-black text-slate-900">
          {match.title || `${sideAName} vs ${sideBName}`}
        </h1>
        <p className="text-xs text-slate-500">
          {match.venue?.name ? `${match.venue.name} • ` : ''}
          {match.facility?.name ? `${match.facility.name} • ` : ''}
          Format: {match.match_format}
        </p>
      </div>

      {/* Primary Scoreboard Display */}
      <Card className="p-6 bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 text-white shadow-xl border-slate-700">
        <div className="flex items-center justify-between text-xs font-semibold text-slate-400 mb-4 border-b border-slate-700/60 pb-3">
          <span>
            {currentGame
              ? `GAME ${currentGame.game_number} OF 3`
              : isMatchComplete
              ? 'FINAL SCORE'
              : 'GAME 1 OF 3'}
          </span>
          <div className="flex items-center gap-3">
            {isDeuce && (
              <span className="bg-amber-500/20 text-amber-300 border border-amber-400/40 text-[10px] font-black uppercase px-2 py-0.5 rounded tracking-wider animate-pulse">
                DEUCE
              </span>
            )}
            <span className="text-slate-400">
              Refreshed: {lastRefreshed.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
            </span>
          </div>
        </div>

        {/* Competitor Scoring Grid */}
        <div className="grid grid-cols-2 gap-4 items-center">
          {/* Side A */}
          <div
            className={`p-4 rounded-xl transition-all ${
              currentGame?.serving_side === 'SIDE_A' && !isMatchComplete
                ? 'bg-emerald-950/40 border border-emerald-500/50 shadow-inner'
                : 'bg-slate-800/40 border border-slate-700/50'
            }`}
          >
            <div className="flex items-center justify-between mb-1">
              <span className="text-xs font-bold text-emerald-400 uppercase tracking-wide">Side A</span>
              {currentGame?.serving_side === 'SIDE_A' && !isMatchComplete && (
                <span className="text-[10px] font-bold bg-emerald-500/20 text-emerald-300 border border-emerald-400/30 px-1.5 py-0.5 rounded flex items-center gap-1">
                  🏸 SERVING
                </span>
              )}
            </div>
            <h2 className="text-lg font-bold text-white truncate mb-2">{sideAName}</h2>
            <div className="flex items-baseline justify-between">
              <span className="text-4xl md:text-5xl font-black text-white font-mono" data-testid="live-side-a-score">
                {currentGame ? currentGame.side_a_points : 0}
              </span>
              <span className="text-xs font-semibold text-slate-400 bg-slate-700/60 px-2 py-1 rounded">
                {scorecard?.summary?.side_a_games_won ?? 0} {scorecard?.summary?.side_a_games_won === 1 ? 'game' : 'games'} won
              </span>
            </div>
          </div>

          {/* Side B */}
          <div
            className={`p-4 rounded-xl transition-all ${
              currentGame?.serving_side === 'SIDE_B' && !isMatchComplete
                ? 'bg-blue-950/40 border border-blue-500/50 shadow-inner'
                : 'bg-slate-800/40 border border-slate-700/50'
            }`}
          >
            <div className="flex items-center justify-between mb-1">
              <span className="text-xs font-bold text-blue-400 uppercase tracking-wide">Side B</span>
              {currentGame?.serving_side === 'SIDE_B' && !isMatchComplete && (
                <span className="text-[10px] font-bold bg-blue-500/20 text-blue-300 border border-blue-400/30 px-1.5 py-0.5 rounded flex items-center gap-1">
                  🏸 SERVING
                </span>
              )}
            </div>
            <h2 className="text-lg font-bold text-white truncate mb-2">{sideBName}</h2>
            <div className="flex items-baseline justify-between">
              <span className="text-4xl md:text-5xl font-black text-white font-mono" data-testid="live-side-b-score">
                {currentGame ? currentGame.side_b_points : 0}
              </span>
              <span className="text-xs font-semibold text-slate-400 bg-slate-700/60 px-2 py-1 rounded">
                {scorecard?.summary?.side_b_games_won ?? 0} {scorecard?.summary?.side_b_games_won === 1 ? 'game' : 'games'} won
              </span>
            </div>
          </div>
        </div>

        {/* Server Details when active */}
        {!isMatchComplete && currentGame && (
          <div className="mt-4 pt-3 border-t border-slate-700/60 flex items-center justify-between text-xs text-slate-400">
            <div>
              <span>Current Server: </span>
              <strong className="text-slate-200">
                {currentGame.serving_side === 'SIDE_A'
                  ? currentGame.server_name || sideAName
                  : currentGame.server_name || sideBName}
              </strong>
            </div>
            <div>
              <span>Court: </span>
              <strong className="text-slate-200">
                {(currentGame.serving_side === 'SIDE_A' ? currentGame.side_a_points : currentGame.side_b_points) % 2 === 0
                  ? 'Right (Even)'
                  : 'Left (Odd)'}
              </strong>
            </div>
          </div>
        )}
      </Card>

      {/* Match Completed Banner */}
      {isMatchComplete && (
        <Card className="p-5 bg-amber-50 border-amber-300 text-center space-y-2 shadow-sm">
          <div className="inline-flex p-3 rounded-full bg-amber-100 text-amber-700 mb-1">
            <Trophy className="w-8 h-8" />
          </div>
          <h2 className="text-xl font-black text-amber-950">
            {scorecard?.summary?.match_winner === 'SIDE_A'
              ? `${sideAName} Won the Match!`
              : scorecard?.summary?.match_winner === 'SIDE_B'
              ? `${sideBName} Won the Match!`
              : 'Match Completed'}
          </h2>
          <p className="text-sm font-semibold text-amber-900">
            {scorecard?.summary?.result_summary || `${scorecard?.summary?.side_a_games_won} - ${scorecard?.summary?.side_b_games_won}`}
          </p>
        </Card>
      )}

      {/* Game-by-Game Score Summary */}
      <div className="space-y-2">
        <h3 className="text-sm font-bold uppercase tracking-wider text-slate-600 px-1">
          Game-by-Game Breakdown
        </h3>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          {[1, 2, 3].map((gNum) => {
            const g = scorecard?.games?.find((gm) => gm.game_number === gNum);
            const isPlayed = !!g;
            const isComplete = g?.is_completed;
            const isCurrent = currentGame?.game_number === gNum && !isComplete;

            return (
              <Card
                key={gNum}
                className={`p-4 border ${
                  isCurrent
                    ? 'border-emerald-400 bg-emerald-50/50 shadow-sm'
                    : isComplete
                    ? 'border-slate-200 bg-white'
                    : 'border-slate-100 bg-slate-50 text-slate-400'
                }`}
              >
                <div className="flex items-center justify-between text-xs font-bold mb-2">
                  <span className={isCurrent ? 'text-emerald-700' : 'text-slate-600'}>
                    GAME {gNum}
                  </span>
                  {isComplete ? (
                    <span className="text-[10px] uppercase font-bold text-slate-500 bg-slate-100 px-1.5 py-0.5 rounded">
                      Final
                    </span>
                  ) : isCurrent ? (
                    <span className="text-[10px] uppercase font-bold text-emerald-700 bg-emerald-100 px-1.5 py-0.5 rounded animate-pulse">
                      Live
                    </span>
                  ) : (
                    <span className="text-[10px] text-slate-400">If Needed</span>
                  )}
                </div>

                {isPlayed ? (
                  <div className="flex items-center justify-between text-lg font-black font-mono">
                    <span className={g.winner_side === 'SIDE_A' ? 'text-emerald-600' : 'text-slate-800'}>
                      {g.side_a_points}
                    </span>
                    <span className="text-xs text-slate-300 font-normal">vs</span>
                    <span className={g.winner_side === 'SIDE_B' ? 'text-blue-600' : 'text-slate-800'}>
                      {g.side_b_points}
                    </span>
                  </div>
                ) : (
                  <div className="text-center text-sm font-mono text-slate-300 py-1">
                    —
                  </div>
                )}
              </Card>
            );
          })}
        </div>
      </div>

      {/* Recent Rallies Feed */}
      {scorecard?.recent_rallies && scorecard.recent_rallies.length > 0 && (
        <div className="space-y-2">
          <h3 className="text-sm font-bold uppercase tracking-wider text-slate-600 px-1">
            Recent Rallies (Game {currentGame?.game_number || 1})
          </h3>
          <Card className="divide-y divide-slate-100 overflow-hidden bg-white shadow-sm border-slate-200">
            {scorecard.recent_rallies.slice(0, 8).map((r) => (
              <div
                key={r.id}
                className="p-3 flex items-center justify-between text-xs hover:bg-slate-50 transition-colors"
              >
                <div className="flex items-center gap-2.5">
                  <span className="font-mono font-bold text-slate-400">#{r.sequence_number}</span>
                  <span
                    className={`font-bold px-2 py-0.5 rounded text-[11px] ${
                      r.winner_side === 'SIDE_A'
                        ? 'bg-emerald-100 text-emerald-800'
                        : 'bg-blue-100 text-blue-800'
                    }`}
                  >
                    Point to {r.winner_side === 'SIDE_A' ? sideAName : sideBName}
                  </span>
                  {r.rally_type && r.rally_type !== 'NORMAL' && (
                    <span className="text-[10px] font-semibold text-slate-500 uppercase bg-slate-100 px-1.5 py-0.5 rounded">
                      {r.rally_type}
                    </span>
                  )}
                </div>
                <div className="font-mono font-bold text-slate-700">
                  {r.score_after_side_a} – {r.score_after_side_b}
                </div>
              </div>
            ))}
          </Card>
        </div>
      )}

      {/* Spectator Read-Only Guarantee Notice */}
      <div className="text-center pt-2">
        <p className="text-xs text-slate-400">
          Official SportsHub Realtime Badminton Scoreboard • Read-Only Live Spectator Stream
        </p>
      </div>
    </div>
  );
}
