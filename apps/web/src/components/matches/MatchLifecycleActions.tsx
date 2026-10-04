'use client';

import React, { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/Button';
import { MatchStatusSchema } from '@sportshub/validation';

interface MatchLifecycleActionsProps {
  matchId: string;
  currentStatus: MatchStatusSchema;
}

export const MatchLifecycleActions: React.FC<MatchLifecycleActionsProps> = ({ matchId, currentStatus }) => {
  const router = useRouter();
  const [loading, setLoading] = useState<string | null>(null);

  const handleTransition = async (status: MatchStatusSchema) => {
    setLoading(status);
    try {
      const res = await fetch(`/api/matches/${matchId}/transition`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status }),
      });
      if (!res.ok) {
        const error = await res.json();
        alert(error.error || 'Failed to transition match');
      } else {
        router.refresh();
      }
    } catch (err) {
      alert('Network error');
    } finally {
      setLoading(null);
    }
  };

  const actions = [];

  if (currentStatus === 'DRAFT') {
    actions.push(
      <Button key="schedule" variant="primary" isLoading={loading === 'SCHEDULED'} onClick={() => handleTransition('SCHEDULED')}>Schedule Match</Button>,
      <Button key="cancel" variant="outline" isLoading={loading === 'CANCELLED'} onClick={() => handleTransition('CANCELLED')}>Cancel</Button>
    );
  } else if (currentStatus === 'SCHEDULED') {
    actions.push(
      <Button key="warmup" variant="secondary" isLoading={loading === 'WARMUP'} onClick={() => handleTransition('WARMUP')}>Start Warmup</Button>,
      <Button key="live" variant="primary" isLoading={loading === 'LIVE'} onClick={() => handleTransition('LIVE')}>Start Match</Button>,
      <Button key="cancel" variant="outline" isLoading={loading === 'CANCELLED'} onClick={() => handleTransition('CANCELLED')}>Cancel</Button>
    );
  } else if (currentStatus === 'WARMUP') {
    actions.push(
      <Button key="live" variant="primary" isLoading={loading === 'LIVE'} onClick={() => handleTransition('LIVE')}>Start Match</Button>,
      <Button key="cancel" variant="outline" isLoading={loading === 'CANCELLED'} onClick={() => handleTransition('CANCELLED')}>Cancel</Button>
    );
  } else if (currentStatus === 'LIVE') {
    actions.push(
      <Button key="pause" variant="secondary" isLoading={loading === 'PAUSED'} onClick={() => handleTransition('PAUSED')}>Pause Match</Button>,
      <Button key="complete" variant="primary" isLoading={loading === 'COMPLETED'} onClick={() => handleTransition('COMPLETED')}>Complete Match</Button>,
      <Button key="abandon" variant="outline" isLoading={loading === 'ABANDONED'} onClick={() => handleTransition('ABANDONED')}>Abandon</Button>
    );
  } else if (currentStatus === 'PAUSED') {
    actions.push(
      <Button key="live" variant="primary" isLoading={loading === 'LIVE'} onClick={() => handleTransition('LIVE')}>Resume Match</Button>,
      <Button key="abandon" variant="outline" isLoading={loading === 'ABANDONED'} onClick={() => handleTransition('ABANDONED')}>Abandon</Button>
    );
  }

  if (actions.length === 0) return null;

  return (
    <div className="flex flex-wrap gap-2">
      {actions}
    </div>
  );
};
