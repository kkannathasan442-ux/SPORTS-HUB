'use client';

import React, { useTransition } from 'react';
import { toggleVenueSportAction } from '@/lib/owner/actions';
import { Card } from '@/components/ui/Card';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { Dumbbell, Check, Plus, Loader2 } from 'lucide-react';
import type { Sport, VenueSportWithSport } from '@sportshub/types';

interface VenueSportsManagerProps {
  venueId: string;
  allGlobalSports: Sport[];
  assignedVenueSports: VenueSportWithSport[];
}

export function VenueSportsManager({
  venueId,
  allGlobalSports,
  assignedVenueSports,
}: VenueSportsManagerProps) {
  const [isPending, startTransition] = useTransition();

  const activeVenueSportMap = new Map(
    assignedVenueSports.map((vs) => [vs.sport_id, vs.is_active])
  );

  const handleToggle = (sportId: string, currentActive: boolean) => {
    startTransition(async () => {
      await toggleVenueSportAction(venueId, sportId, !currentActive);
    });
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
        <div>
          <h3 className="text-base font-bold text-slate-900">Supported Sports</h3>
          <p className="text-xs text-slate-500 mt-0.5">
            Enable the sports supported at this venue. Facilities can only be created for active venue sports.
          </p>
        </div>
        <Badge variant="info">
          {assignedVenueSports.filter((vs) => vs.is_active).length} Active of {allGlobalSports.length}
        </Badge>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {allGlobalSports.map((sport) => {
          const isAssigned = activeVenueSportMap.has(sport.id);
          const isActive = isAssigned && activeVenueSportMap.get(sport.id) === true;

          return (
            <Card
              key={sport.id}
              className={`p-5 flex flex-col justify-between transition-all ${
                isActive
                  ? 'border-sports-accent/40 bg-sky-50/20 shadow-xs'
                  : 'border-slate-200 bg-white opacity-90'
              }`}
            >
              <div>
                <div className="flex items-center justify-between mb-2">
                  <div className="w-8 h-8 rounded-lg bg-sports-navy/10 text-sports-navy flex items-center justify-center font-bold">
                    <Dumbbell className="w-4 h-4" />
                  </div>
                  {isActive ? (
                    <Badge variant="success" className="text-[10px]">Active</Badge>
                  ) : (
                    <Badge variant="default" className="text-[10px]">Disabled</Badge>
                  )}
                </div>

                <h4 className="text-sm font-bold text-slate-900">{sport.name}</h4>
                <p className="text-xs text-slate-500 mt-1 line-clamp-2 leading-relaxed">
                  {sport.description}
                </p>
              </div>

              <div className="mt-4 pt-3 border-t border-slate-100 flex items-center justify-between">
                <span className="text-[11px] font-medium text-slate-400">
                  {sport.supports_booking ? 'Bookable' : 'Walk-in only'}
                </span>

                <Button
                  size="sm"
                  variant={isActive ? 'outline' : 'primary'}
                  disabled={isPending}
                  onClick={() => handleToggle(sport.id, isActive)}
                  className="text-xs py-1 px-3"
                >
                  {isPending ? (
                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  ) : isActive ? (
                    'Disable'
                  ) : (
                    <span className="flex items-center gap-1">
                      <Plus className="w-3 h-3" /> Enable
                    </span>
                  )}
                </Button>
              </div>
            </Card>
          );
        })}
      </div>
    </div>
  );
}
