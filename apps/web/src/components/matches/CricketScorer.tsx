'use client';

import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { createSupabaseBrowserClient } from '@/lib/supabase/browser';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { AlertCircle, RotateCcw, Activity, Loader2, X } from 'lucide-react';
import { v4 as uuidv4 } from 'uuid';

export function CricketScorer({ match }: { match: any }) {
  const supabase = createSupabaseBrowserClient();
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Authoritative DB state
  const [innings, setInnings] = useState<any>(null);
  const [deliveries, setDeliveries] = useState<any[]>([]);

  // We need participants
  const teamA = match.competitors?.find((c: any) => c.side === 'SIDE_A');
  const teamB = match.competitors?.find((c: any) => c.side === 'SIDE_B');
  
  // Flatten participants for easy lookup
  const allParticipants = useMemo(() => {
    return [...(teamA?.participants || []), ...(teamB?.participants || [])];
  }, [teamA, teamB]);

  // Determine batting and bowling sides based on innings context
  // Fallback to Team A batting for now if no innings data dictates it 
  const battingTeamId = innings?.batting_competitor_id || teamA?.id;
  const bowlingTeamId = innings?.bowling_competitor_id || teamB?.id;

  const battingParticipants = useMemo(() => {
    return allParticipants.filter(p => p.competitor_id === battingTeamId);
  }, [allParticipants, battingTeamId]);
  
  const bowlingParticipants = useMemo(() => {
    return allParticipants.filter(p => p.competitor_id === bowlingTeamId);
  }, [allParticipants, bowlingTeamId]);

  // Active inputs
  const [clientEventId, setClientEventId] = useState(uuidv4());
  
  const [strikerId, setStrikerId] = useState<string>('');
  const [nonStrikerId, setNonStrikerId] = useState<string>('');
  const [bowlerId, setBowlerId] = useState<string>('');
  
  // Wicket flow state
  const [showWicketDialog, setShowWicketDialog] = useState(false);
  const [wicketType, setWicketType] = useState<string>('BOWLED');
  const [dismissedId, setDismissedId] = useState<string>('');
  const [fielderId, setFielderId] = useState<string>('');

  const getParticipantName = (id: string) => {
    const p = allParticipants.find(p => p.id === id);
    return p?.profile?.full_name || p?.user_id?.substring(0, 8) || 'Unknown Player';
  };

  const loadAuthoritativeState = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      
      const { data: inningsData, error: inningsError } = await supabase
        .from('cricket_innings')
        .select('*')
        .eq('match_id', match.id)
        .order('innings_number', { ascending: false })
        .limit(1)
        .single();
        
      if (inningsError && inningsError.code !== 'PGRST116') {
        throw new Error(inningsError.message);
      }
      
      if (inningsData) {
        setInnings(inningsData);
        const { data: delData, error: delError } = await supabase
          .from('cricket_deliveries')
          .select('*')
          .eq('innings_id', inningsData.id)
          .is('voided_at', null)
          .order('sequence_number', { ascending: false })
          .limit(10);
          
        if (delError) throw new Error(delError.message);
        const latestDeliveries = delData || [];
        setDeliveries(latestDeliveries);
        
        // Auto-select latest players if available
        if (latestDeliveries.length > 0) {
          const lastDelivery = latestDeliveries[0];
          // Assuming the backend doesn't rotate strike in the DB returned fields yet
          if (!strikerId) setStrikerId(lastDelivery.striker_participant_id);
          if (!nonStrikerId) setNonStrikerId(lastDelivery.non_striker_participant_id);
          if (!bowlerId) setBowlerId(lastDelivery.bowler_participant_id);
        }
      }
    } catch (err: any) {
      setError(err.message || 'Failed to load match state.');
    } finally {
      setLoading(false);
    }
  }, [supabase, match.id, strikerId, nonStrikerId, bowlerId]);

  useEffect(() => {
    loadAuthoritativeState();
  }, [loadAuthoritativeState]);

  const mapRpcError = (msg: string) => {
    if (msg.includes('INVALID_MATCH_STATE')) return "This match is not currently accepting scores.";
    if (msg.includes('NOT_FOUND')) return "The scoring innings could not be found.";
    if (msg.includes('INVALID_SEQUENCE')) return "The score has changed. Refreshing the latest match state.";
    if (msg.includes('IDEMPOTENCY_CONFLICT')) return "This delivery has already been processed.";
    if (msg.includes('INNINGS_COMPLETED')) return "This innings is already completed.";
    if (msg.includes('INVALID_UNDO')) return "Only the latest active delivery can be undone.";
    return msg;
  };

  const submitScore = async (payload: any) => {
    if (!innings || !strikerId || !nonStrikerId || !bowlerId) {
      setError("Missing active innings or players.");
      return;
    }

    setSubmitting(true);
    setError(null);
    
    const expectedSequence = deliveries.length > 0 ? deliveries[0].sequence_number + 1 : 1;
    const currentOver = innings.legal_balls ? Math.floor(innings.legal_balls / 6) : 0;
    const currentBall = innings.legal_balls ? (innings.legal_balls % 6) + 1 : 1;
    
    try {
      const { error: rpcError } = await supabase.rpc('record_cricket_delivery', {
        p_match_id: match.id,
        p_innings_id: innings.id,
        p_sequence_number: expectedSequence,
        p_over_number: currentOver,
        p_ball_number: currentBall,
        p_striker_participant_id: strikerId,
        p_non_striker_participant_id: nonStrikerId,
        p_bowler_participant_id: bowlerId,
        p_client_event_id: clientEventId,
        ...payload
      });

      if (rpcError) {
        throw new Error(mapRpcError(rpcError.message));
      }

      setClientEventId(uuidv4());
      await loadAuthoritativeState();
      
      // Basic auto strike rotation for UI convenience 
      if (payload.p_is_legal_delivery && (payload.p_runs_off_bat % 2 !== 0)) {
        // Switch strike
        setStrikerId(nonStrikerId);
        setNonStrikerId(strikerId);
      }
      // If over completed, switch strike (and realistically clear bowler, but we leave it for now)
      if (payload.p_is_legal_delivery && currentBall === 6) {
        setStrikerId(nonStrikerId);
        setNonStrikerId(strikerId);
        setBowlerId('');
      }
      
    } catch (err: any) {
      setError(err.message || 'Scoring request could not be confirmed.');
      if (err.message?.includes('Refresh')) {
        await loadAuthoritativeState();
      }
    } finally {
      setSubmitting(false);
      setShowWicketDialog(false);
    }
  };

  const handleRuns = (runs: number) => {
    submitScore({
      p_runs_off_bat: runs,
      p_extras_amount: 0,
      p_extras_type: 'NONE',
      p_is_legal_delivery: true,
      p_is_wicket: false,
      p_dismissal_type: null,
      p_dismissed_participant_id: null,
      p_fielder_participant_id: null,
    });
  };

  const handleExtras = (extrasType: string) => {
    const isLegal = extrasType === 'BYE' || extrasType === 'LEG_BYE';
    submitScore({
      p_runs_off_bat: 0,
      p_extras_amount: 1,
      p_extras_type: extrasType,
      p_is_legal_delivery: isLegal,
      p_is_wicket: false,
      p_dismissal_type: null,
      p_dismissed_participant_id: null,
      p_fielder_participant_id: null,
    });
  };

  const handleWicketSubmit = () => {
    if (!dismissedId) {
      setError("Select dismissed player.");
      return;
    }
    submitScore({
      p_runs_off_bat: 0,
      p_extras_amount: 0,
      p_extras_type: 'NONE',
      p_is_legal_delivery: true, // simplified, could be an extra
      p_is_wicket: true,
      p_dismissal_type: wicketType,
      p_dismissed_participant_id: dismissedId,
      p_fielder_participant_id: fielderId || null,
    });
  };

  const handleUndo = async () => {
    if (!innings || deliveries.length === 0) return;
    if (!window.confirm("Are you sure you want to undo the last delivery?")) return;
    
    setSubmitting(true);
    setError(null);
    
    try {
      const latestDeliveryId = deliveries[0].id;
      const { error: rpcError } = await supabase.rpc('undo_cricket_delivery', {
        p_match_id: match.id,
        p_innings_id: innings.id,
        p_delivery_id: latestDeliveryId
      });

      if (rpcError) throw new Error(mapRpcError(rpcError.message));
      await loadAuthoritativeState();
    } catch (err: any) {
      setError(err.message || 'Undo request failed.');
      if (err.message?.includes('Refresh') || err.message?.includes('INVALID_UNDO')) {
        await loadAuthoritativeState();
      }
    } finally {
      setSubmitting(false);
    }
  };

  const handleCompleteInnings = async () => {
    if (!innings || innings.is_completed) return;
    if (!window.confirm("Are you sure you want to complete this innings?")) return;
    setSubmitting(true);
    try {
      const { error: rpcError } = await supabase.rpc('complete_cricket_innings', {
        p_match_id: match.id,
        p_innings_id: innings.id
      });
      if (rpcError) throw new Error(mapRpcError(rpcError.message));
      await loadAuthoritativeState();
    } catch (err: any) {
      setError(err.message || 'Failed to complete innings.');
    } finally {
      setSubmitting(false);
    }
  };

  const handleCompleteMatch = async () => {
    if (!window.confirm("Are you sure you want to end this match?")) return;
    setSubmitting(true);
    try {
      const { error: rpcError } = await supabase.rpc('complete_cricket_match', {
        p_match_id: match.id
      });
      if (rpcError) throw new Error(mapRpcError(rpcError.message));
      await loadAuthoritativeState();
      window.location.reload();
    } catch (err: any) {
      setError(err.message || 'Failed to complete match.');
    } finally {
      setSubmitting(false);
    }
  };

  const renderPlayerSelect = (label: string, value: string, setValue: (id: string) => void, options: any[]) => (
    <div className="flex-1 min-w-[120px]">
      <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-1">{label}</label>
      <select 
        className="w-full bg-slate-50 border border-slate-200 rounded-md py-2 px-2 text-sm font-medium text-slate-800"
        value={value}
        onChange={e => setValue(e.target.value)}
      >
        <option value="">Select {label}</option>
        {options.map(p => (
          <option key={p.id} value={p.id}>{getParticipantName(p.id)}</option>
        ))}
      </select>
    </div>
  );

  if (loading) {
    return <div className="flex items-center justify-center p-12"><Loader2 className="w-8 h-8 animate-spin text-slate-400" /></div>;
  }

  return (
    <div className="max-w-md mx-auto flex flex-col gap-4 relative">
      <Card className="p-6 bg-slate-900 text-white text-center">
        <h2 className="text-sm font-medium text-slate-400 uppercase tracking-widest">{teamA?.name || 'TEAM A'} vs {teamB?.name || 'TEAM B'}</h2>
        <div className="text-5xl font-black mt-2 mb-1 tracking-tight">
          {innings ? `${innings.total_runs} / ${innings.total_wickets}` : '0 / 0'}
        </div>
        <div className="text-lg font-medium text-slate-300">
          {innings ? `${Math.floor(innings.legal_balls / 6)}.${innings.legal_balls % 6}` : '0.0'} OVERS
        </div>
      </Card>

      {error && (
        <div className="bg-rose-50 text-rose-800 p-4 rounded-lg flex items-start gap-3 border border-rose-200">
          <AlertCircle className="w-5 h-5 shrink-0 mt-0.5" />
          <div className="flex-1">
            <p className="text-sm font-medium">{error}</p>
            <button 
              onClick={loadAuthoritativeState}
              className="text-xs font-bold underline mt-1 opacity-80 hover:opacity-100"
            >
              Refresh State
            </button>
          </div>
        </div>
      )}

      {/* Players Selection */}
      <Card className="p-4 flex flex-wrap gap-3">
        {renderPlayerSelect('Striker', strikerId, setStrikerId, battingParticipants)}
        {renderPlayerSelect('Non-Striker', nonStrikerId, setNonStrikerId, battingParticipants)}
        {renderPlayerSelect('Bowler', bowlerId, setBowlerId, bowlingParticipants)}
      </Card>

      {/* Current Over */}
      <Card className="p-4">
        <h3 className="text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-2">Recent Over</h3>
        <div className="flex flex-wrap gap-2">
          {deliveries.slice(0, 6).reverse().map((d) => (
             <div key={d.id} className={`w-10 h-10 rounded-full flex items-center justify-center font-bold text-sm shadow-sm border ${d.is_wicket ? 'bg-rose-100 text-rose-700 border-rose-200' : d.extras_type !== 'NONE' ? 'bg-slate-100 text-slate-700 border-slate-200' : 'bg-white text-slate-900 border-slate-300'}`}>
               {d.is_wicket ? 'W' : d.extras_type !== 'NONE' ? `${d.extras_amount}${d.extras_type === 'WIDE' ? 'wd' : d.extras_type === 'NO_BALL' ? 'nb' : d.extras_type === 'LEG_BYE' ? 'lb' : 'b'}` : d.runs_off_bat}
             </div>
          ))}
          {deliveries.length === 0 && <span className="text-sm text-slate-400 italic">No deliveries yet</span>}
        </div>
      </Card>

      {/* Scoring Controls */}
      <Card className="p-4">
        <h3 className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-3">Runs</h3>
        <div className="grid grid-cols-3 gap-2">
          {[0,1,2,3,4,6].map(runs => (
            <Button 
              key={runs} 
              variant="outline" 
              className={`h-14 text-xl font-black ${runs === 4 || runs === 6 ? 'bg-sports-accent/10 border-sports-accent text-sports-accent' : ''}`}
              onClick={() => handleRuns(runs)}
              disabled={submitting || !innings}
            >
              {runs}
            </Button>
          ))}
        </div>

        <h3 className="text-xs font-bold text-slate-500 uppercase tracking-wider mt-6 mb-3">Extras & Wickets</h3>
        <div className="grid grid-cols-4 gap-2">
          <Button variant="outline" className="h-12 font-bold text-slate-600" onClick={() => handleExtras('WIDE')} disabled={submitting || !innings}>WD</Button>
          <Button variant="outline" className="h-12 font-bold text-slate-600" onClick={() => handleExtras('NO_BALL')} disabled={submitting || !innings}>NB</Button>
          <Button variant="outline" className="h-12 font-bold text-slate-600" onClick={() => handleExtras('LEG_BYE')} disabled={submitting || !innings}>LB</Button>
          <Button variant="outline" className="h-12 font-bold text-slate-600" onClick={() => handleExtras('BYE')} disabled={submitting || !innings}>BYE</Button>
        </div>
        <Button 
          variant="primary" 
          className="w-full mt-2 h-12 bg-rose-600 hover:bg-rose-700 text-white font-bold" 
          onClick={() => {
            setDismissedId(strikerId);
            setWicketType('BOWLED');
            setShowWicketDialog(true);
          }}
          disabled={submitting || !innings}
        >
          WICKET
        </Button>
      </Card>

      {/* Undo and Complete Controls */}
      <div className="flex flex-col gap-2">
        <Button 
          variant="outline" 
          className="w-full h-12 text-slate-600 border-slate-300 bg-white"
          onClick={handleUndo}
          disabled={submitting || deliveries.length === 0 || !innings || innings.is_completed}
        >
          <RotateCcw className="w-4 h-4 mr-2" />
          UNDO LAST BALL
        </Button>
        <Button 
          variant="outline" 
          className="w-full h-12 text-indigo-600 border-indigo-300 bg-indigo-50 hover:bg-indigo-100"
          onClick={handleCompleteInnings}
          disabled={submitting || !innings || innings.is_completed}
        >
          COMPLETE INNINGS
        </Button>
        <Button 
          variant="primary" 
          className="w-full h-12 bg-slate-800 text-white hover:bg-slate-900"
          onClick={handleCompleteMatch}
          disabled={submitting || match.status === 'COMPLETED'}
        >
          COMPLETE MATCH
        </Button>
      </div>

      {/* Submitting Overlay */}
      {submitting && (
        <div className="fixed inset-0 bg-white/50 backdrop-blur-sm flex items-center justify-center z-50">
          <div className="bg-slate-900 text-white px-6 py-4 rounded-xl flex items-center gap-3 shadow-xl">
            <Activity className="w-5 h-5 animate-pulse" />
            <span className="font-medium">Processing...</span>
          </div>
        </div>
      )}

      {/* Wicket Dialog */}
      {showWicketDialog && (
        <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4">
          <Card className="w-full max-w-sm p-6 bg-white shadow-2xl relative">
            <button 
              className="absolute top-4 right-4 text-slate-400 hover:text-slate-700" 
              onClick={() => setShowWicketDialog(false)}
            >
              <X className="w-5 h-5" />
            </button>
            <h2 className="text-lg font-bold text-slate-900 mb-4">Record Wicket</h2>
            
            <div className="space-y-4">
              <div>
                <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Dismissal Type</label>
                <select 
                  className="w-full bg-slate-50 border border-slate-200 rounded-md py-2 px-3 text-sm font-medium"
                  value={wicketType}
                  onChange={e => setWicketType(e.target.value)}
                >
                  <option value="BOWLED">Bowled</option>
                  <option value="CAUGHT">Caught</option>
                  <option value="LBW">LBW</option>
                  <option value="RUN_OUT">Run Out</option>
                  <option value="STUMPED">Stumped</option>
                  <option value="HIT_WICKET">Hit Wicket</option>
                  <option value="RETIRED_HURT">Retired Hurt</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Dismissed Player</label>
                <select 
                  className="w-full bg-slate-50 border border-slate-200 rounded-md py-2 px-3 text-sm font-medium"
                  value={dismissedId}
                  onChange={e => setDismissedId(e.target.value)}
                >
                  {strikerId && <option value={strikerId}>{getParticipantName(strikerId)} (Striker)</option>}
                  {nonStrikerId && <option value={nonStrikerId}>{getParticipantName(nonStrikerId)} (Non-Striker)</option>}
                </select>
              </div>

              {['CAUGHT', 'RUN_OUT', 'STUMPED'].includes(wicketType) && (
                <div>
                  <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Fielder (Optional)</label>
                  <select 
                    className="w-full bg-slate-50 border border-slate-200 rounded-md py-2 px-3 text-sm font-medium"
                    value={fielderId}
                    onChange={e => setFielderId(e.target.value)}
                  >
                    <option value="">Select Fielder</option>
                    {bowlingParticipants.map(p => (
                      <option key={p.id} value={p.id}>{getParticipantName(p.id)}</option>
                    ))}
                  </select>
                </div>
              )}

              <Button 
                variant="primary" 
                className="w-full h-12 bg-rose-600 hover:bg-rose-700 text-white font-bold mt-4" 
                onClick={handleWicketSubmit}
              >
                CONFIRM WICKET
              </Button>
            </div>
          </Card>
        </div>
      )}
    </div>
  );
}
