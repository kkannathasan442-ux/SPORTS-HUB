'use client';

import React, { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/Button';

interface CompetitorListProps {
  matchId: string;
  side: 'SIDE_A' | 'SIDE_B';
  competitor: any;
  matchFormat: string;
}

export const CompetitorList: React.FC<CompetitorListProps> = ({ matchId, side, competitor, matchFormat }) => {
  const router = useRouter();
  const [isAdding, setIsAdding] = useState(false);
  const [name, setName] = useState('');
  const [loading, setLoading] = useState(false);

  const handleAddCompetitor = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return;
    
    setLoading(true);
    try {
      const res = await fetch(`/api/matches/${matchId}/competitors`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          side,
          competitorName: name,
        }),
      });
      
      if (!res.ok) {
        const error = await res.json();
        alert(error.error || 'Failed to add competitor');
      } else {
        setIsAdding(false);
        router.refresh();
      }
    } catch (err) {
      alert('Network error');
    } finally {
      setLoading(false);
    }
  };

  if (!competitor) {
    if (isAdding) {
      return (
        <form onSubmit={handleAddCompetitor} className="space-y-3">
          <input
            type="text"
            placeholder={matchFormat === 'TEAM' ? "Team Name" : "Player Name"}
            value={name}
            onChange={(e) => setName(e.target.value)}
            className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500"
            autoFocus
          />
          <div className="flex gap-2">
            <Button type="submit" size="sm" isLoading={loading}>Save</Button>
            <Button type="button" variant="ghost" size="sm" onClick={() => setIsAdding(false)}>Cancel</Button>
          </div>
        </form>
      );
    }

    return (
      <div className="flex items-center justify-center py-6 border-2 border-dashed border-slate-200 rounded-lg bg-slate-50">
        <Button variant="outline" size="sm" onClick={() => setIsAdding(true)}>
          Add {matchFormat === 'TEAM' ? 'Team' : 'Player'}
        </Button>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-3">
        {competitor.team?.logo_url ? (
          <img src={competitor.team.logo_url} alt="" className="w-10 h-10 rounded-full border border-slate-200 bg-white" />
        ) : (
          <div className="w-10 h-10 rounded-full border border-slate-200 bg-slate-100 flex items-center justify-center text-slate-500 font-medium">
            {competitor.competitor_name.charAt(0).toUpperCase()}
          </div>
        )}
        <div className="font-medium text-slate-900">{competitor.competitor_name}</div>
      </div>
      
      {competitor.participants?.length > 0 && (
        <div className="mt-4 space-y-2">
          <h4 className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-2">Participants</h4>
          {competitor.participants.map((p: any) => (
            <div key={p.id} className="flex items-center justify-between py-1.5 px-3 bg-slate-50 rounded text-sm">
              <span className="text-slate-700">{p.display_name}</span>
              <span className="text-xs bg-slate-200 text-slate-600 px-2 py-0.5 rounded-full">{p.role}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};
