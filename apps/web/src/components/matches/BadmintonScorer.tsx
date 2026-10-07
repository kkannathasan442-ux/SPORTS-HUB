'use client';

import React, { useState, useEffect, useCallback, useMemo } from 'react';
import Link from 'next/link';
import { createSupabaseBrowserClient } from '@/lib/supabase/browser';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { 
  ArrowLeft, 
  RotateCcw, 
  Activity, 
  Loader2, 
  AlertCircle, 
  Trophy, 
  ChevronDown, 
  CheckCircle2 
} from 'lucide-react';

interface BadmintonScorerProps {
  match: any;
}

export function BadmintonScorer({ match }: { match: any }) {
  const supabase = createSupabaseBrowserClient();
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [undoing, setUndoing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);
  const [showUndoConfirm, setShowUndoConfirm] = useState(false);

  // Authoritative DB state
  const [matchData, setMatchData] = useState<any>(match);
  const [allGames, setAllGames] = useState<any[]>([]);
  const [game, setGame] = useState<any>(null);
  const [rallies, setRallies] = useState<any[]>([]);
  const [progressing, setProgressing] = useState(false);
  const [progressionStatus, setProgressionStatus] = useState<string | null>(null);

  // Rally Type options
  const [rallyType, setRallyType] = useState<string>('NORMAL');

  // Competitors
  const sideA = useMemo(() => match.competitors?.find((c: any) => c.side === 'SIDE_A'), [match.competitors]);
  const sideB = useMemo(() => match.competitors?.find((c: any) => c.side === 'SIDE_B'), [match.competitors]);

  const allParticipants = useMemo(() => {
    return [...(sideA?.participants || []), ...(sideB?.participants || [])];
  }, [sideA, sideB]);

  const sideAParticipants = useMemo(() => {
    return allParticipants.filter((p: any) => p.competitor_id === sideA?.id);
  }, [allParticipants, sideA?.id]);

  const sideBParticipants = useMemo(() => {
    return allParticipants.filter((p: any) => p.competitor_id === sideB?.id);
  }, [allParticipants, sideB?.id]);

  const sideAName = sideA?.competitor_name || sideAParticipants[0]?.display_name || 'Side A';
  const sideBName = sideB?.competitor_name || sideBParticipants[0]?.display_name || 'Side B';

  // Games won counts
  const sideAGamesWon = useMemo(() => {
    return allGames.filter((g) => g.is_completed && g.winner_side === 'SIDE_A').length;
  }, [allGames]);

  const sideBGamesWon = useMemo(() => {
    return allGames.filter((g) => g.is_completed && g.winner_side === 'SIDE_B').length;
  }, [allGames]);

  const isMatchCompleted = useMemo(() => {
    return matchData?.status === 'COMPLETED' || sideAGamesWon >= 2 || sideBGamesWon >= 2;
  }, [matchData?.status, sideAGamesWon, sideBGamesWon]);

  const matchWinnerName = useMemo(() => {
    const winnerSide = matchData?.winner_side || (sideAGamesWon >= 2 ? 'SIDE_A' : sideBGamesWon >= 2 ? 'SIDE_B' : null);
    if (winnerSide === 'SIDE_A') return sideAName;
    if (winnerSide === 'SIDE_B') return sideBName;
    return null;
  }, [matchData?.winner_side, sideAGamesWon, sideBGamesWon, sideAName, sideBName]);

  // Load latest game and rallies
  const loadAuthoritativeState = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);

      // 1. Fetch updated match row
      const { data: latestMatch } = await supabase
        .from('matches')
        .select('*')
        .eq('id', match.id)
        .maybeSingle();

      if (latestMatch) {
        setMatchData(latestMatch);
      }

      // 2. Fetch all games for this match
      let { data: gamesList, error: gamesErr } = await supabase
        .from('badminton_games')
        .select('*')
        .eq('match_id', match.id)
        .order('game_number', { ascending: true });

      if (gamesErr) throw new Error(gamesErr.message);

      // If no game exists yet and match is in a scoreable state, initialize Game 1 via RPC
      if ((!gamesList || gamesList.length === 0) && (match.status === 'WARMUP' || match.status === 'LIVE' || match.status === 'SCHEDULED')) {
        const { data: rpcRes, error: initErr } = await supabase.rpc('progress_badminton_match', {
          p_match_id: match.id,
        });

        if (!initErr) {
          const { data: refreshedGames } = await supabase
            .from('badminton_games')
            .select('*')
            .eq('match_id', match.id)
            .order('game_number', { ascending: true });
          gamesList = refreshedGames || [];
        }
      }

      setAllGames(gamesList || []);

      // Check if match victory condition is met (>= 2 games won) and finalize match authoritatively in DB
      const winsA = (gamesList || []).filter((g) => g.is_completed && g.winner_side === 'SIDE_A').length;
      const winsB = (gamesList || []).filter((g) => g.is_completed && g.winner_side === 'SIDE_B').length;
      if ((winsA >= 2 || winsB >= 2) && latestMatch?.status !== 'COMPLETED') {
        await supabase.rpc('progress_badminton_match', { p_match_id: match.id });
        const { data: finalMatch } = await supabase.from('matches').select('*').eq('id', match.id).maybeSingle();
        if (finalMatch) {
          setMatchData(finalMatch);
        }
      }

      // Active game is the latest game
      const latestGame = gamesList && gamesList.length > 0 ? gamesList[gamesList.length - 1] : null;
      setGame(latestGame);

      // 3. Fetch rallies for active game
      if (latestGame) {
        const { data: rallyData, error: rallyErr } = await supabase
          .from('badminton_rallies')
          .select('*')
          .eq('game_id', latestGame.id)
          .is('voided_at', null)
          .order('sequence_number', { ascending: false })
          .limit(15);

        if (rallyErr) throw new Error(rallyErr.message);
        setRallies(rallyData || []);
      }
    } catch (err: any) {
      setError(err.message || 'Failed to load match state.');
    } finally {
      setLoading(false);
    }
  }, [supabase, match.id, match.status]);

  useEffect(() => {
    loadAuthoritativeState();
  }, [loadAuthoritativeState]);

  // Realtime subscription to reload on external updates
  useEffect(() => {
    const channel = supabase
      .channel(`badminton_scorer:${match.id}`)
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'matches', filter: `id=eq.${match.id}` },
        () => loadAuthoritativeState()
      )
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'badminton_games', filter: `match_id=eq.${match.id}` },
        () => loadAuthoritativeState()
      )
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'badminton_rallies', filter: `match_id=eq.${match.id}` },
        () => loadAuthoritativeState()
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [supabase, match.id, loadAuthoritativeState]);

  // Error mapper
  const mapRpcError = (msg: string) => {
    if (msg.includes('UNAUTHORIZED')) return 'You are not authorized to score this match.';
    if (msg.includes('INVALID_SPORT')) return 'This is not a Badminton match.';
    if (msg.includes('INVALID_MATCH_STATE')) return 'Match is not in a scoreable state (must be WARMUP or LIVE).';
    if (msg.includes('GAME_COMPLETED')) return 'This game is already completed.';
    if (msg.includes('MATCH_COMPLETED')) return 'This match has already been completed.';
    if (msg.includes('IDEMPOTENCY_CONFLICT')) return 'This rally was already submitted with conflicting details.';
    if (msg.includes('INVALID_UNDO')) return 'Only the latest active rally can be undone.';
    if (msg.includes('INVALID_RECEIVER')) return 'Server and receiver cannot be on the same side.';
    return msg;
  };

  // Safe Match Progression handler
  const handleProgressMatch = async () => {
    if (progressing) return; // Prevent double taps

    try {
      setProgressing(true);
      setError(null);
      const nextNum = (game?.game_number || 1) + 1;
      setProgressionStatus(`STARTING GAME ${nextNum}...`);

      const { data: result, error: rpcErr } = await supabase.rpc('progress_badminton_match', {
        p_match_id: match.id,
      });

      if (rpcErr) {
        throw new Error(rpcErr.message);
      }

      if (result?.is_match_completed) {
        setSuccessMsg(`Match completed! Winner: ${result.match_winner === 'SIDE_A' ? sideAName : sideBName}`);
      } else {
        setSuccessMsg(`Game ${result?.game_number || nextNum} started!`);
      }

      await loadAuthoritativeState();
    } catch (err: any) {
      setError(mapRpcError(err.message || 'Failed to progress match.'));
    } finally {
      setProgressing(false);
      setProgressionStatus(null);
    }
  };

  // Record rally handler
  const handleRecordRally = async (winnerSide: 'SIDE_A' | 'SIDE_B') => {
    if (!game || submitting || game.is_completed) return;

    try {
      setSubmitting(true);
      setError(null);
      setSuccessMsg(null);

      const clientEventId = crypto.randomUUID();

      // Determine winning participant if singles
      const winningPartId = winnerSide === 'SIDE_A'
        ? sideAParticipants[0]?.id
        : sideBParticipants[0]?.id;

      const { data, error: rpcErr } = await supabase.rpc('record_badminton_rally', {
        p_match_id: match.id,
        p_game_id: game.id,
        p_client_event_id: clientEventId,
        p_winner_side: winnerSide,
        p_winning_participant_id: winningPartId || null,
        p_rally_type: rallyType,
      });

      if (rpcErr) {
        throw new Error(rpcErr.message);
      }

      // Authoritative state successfully recorded
      await loadAuthoritativeState();
      setRallyType('NORMAL'); // Reset to default
    } catch (err: any) {
      setError(mapRpcError(err.message || 'Failed to record rally.'));
    } finally {
      setSubmitting(false);
    }
  };

  // Undo rally handler
  const handleUndo = async () => {
    if (!game || undoing || rallies.length === 0) return;

    try {
      setUndoing(true);
      setError(null);
      setShowUndoConfirm(false);

      const { data, error: rpcErr } = await supabase.rpc('undo_badminton_rally', {
        p_match_id: match.id,
        p_game_id: game.id,
        p_rally_id: rallies[0]?.id,
      });

      if (rpcErr) {
        throw new Error(rpcErr.message);
      }

      setSuccessMsg('Last rally undone successfully.');
      await loadAuthoritativeState();
    } catch (err: any) {
      setError(mapRpcError(err.message || 'Failed to undo rally.'));
    } finally {
      setUndoing(false);
    }
  };

  // Court side derivation (Singles)
  const isDeuce = useMemo(() => {
    if (!game) return false;
    const a = game.side_a_points;
    const b = game.side_b_points;
    return a >= 20 && b >= 20 && Math.abs(a - b) < (game.win_by || 2);
  }, [game]);

  const servingScore = useMemo(() => {
    if (!game) return 0;
    return game.serving_side === 'SIDE_A' ? game.side_a_points : game.side_b_points;
  }, [game]);

  const servingCourt = useMemo(() => {
    return servingScore % 2 === 0 ? 'Right Court (Even)' : 'Left Court (Odd)';
  }, [servingScore]);

  const currentServerName = useMemo(() => {
    if (!game) return 'Side A';
    if (game.serving_side === 'SIDE_A') {
      return sideAParticipants[0]?.display_name || sideAName;
    }
    return sideBParticipants[0]?.display_name || sideBName;
  }, [game, sideAParticipants, sideBParticipants, sideAName, sideBName]);

  const currentReceiverName = useMemo(() => {
    if (!game) return 'Side B';
    if (game.serving_side === 'SIDE_A') {
      return sideBParticipants[0]?.display_name || sideBName;
    }
    return sideAParticipants[0]?.display_name || sideAName;
  }, [game, sideAParticipants, sideBParticipants, sideAName, sideBName]);

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[50vh] text-slate-500">
        <Loader2 className="w-8 h-8 animate-spin mb-4 text-sports-accent" />
        <p className="font-medium">Loading Badminton Scorer...</p>
      </div>
    );
  }

  return (
    <div className="max-w-xl mx-auto space-y-4 pb-12">
      {/* Top Navigation & Status Bar */}
      <div className="flex items-center justify-between">
        <Link 
          href={`/matches/${match.id}`}
          className="inline-flex items-center text-sm font-medium text-slate-600 hover:text-slate-900 transition-colors"
        >
          <ArrowLeft className="w-4 h-4 mr-1.5" />
          Match Details
        </Link>
        <div className="flex items-center gap-2">
          <Link
            href={`/matches/${match.id}/live`}
            className="text-xs font-semibold text-emerald-600 hover:text-emerald-700 hover:underline mr-1"
          >
            Public Live View ↗
          </Link>
          <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold bg-emerald-100 text-emerald-800">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 mr-1.5 animate-pulse" />
            {matchData?.status || match.status}
          </span>
          <span className="text-xs font-bold text-slate-400">
            {match.match_format}
          </span>
        </div>
      </div>

      {/* Best-of-3 Games Won Summary Card */}
      <div className="bg-slate-900 text-white px-4 py-3 rounded-xl flex items-center justify-between shadow-sm">
        <div className="flex items-center gap-2">
          <Trophy className="w-4 h-4 text-amber-400" />
          <span className="text-xs font-bold uppercase tracking-wider text-slate-300">Games Won:</span>
        </div>
        <div className="flex items-center gap-4 text-xs font-mono">
          <span className="font-bold text-emerald-400">
            {sideAName}: <strong className="text-sm font-black text-white">{sideAGamesWon}</strong>
          </span>
          <span className="text-slate-500 font-normal">|</span>
          <span className="font-bold text-blue-400">
            {sideBName}: <strong className="text-sm font-black text-white">{sideBGamesWon}</strong>
          </span>
        </div>
      </div>

      {/* Game Switcher Tabs if multiple games */}
      {allGames.length > 1 && (
        <div className="flex gap-2 overflow-x-auto pb-1">
          {allGames.map((g) => (
            <button
              key={g.id}
              type="button"
              onClick={() => {
                setGame(g);
              }}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${
                game?.id === g.id
                  ? 'bg-emerald-600 text-white shadow-sm'
                  : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
              }`}
            >
              Game {g.game_number} {g.is_completed ? `(${g.side_a_points}-${g.side_b_points})` : '(LIVE)'}
            </button>
          ))}
        </div>
      )}

      {/* Error & Feedback Messages */}
      {error && (
        <div className="flex items-start gap-3 p-3.5 bg-red-50 border border-red-200 text-red-800 rounded-lg text-sm">
          <AlertCircle className="w-5 h-5 flex-shrink-0 text-red-600 mt-0.5" />
          <div className="flex-1">
            <p className="font-semibold">Scoring Error</p>
            <p>{error}</p>
          </div>
        </div>
      )}

      {successMsg && (
        <div className="flex items-center gap-2.5 p-3 bg-emerald-50 border border-emerald-200 text-emerald-800 rounded-lg text-sm">
          <CheckCircle2 className="w-4 h-4 text-emerald-600" />
          <span>{successMsg}</span>
        </div>
      )}

      {/* MATCH COMPLETED CARD */}
      {isMatchCompleted && (
        <Card className="p-6 bg-gradient-to-br from-emerald-600 to-teal-800 text-white text-center shadow-lg rounded-2xl border-0">
          <div className="flex items-center justify-center gap-2 mb-2">
            <Trophy className="w-7 h-7 text-amber-300 animate-bounce" />
            <h2 className="text-xl font-black uppercase tracking-wider text-amber-100">MATCH COMPLETED</h2>
          </div>
          <p className="text-2xl font-black text-white mb-1" data-testid="match-winner-announcement">
            WINNER: {matchWinnerName}
          </p>
          <p className="text-sm font-medium text-emerald-100 mb-4">
            {matchData?.result_summary || `${matchWinnerName} won the match`}
          </p>

          <div className="bg-black/20 rounded-xl p-3 max-w-sm mx-auto mb-4 backdrop-blur-sm border border-white/10">
            <p className="text-xs uppercase tracking-wider font-semibold text-emerald-200 mb-2">
              Game Scores
            </p>
            <div className="space-y-1.5 text-xs font-mono">
              {allGames.map((g) => (
                <div key={g.id} className="flex justify-between items-center px-2 py-1 bg-white/5 rounded">
                  <span className="font-semibold text-white">Game {g.game_number}:</span>
                  <span className="font-bold text-amber-200">{g.side_a_points} – {g.side_b_points}</span>
                  <span className="text-emerald-100 font-sans text-[11px]">
                    ({g.winner_side === 'SIDE_A' ? sideAName : sideBName})
                  </span>
                </div>
              ))}
            </div>
          </div>

          <div className="flex justify-center gap-3">
            <Link href={`/matches/${match.id}/live`}>
              <Button className="bg-white text-emerald-800 hover:bg-emerald-50 font-bold border-0 shadow">
                Open Public Live Centre
              </Button>
            </Link>
          </div>
        </Card>
      )}

      {/* Game Header Card */}
      <Card className="p-5 text-center bg-white shadow-sm border border-slate-200">
        <div className="flex items-center justify-between mb-3 border-b border-slate-100 pb-2">
          <span className="text-xs font-bold uppercase tracking-wider text-slate-500">
            Game {game?.game_number || 1}
          </span>
          {isDeuce && (
            <span className="px-2 py-0.5 rounded text-xs font-extrabold bg-amber-100 text-amber-800 animate-bounce">
              DEUCE
            </span>
          )}
          <span className="text-xs text-slate-400 font-medium">
            First to {game?.points_to_win || 21} (Win by {game?.win_by || 2}, Max {game?.max_points || 30})
          </span>
        </div>

        {/* Big Score Board */}
        <div className="grid grid-cols-2 gap-4 my-3 items-center">
          {/* Side A Box */}
          <div className={`p-4 rounded-xl border-2 transition-all ${
            game?.serving_side === 'SIDE_A' 
              ? 'border-emerald-500 bg-emerald-50/50 shadow-sm' 
              : 'border-slate-100 bg-slate-50/60'
          }`}>
            <p className="text-sm font-bold text-slate-800 truncate mb-1">
              {sideAName}
            </p>
            <p className="text-5xl font-black tracking-tight text-slate-900" data-testid="score-side-a">
              {game?.side_a_points || 0}
            </p>
            {game?.serving_side === 'SIDE_A' && (
              <span className="inline-block mt-2 text-[11px] font-bold uppercase tracking-wider text-emerald-700 bg-emerald-100 px-2 py-0.5 rounded-full">
                🏸 Serving
              </span>
            )}
          </div>

          {/* Side B Box */}
          <div className={`p-4 rounded-xl border-2 transition-all ${
            game?.serving_side === 'SIDE_B' 
              ? 'border-emerald-500 bg-emerald-50/50 shadow-sm' 
              : 'border-slate-100 bg-slate-50/60'
          }`}>
            <p className="text-sm font-bold text-slate-800 truncate mb-1">
              {sideBName}
            </p>
            <p className="text-5xl font-black tracking-tight text-slate-900" data-testid="score-side-b">
              {game?.side_b_points || 0}
            </p>
            {game?.serving_side === 'SIDE_B' && (
              <span className="inline-block mt-2 text-[11px] font-bold uppercase tracking-wider text-emerald-700 bg-emerald-100 px-2 py-0.5 rounded-full">
                🏸 Serving
              </span>
            )}
          </div>
        </div>

        {/* Service Context Info */}
        <div className="mt-3 pt-3 border-t border-slate-100 flex items-center justify-between text-xs text-slate-600 px-1">
          <div>
            <span className="text-slate-400">Server:</span>{' '}
            <strong className="text-slate-700">{currentServerName}</strong>
          </div>
          <div>
            <span className="text-slate-400">Court:</span>{' '}
            <strong className="text-slate-700">{servingCourt}</strong>
          </div>
        </div>
      </Card>

      {/* Game Completed Banner & Next Game Progression Button */}
      {game?.is_completed && !isMatchCompleted && (
        <Card className="p-5 bg-emerald-50 border-2 border-emerald-300 text-center space-y-3">
          <div className="flex items-center justify-center gap-2 text-emerald-900 font-bold">
            <Trophy className="w-5 h-5 text-emerald-600" />
            <span className="text-base">GAME {game.game_number} COMPLETED</span>
          </div>
          <p className="text-sm text-emerald-800">
            Winner: <strong>{game.winner_side === 'SIDE_A' ? sideAName : sideBName}</strong> ({game.side_a_points} – {game.side_b_points})
          </p>
          <div className="pt-2">
            <Button
              type="button"
              onClick={handleProgressMatch}
              disabled={progressing}
              className="w-full h-12 bg-emerald-600 hover:bg-emerald-700 text-white font-extrabold text-base shadow-md transition-all active:scale-95"
              data-testid="btn-start-next-game"
            >
              {progressing ? (
                <>
                  <Loader2 className="w-5 h-5 animate-spin mr-2" />
                  {progressionStatus || 'STARTING NEXT GAME...'}
                </>
              ) : (
                `START GAME ${game.game_number + 1}`
              )}
            </Button>
          </div>
        </Card>
      )}

      {/* Primary Action Buttons */}
      {!game?.is_completed && !isMatchCompleted && (
        <div className="space-y-3">
          {/* Rally Type Selector */}
          <div className="flex items-center justify-between px-1">
            <span className="text-xs font-semibold text-slate-500">Rally Type:</span>
            <div className="flex gap-1.5 overflow-x-auto py-1">
              {['NORMAL', 'SMASH', 'DROP', 'NET', 'OUT', 'FAULT'].map((type) => (
                <button
                  key={type}
                  type="button"
                  onClick={() => setRallyType(type)}
                  className={`text-[11px] font-bold px-2 py-1 rounded transition-colors ${
                    rallyType === type
                      ? 'bg-slate-800 text-white'
                      : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                  }`}
                >
                  {type}
                </button>
              ))}
            </div>
          </div>

          {/* Big Tap Scoring Controls */}
          <div className="grid grid-cols-2 gap-3">
            <Button
              type="button"
              disabled={submitting || game?.is_completed}
              onClick={() => handleRecordRally('SIDE_A')}
              className="h-28 flex flex-col items-center justify-center gap-1.5 bg-emerald-600 hover:bg-emerald-700 text-white font-black text-lg rounded-xl shadow active:scale-95 transition-transform"
              data-testid="btn-side-a-point"
            >
              {submitting ? (
                <Loader2 className="w-6 h-6 animate-spin" />
              ) : (
                <>
                  <span className="text-xs font-medium uppercase tracking-wider opacity-85">Point to</span>
                  <span className="truncate max-w-[140px]">{sideAName}</span>
                  <span className="text-xs font-mono font-bold bg-emerald-700/60 px-2 py-0.5 rounded">
                    SIDE A +1
                  </span>
                </>
              )}
            </Button>

            <Button
              type="button"
              disabled={submitting || game?.is_completed}
              onClick={() => handleRecordRally('SIDE_B')}
              className="h-28 flex flex-col items-center justify-center gap-1.5 bg-blue-600 hover:bg-blue-700 text-white font-black text-lg rounded-xl shadow active:scale-95 transition-transform"
              data-testid="btn-side-b-point"
            >
              {submitting ? (
                <Loader2 className="w-6 h-6 animate-spin" />
              ) : (
                <>
                  <span className="text-xs font-medium uppercase tracking-wider opacity-85">Point to</span>
                  <span className="truncate max-w-[140px]">{sideBName}</span>
                  <span className="text-xs font-mono font-bold bg-blue-700/60 px-2 py-0.5 rounded">
                    SIDE B +1
                  </span>
                </>
              )}
            </Button>
          </div>
        </div>
      )}

      {/* Secondary Controls: Undo & Confirm */}
      <div className="flex items-center justify-between pt-1">
        {showUndoConfirm ? (
          <div className="flex items-center gap-2 bg-amber-50 p-2 rounded-lg border border-amber-200 w-full justify-between">
            <span className="text-xs font-bold text-amber-900">Undo the last rally?</span>
            <div className="flex gap-2">
              <Button
                size="sm"
                variant="outline"
                onClick={() => setShowUndoConfirm(false)}
                className="h-7 text-xs"
              >
                Cancel
              </Button>
              <Button
                size="sm"
                onClick={handleUndo}
                disabled={undoing}
                className="h-7 text-xs bg-amber-600 hover:bg-amber-700 text-white"
                data-testid="confirm-undo-btn"
              >
                {undoing ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : 'Yes, Undo'}
              </Button>
            </div>
          </div>
        ) : (
          <Button
            type="button"
            variant="outline"
            disabled={undoing || rallies.length === 0}
            onClick={() => setShowUndoConfirm(true)}
            className="w-full text-slate-700 hover:bg-slate-100 h-10 font-semibold"
            data-testid="undo-btn"
          >
            <RotateCcw className="w-4 h-4 mr-2 text-slate-500" />
            Undo Last Rally
          </Button>
        )}
      </div>

      {/* Recent Rallies History */}
      <Card className="p-4 bg-white border border-slate-200 shadow-sm">
        <h3 className="text-xs font-bold uppercase tracking-wider text-slate-500 mb-3 flex items-center justify-between">
          <span>Recent Rallies</span>
          <span className="text-[11px] font-normal text-slate-400">Latest first</span>
        </h3>

        {rallies.length === 0 ? (
          <p className="text-xs text-slate-400 text-center py-4">
            No rallies scored yet. Tap above to award the first point.
          </p>
        ) : (
          <div className="divide-y divide-slate-100 text-xs">
            {rallies.slice(0, 8).map((rally) => (
              <div key={rally.id} className="py-2 flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <span className="font-mono text-slate-400 w-6">#{rally.sequence_number}</span>
                  <span className={`font-bold px-1.5 py-0.5 rounded text-[11px] ${
                    rally.winner_side === 'SIDE_A' ? 'bg-emerald-100 text-emerald-800' : 'bg-blue-100 text-blue-800'
                  }`}>
                    {rally.winner_side === 'SIDE_A' ? sideAName : sideBName}
                  </span>
                  <span className="text-[11px] text-slate-400">({rally.rally_type})</span>
                </div>
                <div className="font-mono font-bold text-slate-800">
                  {rally.score_after_side_a} – {rally.score_after_side_b}
                </div>
              </div>
            ))}
          </div>
        )}
      </Card>
    </div>
  );
}
