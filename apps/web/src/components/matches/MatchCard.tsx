import React from 'react';
import Link from 'next/link';
import { Card } from '@/components/ui/Card';
import { MatchStatusBadge } from './MatchStatusBadge';
import type { Match } from '@sportshub/types';
import { Calendar, MapPin, Clock } from 'lucide-react';
import { format } from 'date-fns';

interface MatchCardProps {
  match: Match & {
    sport?: { id: string; name: string; icon?: string | null };
    venue?: { id: string; name: string; timezone?: string };
    facility?: { id: string; name: string };
  };
}

export const MatchCard: React.FC<MatchCardProps> = ({ match }) => {
  const displayTitle = match.title || `${match.sport?.name || 'Match'} ${match.match_format}`;

  return (
    <Link href={`/matches/${match.id}`} className="block">
      <Card hoverable className="h-full flex flex-col">
        <div className="flex justify-between items-start mb-4">
          <div>
            <h3 className="font-semibold text-lg text-slate-900">{displayTitle}</h3>
            <p className="text-sm text-slate-500 capitalize">{match.match_type.toLowerCase()} • {match.match_format.toLowerCase()}</p>
          </div>
          <MatchStatusBadge status={match.status as any} />
        </div>

        <div className="space-y-2 mt-auto">
          {match.scheduled_start && (
            <div className="flex items-center text-sm text-slate-600">
              <Calendar className="w-4 h-4 mr-2" />
              <span>{format(new Date(match.scheduled_start), 'PPP')}</span>
              <Clock className="w-4 h-4 ml-3 mr-1" />
              <span>{format(new Date(match.scheduled_start), 'p')}</span>
            </div>
          )}

          {match.venue && (
            <div className="flex items-center text-sm text-slate-600">
              <MapPin className="w-4 h-4 mr-2" />
              <span className="truncate">
                {match.venue.name}
                {match.facility && ` - ${match.facility.name}`}
              </span>
            </div>
          )}
        </div>
      </Card>
    </Link>
  );
};
