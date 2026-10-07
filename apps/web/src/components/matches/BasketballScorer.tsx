'use client';

import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import Link from 'next/link';
import { createSupabaseBrowserClient } from '@/lib/supabase/browser';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Badge } from '@/components/ui/Badge';
import {
  ArrowLeft,
  Play,
  Pause,
  RotateCcw,
  Clock,
  AlertTriangle,
  Users,
  Timer,
  CheckCircle2,
  X,
  Loader2,
  Trophy,
  ChevronRight,
  Shield,
  Wifi,
  WifiOff,
  Flame,
} from 'lucide-react';

interface BasketballScorerProps {
  match: any;
}

export function BasketballScorer({ match }: BasketballScorerProps) {
  const supabase = createSupabaseBrowserClient();

  // Loading & Action states
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [actionLabel, setActionLabel] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);
  const [connectionStatus, setConnectionStatus] = useState<'connected' | 'reconnecting' | 'offline'>('connected');
  const [isScorer, setIsScorer] = useState(true);

  // Authoritative State from get_basketball_match_state
  const [matchState, setMatchState] = useState<any>(null);
  const [activePeriod, setActivePeriod] = useState<any>(null);
  const [periods, setPeriods] = useState<any[]>([]);
  const [lineupsSideA, setLineupsSideA] = useState<any[]>([]);
  const [lineupsSideB, setLineupsSideB] = useState<any[]>([]);
  const [timeoutsA, setTimeoutsA] = useState<number>(4);
  const [timeoutsB, setTimeoutsB] = useState<number>(4);
  const [recentEvents, setRecentEvents] = useState<any[]>([]);

  // Local UI Selections
  const [selectedTeam, setSelectedTeam] = useState<'SIDE_A' | 'SIDE_B'>('SIDE_A');
  const [selectedPlayerId, setSelectedPlayerId] = useState<string | null>(null);
  const [clockTick, setClockTick] = useState<number>(Date.now());

  // Modals
  const [showFoulModal, setShowFoulModal] = useState(false);
  const [foulTeam, setFoulTeam] = useState<'SIDE_A' | 'SIDE_B'>('SIDE_A');
  const [foulPlayerId, setFoulPlayerId] = useState<string | null>(null);
  const [foulType, setFoulType] = useState<string>('PERSONAL');

  const [showSubModal, setShowSubModal] = useState(false);
  const [subTeam, setSubTeam] = useState<'SIDE_A' | 'SIDE_B'>('SIDE_A');
  const [subOutPlayerId, setSubOutPlayerId] = useState<string | null>(null);
  const [subInPlayerId, setSubInPlayerId] = useState<string | null>(null);

  const [showTimeModal, setShowTimeModal] = useState(false);
  const [customMinutes, setCustomMinutes] = useState<number>(10);
  const [customSeconds, setCustomSeconds] = useState<number>(0);

  const [showUndoModal, setShowUndoModal] = useState(false);
  const [showProgressionModal, setShowProgressionModal] = useState(false);

  // Competitor Helpers
  const sideA = useMemo(() => match.competitors?.find((c: any) => c.side === 'SIDE_A'), [match.competitors]);
  const sideB = useMemo(() => match.competitors?.find((c: any) => c.side === 'SIDE_B'), [match.competitors]);
  const sideAName = sideA?.competitor_name || sideA?.team?.name || 'Team A';
  const sideBName = sideB?.competitor_name || sideB?.team?.name || 'Team B';

  // 1. Authoritative State Loader
  const loadAuthoritativeState = useCallback(async () => {
    try {
      setError(null);
      const { data: state, error: stateErr } = await supabase.rpc('get_basketball_match_state', {
        p_match_id: match.id,
      });

      if (stateErr) {
        throw new Error(stateErr.message);
      }

      if (state) {
        setMatchState({
          id: state.match_id,
          status: state.match_status,
          winner_side: state.winner_side,
          result_summary: state.result_summary,
          total_score_side_a: state.total_score_side_a,
          total_score_side_b: state.total_score_side_b,
        });

        setActivePeriod(state.active_period);
        setPeriods(state.periods || []);
        setLineupsSideA(state.lineups_side_a || []);
        setLineupsSideB(state.lineups_side_b || []);
        setTimeoutsA(state.timeouts_remaining_side_a ?? 4);
        setTimeoutsB(state.timeouts_remaining_side_b ?? 4);

        // Pre-select first on-court player if none selected
        if (!selectedPlayerId) {
          const firstOnCourt = (state.lineups_side_a || []).find((p: any) => p.is_on_court && !p.is_fouled_out);
          if (firstOnCourt) {
            setSelectedPlayerId(firstOnCourt.participant_id);
          }
        }
      }

      // Fetch recent 10 active events
      const { data: events } = await supabase
        .from('basketball_events')
        .select('*')
        .eq('match_id', match.id)
        .is('voided_at', null)
        .order('sequence_number', { ascending: false })
        .limit(10);

      setRecentEvents(events || []);
    } catch (err: any) {
      setError(mapRpcError(err.message || 'Failed to load basketball match state.'));
    } finally {
      setLoading(false);
    }
  }, [supabase, match.id, selectedPlayerId]);

  // Initial Load & Auth Check
  useEffect(() => {
    loadAuthoritativeState();

    // Verify user role
    supabase.auth.getUser().then(({ data: { user } }) => {
      if (!user) {
        setIsScorer(false);
      } else {
        // User is logged in; if they lack rights, RPC will return FORBIDDEN on mutation
        setIsScorer(true);
      }
    });
  }, [loadAuthoritativeState, supabase.auth]);

  // Realtime Subscriptions
  useEffect(() => {
    const channel = supabase
      .channel(`basketball_scorer:${match.id}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'matches', filter: `id=eq.${match.id}` }, () => {
        loadAuthoritativeState();
      })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'basketball_periods', filter: `match_id=eq.${match.id}` }, () => {
        loadAuthoritativeState();
      })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'basketball_events', filter: `match_id=eq.${match.id}` }, () => {
        loadAuthoritativeState();
      })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'basketball_lineups', filter: `match_id=eq.${match.id}` }, () => {
        loadAuthoritativeState();
      })
      .subscribe((status) => {
        if (status === 'SUBSCRIBED') {
          setConnectionStatus('connected');
        } else if (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT') {
          setConnectionStatus('reconnecting');
        } else if (status === 'CLOSED') {
          setConnectionStatus('offline');
        }
      });

    return () => {
      supabase.removeChannel(channel);
    };
  }, [supabase, match.id, loadAuthoritativeState]);

  // Live Clock Ticking Interval (purely local visual interpolation)
  useEffect(() => {
    if (!activePeriod || activePeriod.clock_status !== 'RUNNING') return;

    const interval = setInterval(() => {
      setClockTick(Date.now());
    }, 500);

    return () => clearInterval(interval);
  }, [activePeriod]);

  // 2. Computed Authoritative Clock
  const clockDisplay = useMemo(() => {
    if (!activePeriod) {
      return { seconds: 600, formatted: '10:00', isRunning: false, isExpired: false };
    }

    let rem = activePeriod.time_remaining_seconds ?? 600;
    const isRunning = activePeriod.clock_status === 'RUNNING';

    if (isRunning && activePeriod.clock_last_started_at) {
      const startedAt = new Date(activePeriod.clock_last_started_at).getTime();
      const elapsedSec = Math.floor(Math.max(0, clockTick - startedAt) / 1000);
      rem = Math.max(0, rem - elapsedSec);
    }

    const mins = Math.floor(rem / 60);
    const secs = rem % 60;
    const formatted = `${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;
    const isExpired = rem === 0 || activePeriod.clock_status === 'EXPIRED';

    return { seconds: rem, formatted, isRunning, isExpired };
  }, [activePeriod, clockTick]);

  // Error Message Mapper
  const mapRpcError = (msg: string) => {
    if (msg.includes('UNAUTHENTICATED')) return 'Please log in to score this match.';
    if (msg.includes('FORBIDDEN') || msg.includes('UNAUTHORIZED')) return 'You do not have permission to score this match.';
    if (msg.includes('INVALID_SPORT')) return 'This is not a Basketball match.';
    if (msg.includes('INVALID_MATCH_STATE')) return 'Match is not in an active scoring state.';
    if (msg.includes('CLOCK_ALREADY_RUNNING')) return 'Game clock is already running.';
    if (msg.includes('CLOCK_NOT_STOPPED')) return 'Clock must be paused before performing this dead-ball action.';
    if (msg.includes('CLOCK_EXPIRED')) return 'Clock has reached 0:00. Please progress to next period.';
    if (msg.includes('CLOCK_RUNNING')) return 'Game clock is still running. Please pause before completing.';
    if (msg.includes('PLAYER_NOT_ACTIVE')) return 'This player is currently on the bench.';
    if (msg.includes('PLAYER_FOULED_OUT')) return 'This player has fouled out and cannot play.';
    if (msg.includes('INVALID_SUBSTITUTION')) return 'Invalid substitution: exactly 5 active players must be on court.';
    if (msg.includes('TIMEOUT_EXHAUSTED')) return 'No timeouts remaining for this team.';
    if (msg.includes('INVALID_TIME')) return 'Target time exceeds allowable period duration.';
    if (msg.includes('NO_ACTIVE_EVENT')) return 'No active event to undo.';
    if (msg.includes('INVALID_UNDO')) return 'Only the most recent active event can be undone.';
    if (msg.includes('TIED_SCORE')) return 'Scores are tied. Progress to Overtime to continue.';
    return msg;
  };

  // Helper Toast Auto-Dismiss
  const showToast = (msg: string) => {
    setSuccessMsg(msg);
    setTimeout(() => setSuccessMsg(null), 3500);
  };

  // 3. Match Initialization
  const handleInitMatch = async () => {
    if (submitting) return;
    try {
      setSubmitting(true);
      setActionLabel('Initializing match...');
      setError(null);

      const { data, error: initErr } = await supabase.rpc('init_basketball_match', {
        p_match_id: match.id,
      });

      if (initErr) throw new Error(initErr.message);

      showToast('Match initialized! Q1 started.');
      await loadAuthoritativeState();
    } catch (err: any) {
      setError(mapRpcError(err.message || 'Failed to initialize match.'));
    } finally {
      setSubmitting(false);
      setActionLabel(null);
    }
  };

  // 4. Scoring Action
  const handleScore = async (scoringType: 'FREE_THROW_1PT' | 'FIELD_GOAL_2PT' | 'FIELD_GOAL_3PT') => {
    if (submitting || !activePeriod || !selectedPlayerId) return;

    try {
      setSubmitting(true);
      setActionLabel('Recording points...');
      setError(null);

      const clientEventId = crypto.randomUUID();
      const points = scoringType === 'FREE_THROW_1PT' ? 1 : scoringType === 'FIELD_GOAL_2PT' ? 2 : 3;

      const { data, error: rpcErr } = await supabase.rpc('record_basketball_score', {
        p_match_id: match.id,
        p_period_id: activePeriod.id,
        p_client_event_id: clientEventId,
        p_side: selectedTeam,
        p_participant_id: selectedPlayerId,
        p_scoring_type: scoringType,
      });

      if (rpcErr) throw new Error(rpcErr.message);

      showToast(`+${points} PT recorded!`);
      await loadAuthoritativeState();
    } catch (err: any) {
      setError(mapRpcError(err.message || 'Failed to record score.'));
    } finally {
      setSubmitting(false);
      setActionLabel(null);
    }
  };

  // 5. Clock Control Actions
  const handleToggleClock = async () => {
    if (submitting || !activePeriod) return;

    try {
      setSubmitting(true);
      setError(null);
      const action = clockDisplay.isRunning ? 'PAUSE' : 'START';
      setActionLabel(action === 'START' ? 'Starting clock...' : 'Pausing clock...');

      const { error: clockErr } = await supabase.rpc('update_basketball_clock', {
        p_match_id: match.id,
        p_period_id: activePeriod.id,
        p_action: action,
        p_client_event_id: crypto.randomUUID(),
      });

      if (clockErr) throw new Error(clockErr.message);

      showToast(action === 'START' ? 'Clock running ▶' : 'Clock paused ⏸');
      await loadAuthoritativeState();
    } catch (err: any) {
      setError(mapRpcError(err.message || 'Clock action failed.'));
    } finally {
      setSubmitting(false);
      setActionLabel(null);
    }
  };

  const handleSetTime = async () => {
    if (submitting || !activePeriod) return;

    try {
      setSubmitting(true);
      setError(null);
      setActionLabel('Setting time...');

      const totalSeconds = Math.max(0, customMinutes * 60 + customSeconds);

      const { error: timeErr } = await supabase.rpc('update_basketball_clock', {
        p_match_id: match.id,
        p_period_id: activePeriod.id,
        p_action: 'SET_TIME',
        p_seconds: totalSeconds,
        p_client_event_id: crypto.randomUUID(),
      });

      if (timeErr) throw new Error(timeErr.message);

      setShowTimeModal(false);
      showToast('Game clock reconciled successfully.');
      await loadAuthoritativeState();
    } catch (err: any) {
      setError(mapRpcError(err.message || 'Failed to adjust clock.'));
    } finally {
      setSubmitting(false);
      setActionLabel(null);
    }
  };

  // 6. Foul Action
  const handleRecordFoul = async () => {
    if (submitting || !activePeriod || !foulPlayerId) return;

    try {
      setSubmitting(true);
      setActionLabel('Recording foul...');
      setError(null);

      const { data, error: foulErr } = await supabase.rpc('record_basketball_foul', {
        p_match_id: match.id,
        p_period_id: activePeriod.id,
        p_client_event_id: crypto.randomUUID(),
        p_side: foulTeam,
        p_participant_id: foulPlayerId,
        p_foul_type: foulType,
      });

      if (foulErr) throw new Error(foulErr.message);

      setShowFoulModal(false);
      if (data?.is_fouled_out) {
        showToast('⚠️ Player has reached foul limit and FOULED OUT!');
      } else if (data?.is_bonus) {
        showToast('Foul recorded. Team is now in BONUS!');
      } else {
        showToast('Foul recorded.');
      }

      await loadAuthoritativeState();
    } catch (err: any) {
      setError(mapRpcError(err.message || 'Failed to record foul.'));
    } finally {
      setSubmitting(false);
      setActionLabel(null);
    }
  };

  // 7. Substitution Action
  const handleSubstitute = async () => {
    if (submitting || !activePeriod || !subOutPlayerId || !subInPlayerId) return;

    try {
      setSubmitting(true);
      setActionLabel('Substituting player...');
      setError(null);

      const { error: subErr } = await supabase.rpc('substitute_basketball_player', {
        p_match_id: match.id,
        p_period_id: activePeriod.id,
        p_client_event_id: crypto.randomUUID(),
        p_side: subTeam,
        p_outgoing_participant_id: subOutPlayerId,
        p_incoming_participant_id: subInPlayerId,
      });

      if (subErr) throw new Error(subErr.message);

      setShowSubModal(false);
      setSubOutPlayerId(null);
      setSubInPlayerId(null);
      showToast('Substitution complete.');
      await loadAuthoritativeState();
    } catch (err: any) {
      setError(mapRpcError(err.message || 'Substitution failed.'));
    } finally {
      setSubmitting(false);
      setActionLabel(null);
    }
  };

  // 8. Timeout Action
  const handleTimeout = async (side: 'SIDE_A' | 'SIDE_B') => {
    if (submitting || !activePeriod) return;

    try {
      setSubmitting(true);
      setActionLabel('Calling timeout...');
      setError(null);

      const { data, error: toErr } = await supabase.rpc('record_basketball_timeout', {
        p_match_id: match.id,
        p_period_id: activePeriod.id,
        p_client_event_id: crypto.randomUUID(),
        p_side: side,
      });

      if (toErr) throw new Error(toErr.message);

      showToast(`Timeout called for ${side === 'SIDE_A' ? sideAName : sideBName}.`);
      await loadAuthoritativeState();
    } catch (err: any) {
      setError(mapRpcError(err.message || 'Failed to call timeout.'));
    } finally {
      setSubmitting(false);
      setActionLabel(null);
    }
  };

  // 9. Undo Action
  const handleUndo = async () => {
    if (submitting || recentEvents.length === 0) return;

    try {
      setSubmitting(true);
      setActionLabel('Undoing latest action...');
      setError(null);

      const latestEvent = recentEvents[0];
      const { data, error: undoErr } = await supabase.rpc('undo_basketball_event', {
        p_match_id: match.id,
        p_event_id: latestEvent?.id,
      });

      if (undoErr) throw new Error(undoErr.message);

      setShowUndoModal(false);
      showToast(`Latest action (${latestEvent?.event_type}) undone.`);
      await loadAuthoritativeState();
    } catch (err: any) {
      setError(mapRpcError(err.message || 'Failed to undo action.'));
    } finally {
      setSubmitting(false);
      setActionLabel(null);
    }
  };

  // 10. Period Progression
  const handleProgressPeriod = async () => {
    if (submitting) return;

    try {
      setSubmitting(true);
      setActionLabel('Advancing period...');
      setError(null);

      const { data, error: progErr } = await supabase.rpc('progress_basketball_period', {
        p_match_id: match.id,
      });

      if (progErr) throw new Error(progErr.message);

      setShowProgressionModal(false);
      if (data?.status === 'match_completed') {
        showToast(`Match complete! Winner: ${data.winner_side === 'SIDE_A' ? sideAName : data.winner_side === 'SIDE_B' ? sideBName : 'DRAW'}`);
      } else if (data?.status === 'overtime_created') {
        showToast(`Scores tied! Overtime ${data.period_number - 4} started!`);
      } else {
        showToast(`Quarter Q${data.period_number} ready.`);
      }

      await loadAuthoritativeState();
    } catch (err: any) {
      setError(mapRpcError(err.message || 'Period advancement failed.'));
    } finally {
      setSubmitting(false);
      setActionLabel(null);
    }
  };

  // 11. Match Finalization
  const handleCompleteMatch = async () => {
    if (submitting) return;

    try {
      setSubmitting(true);
      setActionLabel('Finalizing match...');
      setError(null);

      const { data, error: compErr } = await supabase.rpc('complete_basketball_match', {
        p_match_id: match.id,
      });

      if (compErr) throw new Error(compErr.message);

      showToast('Match finalized authoritatively.');
      await loadAuthoritativeState();
    } catch (err: any) {
      setError(mapRpcError(err.message || 'Failed to finalize match.'));
    } finally {
      setSubmitting(false);
      setActionLabel(null);
    }
  };

  // Current on-court lineup for selected team
  const currentLineup = useMemo(() => {
    const list = selectedTeam === 'SIDE_A' ? lineupsSideA : lineupsSideB;
    return list.filter((p: any) => p.is_on_court);
  }, [selectedTeam, lineupsSideA, lineupsSideB]);

  // Selected player details
  const selectedPlayer = useMemo(() => {
    if (!selectedPlayerId) return null;
    const all = [...lineupsSideA, ...lineupsSideB];
    return all.find((p: any) => p.participant_id === selectedPlayerId);
  }, [selectedPlayerId, lineupsSideA, lineupsSideB]);

  // Bonus indicators
  const isSideABonus = (activePeriod?.side_a_fouls ?? 0) >= 5;
  const isSideBBonus = (activePeriod?.side_b_fouls ?? 0) >= 5;

  // Period label
  const periodLabel = useMemo(() => {
    if (!activePeriod) return 'Setup';
    if (activePeriod.period_type === 'OVERTIME') {
      return `OT${activePeriod.period_number - 4}`;
    }
    return `Q${activePeriod.period_number}`;
  }, [activePeriod]);

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] text-slate-400">
        <Loader2 className="w-10 h-10 animate-spin mb-4 text-orange-500" />
        <p className="font-semibold text-lg">Connecting to Basketball Court-Side Scorer...</p>
      </div>
    );
  }

  // If match has not been initialized yet
  if (!activePeriod && matchState?.status !== 'COMPLETED') {
    return (
      <div className="max-w-2xl mx-auto space-y-6 py-8 px-4">
        <div className="flex items-center justify-between">
          <Link
            href={`/matches/${match.id}`}
            className="inline-flex items-center text-sm font-medium text-slate-400 hover:text-white transition-colors"
          >
            <ArrowLeft className="w-4 h-4 mr-1.5" /> Back to Match
          </Link>
          <span className="px-3 py-1 rounded-full text-xs font-semibold bg-orange-950 text-orange-400 border border-orange-800">
            5v5 Basketball
          </span>
        </div>

        <Card className="bg-slate-900 border-slate-800 text-white p-6 shadow-xl">
          <div className="flex items-center gap-3 mb-6">
            <Trophy className="w-8 h-8 text-orange-400" />
            <div>
              <h1 className="text-2xl font-bold">Ready to Start Match</h1>
              <p className="text-slate-400 text-sm">{match.title || `${sideAName} vs ${sideBName}`}</p>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4 mb-8 p-4 rounded-xl bg-slate-950 border border-slate-800">
            <div>
              <h3 className="font-bold text-orange-400 mb-1">{sideAName}</h3>
              <p className="text-xs text-slate-400">{sideA?.participants?.length || 0} rostered players</p>
            </div>
            <div>
              <h3 className="font-bold text-sky-400 mb-1">{sideBName}</h3>
              <p className="text-xs text-slate-400">{sideB?.participants?.length || 0} rostered players</p>
            </div>
          </div>

          <div className="space-y-4">
            <p className="text-sm text-slate-300">
              Initializing the match will configure <strong>Q1 (10:00)</strong>, place the starting 5 on court for each team, and arm the server-authoritative game clock.
            </p>

            <Button
              onClick={handleInitMatch}
              disabled={submitting || !isScorer}
              data-testid="init-match-btn"
              className="w-full bg-orange-600 hover:bg-orange-500 text-white font-bold py-4 text-base h-auto shadow-lg shadow-orange-600/30"
            >
              {submitting ? (
                <span className="flex items-center justify-center gap-2">
                  <Loader2 className="w-5 h-5 animate-spin" /> Initializing...
                </span>
              ) : (
                'INITIALIZE MATCH & START Q1'
              )}
            </Button>

            {!isScorer && (
              <p className="text-xs text-rose-400 text-center">
                * You are in Spectator Mode. Only authorized scorers can initialize play.
              </p>
            )}
          </div>
        </Card>
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto space-y-4 pb-16 px-2 sm:px-4 text-slate-100 select-none">
      {/* Toast Notification Banner */}
      {successMsg && (
        <div className="fixed top-4 left-1/2 -translate-x-1/2 z-50 bg-emerald-600 text-white px-5 py-3 rounded-full shadow-2xl flex items-center gap-2 text-sm font-bold animate-in fade-in slide-in-from-top-4">
          <CheckCircle2 className="w-5 h-5" />
          <span>{successMsg}</span>
        </div>
      )}

      {/* Error Alert Banner */}
      {error && (
        <div className="bg-rose-950 border border-rose-800 text-rose-200 px-4 py-3 rounded-xl flex items-center justify-between text-sm shadow-lg">
          <div className="flex items-center gap-2">
            <AlertTriangle className="w-5 h-5 text-rose-400 shrink-0" />
            <span>{error}</span>
          </div>
          <button onClick={() => setError(null)} className="p-1 text-rose-400 hover:text-white">
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* 1. TOP BAR */}
      <div className="flex items-center justify-between py-2 border-b border-slate-800">
        <Link
          href={`/matches/${match.id}`}
          className="inline-flex items-center text-xs sm:text-sm font-medium text-slate-400 hover:text-white transition-colors"
        >
          <ArrowLeft className="w-4 h-4 mr-1.5" /> Match Details
        </Link>

        <div className="flex items-center gap-2 sm:gap-3">
          {/* Connection Pill */}
          <div
            data-testid="connection-status"
            className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold ${
              connectionStatus === 'connected'
                ? 'bg-emerald-950/80 text-emerald-400 border border-emerald-800'
                : connectionStatus === 'reconnecting'
                ? 'bg-amber-950/80 text-amber-400 border border-amber-800 animate-pulse'
                : 'bg-rose-950/80 text-rose-400 border border-rose-800'
            }`}
          >
            {connectionStatus === 'connected' ? (
              <Wifi className="w-3.5 h-3.5" />
            ) : (
              <WifiOff className="w-3.5 h-3.5" />
            )}
            <span className="capitalize">{connectionStatus}</span>
          </div>

          {/* Mode Pill */}
          <span
            className={`px-2.5 py-1 rounded-full text-xs font-bold border ${
              isScorer
                ? 'bg-orange-950/80 text-orange-400 border-orange-800'
                : 'bg-slate-800 text-slate-300 border-slate-700'
            }`}
          >
            {isScorer ? 'Scorer Mode' : 'Spectator (Read-Only)'}
          </span>
        </div>
      </div>

      {/* 2. GAME CLOCK & PERIOD BANNER */}
      <Card className="bg-slate-900 border-slate-800 p-4 shadow-xl">
        <div className="flex flex-col sm:flex-row items-center justify-between gap-4">
          {/* Period Badge & Status */}
          <div className="flex items-center gap-3">
            <div
              data-testid="period-badge"
              className="bg-orange-600 text-white font-black px-4 py-2 rounded-xl text-xl tracking-wide shadow-md"
            >
              {matchState?.status === 'COMPLETED' ? 'FINAL' : periodLabel}
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="text-xs font-bold text-slate-400 uppercase tracking-wider">
                  {matchState?.status === 'COMPLETED'
                    ? 'Match Finished'
                    : activePeriod?.period_type === 'OVERTIME'
                    ? 'Overtime Period'
                    : 'Regulation Period'}
                </span>
                <span
                  className={`w-2 h-2 rounded-full ${
                    clockDisplay.isRunning
                      ? 'bg-emerald-500 animate-ping'
                      : clockDisplay.isExpired
                      ? 'bg-rose-500'
                      : 'bg-amber-500'
                  }`}
                />
              </div>
              <p className="text-xs text-slate-400">
                {clockDisplay.isRunning ? 'Clock Running' : clockDisplay.isExpired ? 'Time Expired' : 'Clock Stopped'}
              </p>
            </div>
          </div>

          {/* Clock Digits */}
          <div className="flex items-center gap-4">
            <div
              data-testid="game-clock"
              className={`text-5xl sm:text-6xl font-black font-mono tracking-widest px-4 py-1.5 rounded-2xl border ${
                clockDisplay.isRunning
                  ? 'bg-emerald-950/40 text-emerald-400 border-emerald-800 shadow-inner'
                  : clockDisplay.isExpired
                  ? 'bg-rose-950/40 text-rose-400 border-rose-800'
                  : 'bg-slate-950 text-white border-slate-800'
              }`}
            >
              {clockDisplay.formatted}
            </div>

            {/* Quick Set Time Button */}
            {isScorer && matchState?.status !== 'COMPLETED' && (
              <button
                onClick={() => {
                  setCustomMinutes(Math.floor(clockDisplay.seconds / 60));
                  setCustomSeconds(clockDisplay.seconds % 60);
                  setShowTimeModal(true);
                }}
                data-testid="btn-set-time"
                title="Adjust Clock Time"
                className="p-3 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white transition-colors"
              >
                <Clock className="w-5 h-5" />
              </button>
            )}
          </div>

          {/* Primary Clock Start/Pause Control */}
          {isScorer && matchState?.status !== 'COMPLETED' && (
            <div className="flex items-center gap-2 w-full sm:w-auto">
              {clockDisplay.isExpired ? (
                <Button
                  onClick={() => setShowProgressionModal(true)}
                  disabled={submitting}
                  data-testid="btn-next-period"
                  className="w-full sm:w-auto bg-orange-600 hover:bg-orange-500 text-white font-bold h-12 px-6 rounded-xl text-sm"
                >
                  NEXT PERIOD <ChevronRight className="w-4 h-4 ml-1" />
                </Button>
              ) : (
                <Button
                  onClick={handleToggleClock}
                  disabled={submitting}
                  data-testid="btn-clock-toggle"
                  className={`w-full sm:w-auto h-12 px-6 rounded-xl font-black text-sm flex items-center justify-center gap-2 shadow-lg transition-transform active:scale-95 ${
                    clockDisplay.isRunning
                      ? 'bg-amber-600 hover:bg-amber-500 text-white shadow-amber-600/30'
                      : 'bg-emerald-600 hover:bg-emerald-500 text-white shadow-emerald-600/30'
                  }`}
                >
                  {clockDisplay.isRunning ? (
                    <>
                      <Pause className="w-5 h-5 fill-current" /> PAUSE CLOCK
                    </>
                  ) : (
                    <>
                      <Play className="w-5 h-5 fill-current" /> START CLOCK
                    </>
                  )}
                </Button>
              )}
            </div>
          )}
        </div>
      </Card>

      {/* 3. SCOREBOARD */}
      <Card data-testid="scoreboard" className="bg-slate-900 border-slate-800 p-6 shadow-2xl">
        <div className="grid grid-cols-2 gap-4 sm:gap-8 items-center relative">
          <div className="absolute left-1/2 -translate-x-1/2 top-1/2 -translate-y-1/2 hidden sm:flex flex-col items-center justify-center text-slate-500 text-xs font-black">
            <span>VS</span>
          </div>

          {/* SIDE A */}
          <div
            onClick={() => setSelectedTeam('SIDE_A')}
            data-testid="card-side-a"
            className={`p-4 rounded-2xl cursor-pointer transition-all border ${
              selectedTeam === 'SIDE_A'
                ? 'bg-orange-950/40 border-orange-500/80 shadow-lg shadow-orange-950/50'
                : 'bg-slate-950/60 border-slate-800 hover:border-slate-700'
            }`}
          >
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs font-bold uppercase tracking-wider text-orange-400">HOME</span>
              {isSideABonus && (
                <span data-testid="bonus-side-a" className="px-2 py-0.5 rounded-full text-[10px] font-black bg-rose-600 text-white animate-pulse">
                  BONUS
                </span>
              )}
            </div>

            <h2 className="text-lg sm:text-xl font-bold truncate text-white mb-2">{sideAName}</h2>

            <div data-testid="score-side-a" className="text-5xl sm:text-7xl font-black text-white font-mono tracking-tight">
              {matchState?.total_score_side_a ?? 0}
            </div>

            <div className="mt-3 flex items-center justify-between text-xs text-slate-400 border-t border-slate-800/80 pt-2">
              <span>Team Fouls: <strong data-testid="team-fouls-side-a" className="text-white">{activePeriod?.side_a_fouls ?? 0}/5</strong></span>
              <span>Timeouts: <strong data-testid="timeouts-side-a" className="text-white">{timeoutsA}</strong></span>
            </div>
          </div>

          {/* SIDE B */}
          <div
            onClick={() => setSelectedTeam('SIDE_B')}
            data-testid="card-side-b"
            className={`p-4 rounded-2xl cursor-pointer transition-all border ${
              selectedTeam === 'SIDE_B'
                ? 'bg-sky-950/40 border-sky-500/80 shadow-lg shadow-sky-950/50'
                : 'bg-slate-950/60 border-slate-800 hover:border-slate-700'
            }`}
          >
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs font-bold uppercase tracking-wider text-sky-400">AWAY</span>
              {isSideBBonus && (
                <span data-testid="bonus-side-b" className="px-2 py-0.5 rounded-full text-[10px] font-black bg-rose-600 text-white animate-pulse">
                  BONUS
                </span>
              )}
            </div>

            <h2 className="text-lg sm:text-xl font-bold truncate text-white mb-2">{sideBName}</h2>

            <div data-testid="score-side-b" className="text-5xl sm:text-7xl font-black text-white font-mono tracking-tight">
              {matchState?.total_score_side_b ?? 0}
            </div>

            <div className="mt-3 flex items-center justify-between text-xs text-slate-400 border-t border-slate-800/80 pt-2">
              <span>Team Fouls: <strong data-testid="team-fouls-side-b" className="text-white">{activePeriod?.side_b_fouls ?? 0}/5</strong></span>
              <span>Timeouts: <strong data-testid="timeouts-side-b" className="text-white">{timeoutsB}</strong></span>
            </div>
          </div>
        </div>

        {/* Quarter Breakdown */}
        {periods.length > 0 && (
          <div className="mt-6 pt-4 border-t border-slate-800 overflow-x-auto">
            <table className="w-full text-xs text-center font-mono">
              <thead>
                <tr className="text-slate-400 border-b border-slate-800/60">
                  <th className="text-left py-1 px-2 font-sans">Quarter</th>
                  {periods.map((p) => (
                    <th key={p.id} className="py-1 px-2">
                      {p.period_type === 'OVERTIME' ? `OT${p.period_number - 4}` : `Q${p.period_number}`}
                    </th>
                  ))}
                  <th className="py-1 px-2 font-bold text-white">TOT</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/40 text-slate-300">
                <tr>
                  <td className="text-left py-1.5 px-2 font-sans font-bold text-orange-400 truncate max-w-[100px]">{sideAName}</td>
                  {periods.map((p) => (
                    <td key={p.id} className="py-1.5 px-2">{p.side_a_score}</td>
                  ))}
                  <td className="py-1.5 px-2 font-black text-white">{matchState?.total_score_side_a ?? 0}</td>
                </tr>
                <tr>
                  <td className="text-left py-1.5 px-2 font-sans font-bold text-sky-400 truncate max-w-[100px]">{sideBName}</td>
                  {periods.map((p) => (
                    <td key={p.id} className="py-1.5 px-2">{p.side_b_score}</td>
                  ))}
                  <td className="py-1.5 px-2 font-black text-white">{matchState?.total_score_side_b ?? 0}</td>
                </tr>
              </tbody>
            </table>
          </div>
        )}
      </Card>

      {/* MATCH COMPLETED TERMINAL BANNER */}
      {matchState?.status === 'COMPLETED' && (
        <Card className="bg-emerald-950/60 border-emerald-800 p-6 text-center text-white shadow-2xl">
          <Trophy className="w-12 h-12 text-amber-400 mx-auto mb-2" />
          <h2 className="text-2xl font-black mb-1">
            {matchState.winner_side === 'SIDE_A'
              ? `${sideAName} Wins!`
              : matchState.winner_side === 'SIDE_B'
              ? `${sideBName} Wins!`
              : 'Match Ended in a DRAW!'}
          </h2>
          <p className="text-slate-300 text-sm font-mono">{matchState.result_summary}</p>
          <p className="text-xs text-slate-400 mt-4">Gameplay mutations are authoritatively locked.</p>
        </Card>
      )}

      {/* 4. ACTIVE LINEUP PLAYER SELECTOR (Court-Side 5v5) */}
      {matchState?.status !== 'COMPLETED' && (
        <Card className="bg-slate-900 border-slate-800 p-4 shadow-xl">
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2">
              <Users className="w-4 h-4 text-orange-400" />
              <h3 className="text-sm font-bold uppercase tracking-wider text-slate-300">
                Active 5 on Court ({selectedTeam === 'SIDE_A' ? sideAName : sideBName})
              </h3>
            </div>
            <div className="flex gap-1 bg-slate-950 p-1 rounded-lg border border-slate-800">
              <button
                onClick={() => setSelectedTeam('SIDE_A')}
                data-testid="tab-side-a"
                className={`px-3 py-1 text-xs font-bold rounded-md transition-colors ${
                  selectedTeam === 'SIDE_A' ? 'bg-orange-600 text-white' : 'text-slate-400 hover:text-white'
                }`}
              >
                Side A
              </button>
              <button
                onClick={() => setSelectedTeam('SIDE_B')}
                data-testid="tab-side-b"
                className={`px-3 py-1 text-xs font-bold rounded-md transition-colors ${
                  selectedTeam === 'SIDE_B' ? 'bg-sky-600 text-white' : 'text-slate-400 hover:text-white'
                }`}
              >
                Side B
              </button>
            </div>
          </div>

          {/* 5 Player Cards */}
          <div className="grid grid-cols-2 sm:grid-cols-5 gap-2 sm:gap-3">
            {currentLineup.map((player) => {
              const isSelected = selectedPlayerId === player.participant_id;
              const isFouledOut = player.is_fouled_out;

              return (
                <button
                  key={player.participant_id}
                  disabled={isFouledOut || !isScorer}
                  onClick={() => setSelectedPlayerId(player.participant_id)}
                  data-testid={`player-card-${player.participant_id}`}
                  className={`p-3 rounded-xl border text-left flex flex-col justify-between transition-all min-h-[76px] ${
                    isFouledOut
                      ? 'bg-rose-950/30 border-rose-900/60 opacity-60 cursor-not-allowed'
                      : isSelected
                      ? 'bg-orange-950/60 border-orange-500 ring-2 ring-orange-500 shadow-md shadow-orange-950/50'
                      : 'bg-slate-950/80 border-slate-800 hover:border-slate-700'
                  }`}
                >
                  <div className="flex items-center justify-between mb-1">
                    <span className="font-mono font-black text-lg text-white">
                      #{player.jersey_number ?? '-'}
                    </span>
                    {isFouledOut ? (
                      <span className="text-[10px] font-black bg-rose-600 text-white px-1.5 py-0.5 rounded">
                        OUT
                      </span>
                    ) : (
                      <span className="text-xs font-bold text-slate-400">{player.points ?? 0} PTS</span>
                    )}
                  </div>
                  <p className="text-xs font-bold truncate text-slate-200">{player.display_name}</p>
                  <span className={`text-[10px] font-semibold mt-1 ${player.fouls >= 4 ? 'text-rose-400 font-bold' : 'text-slate-400'}`}>
                    PF: {player.fouls ?? 0}/5
                  </span>
                </button>
              );
            })}
          </div>
        </Card>
      )}

      {/* 5. PRIMARY SCORING BUTTONS (+1 FT, +2 FG, +3 3PT) */}
      {isScorer && matchState?.status !== 'COMPLETED' && (
        <Card className="bg-slate-900 border-slate-800 p-5 shadow-2xl">
          <div className="flex items-center justify-between mb-3">
            <span className="text-xs font-bold text-slate-400 uppercase tracking-wider">
              {selectedPlayer ? (
                <>
                  Record Score for:{' '}
                  <strong className="text-orange-400 font-bold">
                    #{selectedPlayer.jersey_number} {selectedPlayer.display_name}
                  </strong>{' '}
                  ({selectedTeam === 'SIDE_A' ? sideAName : sideBName})
                </>
              ) : (
                'Select an on-court player above to score'
              )}
            </span>
            {submitting && (
              <span className="text-xs text-orange-400 font-bold flex items-center gap-1">
                <Loader2 className="w-3.5 h-3.5 animate-spin" /> {actionLabel || 'Processing...'}
              </span>
            )}
          </div>

          <div className="grid grid-cols-3 gap-3 sm:gap-4">
            <button
              onClick={() => handleScore('FREE_THROW_1PT')}
              disabled={submitting || !selectedPlayerId}
              data-testid="btn-score-1pt"
              className="h-16 sm:h-20 rounded-2xl bg-slate-800 hover:bg-slate-700 active:bg-slate-600 disabled:opacity-40 disabled:cursor-not-allowed border border-slate-700 flex flex-col items-center justify-center transition-all shadow-md active:scale-95 text-white"
            >
              <span className="text-2xl sm:text-3xl font-black font-mono">+1</span>
              <span className="text-[10px] sm:text-xs font-bold text-slate-300">FREE THROW</span>
            </button>

            <button
              onClick={() => handleScore('FIELD_GOAL_2PT')}
              disabled={submitting || !selectedPlayerId}
              data-testid="btn-score-2pt"
              className="h-16 sm:h-20 rounded-2xl bg-orange-600 hover:bg-orange-500 active:bg-orange-700 disabled:opacity-40 disabled:cursor-not-allowed flex flex-col items-center justify-center transition-all shadow-lg shadow-orange-600/30 active:scale-95 text-white"
            >
              <span className="text-2xl sm:text-3xl font-black font-mono">+2</span>
              <span className="text-[10px] sm:text-xs font-black tracking-wide">FIELD GOAL</span>
            </button>

            <button
              onClick={() => handleScore('FIELD_GOAL_3PT')}
              disabled={submitting || !selectedPlayerId}
              data-testid="btn-score-3pt"
              className="h-16 sm:h-20 rounded-2xl bg-sky-600 hover:bg-sky-500 active:bg-sky-700 disabled:opacity-40 disabled:cursor-not-allowed flex flex-col items-center justify-center transition-all shadow-lg shadow-sky-600/30 active:scale-95 text-white"
            >
              <span className="text-2xl sm:text-3xl font-black font-mono">+3</span>
              <span className="text-[10px] sm:text-xs font-black tracking-wide">3-POINTER</span>
            </button>
          </div>
        </Card>
      )}

      {/* 6. COURT-SIDE ACTION TOOLBAR (Foul, Sub, Timeout, Undo) */}
      {isScorer && matchState?.status !== 'COMPLETED' && (
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
          {/* Foul Button */}
          <button
            onClick={() => {
              setFoulTeam(selectedTeam);
              const activePlayers = (selectedTeam === 'SIDE_A' ? lineupsSideA : lineupsSideB).filter((p: any) => p.is_on_court && !p.is_fouled_out);
              setFoulPlayerId(selectedPlayerId || activePlayers[0]?.participant_id || null);
              setShowFoulModal(true);
            }}
            disabled={submitting}
            data-testid="btn-record-foul"
            className="h-13 py-3 px-4 rounded-xl bg-slate-800 hover:bg-slate-700 border border-slate-700 flex items-center justify-center gap-2 font-bold text-sm text-amber-400 transition-all active:scale-95"
          >
            <AlertTriangle className="w-4 h-4" /> FOUL
          </button>

          {/* Substitution Button */}
          <button
            onClick={() => {
              setSubTeam(selectedTeam);
              setShowSubModal(true);
            }}
            disabled={submitting}
            data-testid="btn-substitute"
            className="h-13 py-3 px-4 rounded-xl bg-slate-800 hover:bg-slate-700 border border-slate-700 flex items-center justify-center gap-2 font-bold text-sm text-sky-400 transition-all active:scale-95"
          >
            <Users className="w-4 h-4" /> SUBSTITUTE
          </button>

          {/* Timeout Button */}
          <button
            onClick={() => handleTimeout(selectedTeam)}
            disabled={submitting || (selectedTeam === 'SIDE_A' ? timeoutsA <= 0 : timeoutsB <= 0)}
            data-testid="btn-timeout"
            className="h-13 py-3 px-4 rounded-xl bg-slate-800 hover:bg-slate-700 border border-slate-700 flex items-center justify-center gap-2 font-bold text-sm text-purple-400 disabled:opacity-40 active:scale-95"
          >
            <Timer className="w-4 h-4" /> TIMEOUT ({selectedTeam === 'SIDE_A' ? timeoutsA : timeoutsB})
          </button>

          {/* Undo Button */}
          <button
            onClick={() => setShowUndoModal(true)}
            disabled={submitting || recentEvents.length === 0}
            data-testid="btn-undo"
            className="h-13 py-3 px-4 rounded-xl bg-slate-800 hover:bg-slate-700 border border-slate-700 flex items-center justify-center gap-2 font-bold text-sm text-rose-400 disabled:opacity-40 active:scale-95"
          >
            <RotateCcw className="w-4 h-4" /> UNDO LAST
          </button>
        </div>
      )}

      {/* 7. PERIOD CONTROL & MATCH COMPLETION */}
      {isScorer && matchState?.status !== 'COMPLETED' && (
        <Card className="bg-slate-900 border-slate-800 p-4">
          <div className="flex flex-col sm:flex-row items-center justify-between gap-3">
            <div>
              <h4 className="font-bold text-sm text-white">Period Operations</h4>
              <p className="text-xs text-slate-400">
                Advance quarters, initiate overtime during tie, or finalize match result.
              </p>
            </div>

            <div className="flex items-center gap-2 w-full sm:w-auto">
              <Button
                variant="outline"
                size="sm"
                onClick={() => setShowProgressionModal(true)}
                disabled={submitting}
                className="w-full sm:w-auto border-slate-700 bg-slate-800 text-slate-200 hover:bg-slate-700"
              >
                Progress Period ({periodLabel})
              </Button>

              <Button
                variant="outline"
                size="sm"
                onClick={handleCompleteMatch}
                disabled={submitting || clockDisplay.isRunning}
                className="w-full sm:w-auto border-rose-900 bg-rose-950/40 text-rose-300 hover:bg-rose-900"
              >
                End & Complete Match
              </Button>
            </div>
          </div>
        </Card>
      )}

      {/* 8. PLAY-BY-PLAY EVENT FEED */}
      <Card className="bg-slate-900 border-slate-800 p-4">
        <h4 className="font-bold text-sm text-white mb-3 flex items-center gap-2">
          <Flame className="w-4 h-4 text-orange-400" /> Recent Play-by-Play
        </h4>

        {recentEvents.length === 0 ? (
          <p className="text-xs text-slate-500 py-3 text-center">No gameplay events recorded yet.</p>
        ) : (
          <div className="space-y-2">
            {recentEvents.map((ev) => {
              const mins = Math.floor(ev.game_clock_seconds / 60);
              const secs = ev.game_clock_seconds % 60;
              const timeStr = `${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;
              const teamName = ev.side === 'SIDE_A' ? sideAName : sideBName;

              return (
                <div
                  key={ev.id}
                  className="p-2.5 rounded-xl bg-slate-950/80 border border-slate-800/80 flex items-center justify-between text-xs"
                >
                  <div className="flex items-center gap-3">
                    <span className="font-mono text-slate-500">{timeStr}</span>
                    <span
                      className={`font-bold px-2 py-0.5 rounded text-[10px] ${
                        ev.event_type === 'SCORE'
                          ? 'bg-orange-950 text-orange-400 border border-orange-800'
                          : ev.event_type === 'FOUL'
                          ? 'bg-amber-950 text-amber-400 border border-amber-800'
                          : ev.event_type === 'TIMEOUT'
                          ? 'bg-purple-950 text-purple-400 border border-purple-800'
                          : 'bg-slate-800 text-slate-300'
                      }`}
                    >
                      {ev.event_type}
                    </span>
                    <span className="text-slate-200">
                      {ev.event_type === 'SCORE' && `+${ev.points} PTS (${ev.scoring_type}) for ${teamName}`}
                      {ev.event_type === 'FOUL' && `${ev.foul_type} Foul committed by ${teamName}`}
                      {ev.event_type === 'TIMEOUT' && `Timeout called by ${teamName}`}
                      {ev.event_type === 'SUBSTITUTION' && `Player substitution for ${teamName}`}
                      {ev.event_type === 'CLOCK' && `Clock adjustment`}
                    </span>
                  </div>
                  <span className="text-[10px] font-mono text-slate-500">#{ev.sequence_number}</span>
                </div>
              );
            })}
          </div>
        )}
      </Card>

      {/* ===================== MODALS ===================== */}

      {/* A. FOUL MODAL */}
      {showFoulModal && (
        <div className="fixed inset-0 z-50 bg-black/80 flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-800 text-white rounded-2xl max-w-md w-full p-6 shadow-2xl space-y-4">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <h3 className="font-bold text-lg flex items-center gap-2 text-amber-400">
                <AlertTriangle className="w-5 h-5" /> Record Foul
              </h3>
              <button onClick={() => setShowFoulModal(false)} data-testid="modal-close-foul" className="text-slate-400 hover:text-white">
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Team Picker */}
            <div className="grid grid-cols-2 gap-2">
              <button
                onClick={() => {
                  setFoulTeam('SIDE_A');
                  const active = lineupsSideA.filter((p: any) => p.is_on_court && !p.is_fouled_out);
                  setFoulPlayerId(active[0]?.participant_id || null);
                }}
                className={`py-2 rounded-xl text-xs font-bold border transition-colors ${
                  foulTeam === 'SIDE_A' ? 'bg-orange-600 text-white border-orange-500' : 'bg-slate-950 border-slate-800 text-slate-400'
                }`}
              >
                {sideAName}
              </button>
              <button
                onClick={() => {
                  setFoulTeam('SIDE_B');
                  const active = lineupsSideB.filter((p: any) => p.is_on_court && !p.is_fouled_out);
                  setFoulPlayerId(active[0]?.participant_id || null);
                }}
                className={`py-2 rounded-xl text-xs font-bold border transition-colors ${
                  foulTeam === 'SIDE_B' ? 'bg-sky-600 text-white border-sky-500' : 'bg-slate-950 border-slate-800 text-slate-400'
                }`}
              >
                {sideBName}
              </button>
            </div>

            {/* Player Selection */}
            <div>
              <label className="text-xs font-bold text-slate-400 block mb-2">Select Player:</label>
              <div className="grid grid-cols-1 gap-2 max-h-40 overflow-y-auto pr-1">
                {(foulTeam === 'SIDE_A' ? lineupsSideA : lineupsSideB)
                  .filter((p: any) => p.is_on_court && !p.is_fouled_out)
                  .map((p: any) => (
                    <button
                      key={p.participant_id}
                      onClick={() => setFoulPlayerId(p.participant_id)}
                      className={`p-2.5 rounded-xl border text-left flex items-center justify-between text-xs transition-colors ${
                        foulPlayerId === p.participant_id
                          ? 'bg-amber-950 border-amber-500 text-white'
                          : 'bg-slate-950 border-slate-800 text-slate-300 hover:border-slate-700'
                      }`}
                    >
                      <span>#{p.jersey_number} {p.display_name}</span>
                      <span className={p.fouls >= 4 ? 'text-rose-400 font-bold' : 'text-slate-400'}>
                        {p.fouls}/5 Fouls {p.fouls >= 4 && '⚠️ FOUL OUT RISK'}
                      </span>
                    </button>
                  ))}
              </div>
            </div>

            {/* Foul Type */}
            <div>
              <label className="text-xs font-bold text-slate-400 block mb-2">Foul Type:</label>
              <div className="grid grid-cols-2 gap-2">
                {['PERSONAL', 'TECHNICAL', 'FLAGRANT', 'OFFENSIVE'].map((type) => (
                  <button
                    key={type}
                    onClick={() => setFoulType(type)}
                    className={`py-2 px-3 rounded-xl text-xs font-bold border transition-colors ${
                      foulType === type
                        ? 'bg-amber-600 text-white border-amber-500'
                        : 'bg-slate-950 border-slate-800 text-slate-400 hover:border-slate-700'
                    }`}
                  >
                    {type}
                  </button>
                ))}
              </div>
            </div>

            <Button
              onClick={handleRecordFoul}
              disabled={submitting || !foulPlayerId}
              data-testid="modal-confirm-foul"
              className="w-full bg-amber-600 hover:bg-amber-500 text-white font-bold py-3 text-sm h-auto"
            >
              CONFIRM FOUL
            </Button>
          </div>
        </div>
      )}

      {/* B. SUBSTITUTION MODAL */}
      {showSubModal && (
        <div className="fixed inset-0 z-50 bg-black/80 flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-800 text-white rounded-2xl max-w-lg w-full p-6 shadow-2xl space-y-4">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <h3 className="font-bold text-lg flex items-center gap-2 text-sky-400">
                <Users className="w-5 h-5" /> Dead-Ball Substitution
              </h3>
              <button onClick={() => setShowSubModal(false)} data-testid="modal-close-sub" className="text-slate-400 hover:text-white">
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Team Picker */}
            <div className="grid grid-cols-2 gap-2">
              <button
                onClick={() => setSubTeam('SIDE_A')}
                className={`py-2 rounded-xl text-xs font-bold border transition-colors ${
                  subTeam === 'SIDE_A' ? 'bg-orange-600 text-white border-orange-500' : 'bg-slate-950 border-slate-800 text-slate-400'
                }`}
              >
                {sideAName}
              </button>
              <button
                onClick={() => setSubTeam('SIDE_B')}
                className={`py-2 rounded-xl text-xs font-bold border transition-colors ${
                  subTeam === 'SIDE_B' ? 'bg-sky-600 text-white border-sky-500' : 'bg-slate-950 border-slate-800 text-slate-400'
                }`}
              >
                {sideBName}
              </button>
            </div>

            {clockDisplay.isRunning && (
              <p className="text-xs text-rose-400 bg-rose-950/60 p-2 rounded-lg border border-rose-900">
                ⚠️ Game clock is RUNNING. Substitutions require the clock to be STOPPED.
              </p>
            )}

            <div className="grid grid-cols-2 gap-4">
              {/* Outgoing (Active) */}
              <div>
                <label className="text-xs font-bold text-rose-400 block mb-2">1. OUT (On Court):</label>
                <div className="space-y-1.5 max-h-48 overflow-y-auto pr-1">
                  {(subTeam === 'SIDE_A' ? lineupsSideA : lineupsSideB)
                    .filter((p: any) => p.is_on_court)
                    .map((p: any) => (
                      <button
                        key={p.participant_id}
                        onClick={() => setSubOutPlayerId(p.participant_id)}
                        className={`w-full p-2 rounded-lg border text-left text-xs transition-colors ${
                          subOutPlayerId === p.participant_id
                            ? 'bg-rose-950 border-rose-500 text-white'
                            : 'bg-slate-950 border-slate-800 text-slate-300'
                        }`}
                      >
                        #{p.jersey_number} {p.display_name}
                      </button>
                    ))}
                </div>
              </div>

              {/* Incoming (Bench) */}
              <div>
                <label className="text-xs font-bold text-emerald-400 block mb-2">2. IN (Bench):</label>
                <div className="space-y-1.5 max-h-48 overflow-y-auto pr-1">
                  {(subTeam === 'SIDE_A' ? lineupsSideA : lineupsSideB)
                    .filter((p: any) => !p.is_on_court && !p.is_fouled_out)
                    .map((p: any) => (
                      <button
                        key={p.participant_id}
                        onClick={() => setSubInPlayerId(p.participant_id)}
                        className={`w-full p-2 rounded-lg border text-left text-xs transition-colors ${
                          subInPlayerId === p.participant_id
                            ? 'bg-emerald-950 border-emerald-500 text-white'
                            : 'bg-slate-950 border-slate-800 text-slate-300'
                        }`}
                      >
                        #{p.jersey_number} {p.display_name}
                      </button>
                    ))}
                </div>
              </div>
            </div>

            <Button
              onClick={handleSubstitute}
              disabled={submitting || !subOutPlayerId || !subInPlayerId || clockDisplay.isRunning}
              data-testid="modal-confirm-sub"
              className="w-full bg-sky-600 hover:bg-sky-500 text-white font-bold py-3 text-sm h-auto"
            >
              CONFIRM SUBSTITUTION (5-PLAYER INVARIANT)
            </Button>
          </div>
        </div>
      )}

      {/* C. ADJUST CLOCK MODAL */}
      {showTimeModal && (
        <div className="fixed inset-0 z-50 bg-black/80 flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-800 text-white rounded-2xl max-w-sm w-full p-6 shadow-2xl space-y-4">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <h3 className="font-bold text-lg flex items-center gap-2 text-white">
                <Clock className="w-5 h-5 text-orange-400" /> Adjust Game Clock
              </h3>
              <button onClick={() => setShowTimeModal(false)} className="text-slate-400 hover:text-white">
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="flex items-center justify-center gap-3 font-mono text-3xl font-black py-4">
              <div className="flex flex-col items-center">
                <input
                  type="number"
                  min="0"
                  max="20"
                  value={customMinutes}
                  onChange={(e) => setCustomMinutes(Math.max(0, parseInt(e.target.value) || 0))}
                  className="w-20 bg-slate-950 border border-slate-700 rounded-xl text-center py-2 text-white focus:outline-none focus:border-orange-500"
                />
                <span className="text-xs font-sans text-slate-400 mt-1">MIN</span>
              </div>
              <span className="text-slate-500">:</span>
              <div className="flex flex-col items-center">
                <input
                  type="number"
                  min="0"
                  max="59"
                  value={customSeconds}
                  onChange={(e) => setCustomSeconds(Math.min(59, Math.max(0, parseInt(e.target.value) || 0)))}
                  className="w-20 bg-slate-950 border border-slate-700 rounded-xl text-center py-2 text-white focus:outline-none focus:border-orange-500"
                />
                <span className="text-xs font-sans text-slate-400 mt-1">SEC</span>
              </div>
            </div>

            {/* Quick Presets */}
            <div className="grid grid-cols-3 gap-2 text-xs">
              {[
                { label: '10:00', m: 10, s: 0 },
                { label: '05:00', m: 5, s: 0 },
                { label: '02:00', m: 2, s: 0 },
                { label: '01:00', m: 1, s: 0 },
                { label: '00:30', m: 0, s: 30 },
                { label: '00:00', m: 0, s: 0 },
              ].map((p) => (
                <button
                  key={p.label}
                  onClick={() => {
                    setCustomMinutes(p.m);
                    setCustomSeconds(p.s);
                  }}
                  className="py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 border border-slate-700 text-slate-300 font-mono"
                >
                  {p.label}
                </button>
              ))}
            </div>

            <Button
              onClick={handleSetTime}
              disabled={submitting}
              data-testid="modal-confirm-time"
              className="w-full bg-orange-600 hover:bg-orange-500 text-white font-bold py-3 text-sm h-auto"
            >
              SAVE CLOCK TIME
            </Button>
          </div>
        </div>
      )}

      {/* D. UNDO CONFIRMATION MODAL */}
      {showUndoModal && (
        <div className="fixed inset-0 z-50 bg-black/80 flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-800 text-white rounded-2xl max-w-sm w-full p-6 shadow-2xl space-y-4">
            <h3 className="font-bold text-lg text-rose-400 flex items-center gap-2">
              <RotateCcw className="w-5 h-5" /> Undo Latest Action
            </h3>

            {recentEvents[0] ? (
              <div className="bg-slate-950 p-3 rounded-xl border border-slate-800 text-xs space-y-1">
                <p className="font-bold text-white">Event #{recentEvents[0].sequence_number}: {recentEvents[0].event_type}</p>
                <p className="text-slate-400">Points: {recentEvents[0].points} | Team: {recentEvents[0].side === 'SIDE_A' ? sideAName : sideBName}</p>
              </div>
            ) : (
              <p className="text-xs text-slate-400">No actions to undo.</p>
            )}

            <p className="text-xs text-slate-400">
              This action will soft-void the event and atomically revert points, fouls, or lineup projections.
            </p>

            <div className="flex gap-2 pt-2">
              <Button
                variant="outline"
                onClick={() => setShowUndoModal(false)}
                className="w-1/2 border-slate-700 bg-slate-800 text-slate-300 hover:bg-slate-700"
              >
                Cancel
              </Button>
              <Button
                onClick={handleUndo}
                disabled={submitting || recentEvents.length === 0}
                data-testid="modal-confirm-undo"
                className="w-1/2 bg-rose-600 hover:bg-rose-500 text-white font-bold"
              >
                Confirm Undo
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* E. PERIOD PROGRESSION MODAL */}
      {showProgressionModal && (
        <div className="fixed inset-0 z-50 bg-black/80 flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-800 text-white rounded-2xl max-w-sm w-full p-6 shadow-2xl space-y-4">
            <h3 className="font-bold text-lg text-orange-400 flex items-center gap-2">
              <Trophy className="w-5 h-5" /> Progress Period
            </h3>

            <p className="text-xs text-slate-300">
              Current Period: <strong>{periodLabel}</strong> ({clockDisplay.formatted} remaining).
            </p>

            {clockDisplay.isRunning && (
              <p className="text-xs text-rose-400 bg-rose-950/60 p-2.5 rounded-xl border border-rose-900">
                ⚠️ Clock must be stopped before progressing the period. Please pause the clock first.
              </p>
            )}

            <div className="bg-slate-950 p-3 rounded-xl border border-slate-800 text-xs space-y-1">
              <p className="font-bold text-white">Scores at Period End:</p>
              <p className="text-slate-300">{sideAName}: {matchState?.total_score_side_a ?? 0}</p>
              <p className="text-slate-300">{sideBName}: {matchState?.total_score_side_b ?? 0}</p>
            </div>

            <div className="flex gap-2 pt-2">
              <Button
                variant="outline"
                onClick={() => setShowProgressionModal(false)}
                className="w-1/2 border-slate-700 bg-slate-800 text-slate-300 hover:bg-slate-700"
              >
                Cancel
              </Button>
              <Button
                onClick={handleProgressPeriod}
                disabled={submitting || clockDisplay.isRunning}
                data-testid="modal-confirm-period"
                className="w-1/2 bg-orange-600 hover:bg-orange-500 text-white font-bold"
              >
                Advance Period
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
