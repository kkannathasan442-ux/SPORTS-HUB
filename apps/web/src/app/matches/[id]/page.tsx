import React from 'react';
import { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { createSupabaseServerClient } from '@/lib/supabase/server';
import { getMatchWithDetails } from '@/lib/matches/queries';
import { PageHeader } from '@/components/ui/PageHeader';
import { Container } from '@/components/ui/Container';
import { Card } from '@/components/ui/Card';
import { MatchStatusBadge } from '@/components/matches/MatchStatusBadge';
import { MatchLifecycleActions } from '@/components/matches/MatchLifecycleActions';
import { CompetitorList } from '@/components/matches/CompetitorList';
import { format } from 'date-fns';
import { Calendar, Clock, MapPin } from 'lucide-react';

export async function generateMetadata({ params }: { params: { id: string } }): Promise<Metadata> {
  return {
    title: `Match Details | SportsHub`,
  };
}

export default async function MatchDetailsPage({ params }: { params: { id: string } }) {
  const supabase = await createSupabaseServerClient();
  const match = await getMatchWithDetails(supabase, params.id);

  if (!match) {
    notFound();
  }

  const displayTitle = match.title || `${match.sport?.name || 'Match'} ${match.match_format}`;
  const sideA = match.competitors?.find(c => c.side === 'SIDE_A');
  const sideB = match.competitors?.find(c => c.side === 'SIDE_B');

  return (
    <Container className="py-8">
      <div className="mb-6 flex flex-col md:flex-row md:items-start md:justify-between gap-4">
        <div>
          <div className="flex items-center gap-3 mb-2">
            <h1 className="text-2xl font-bold text-slate-900">{displayTitle}</h1>
            <MatchStatusBadge status={match.status as any} />
          </div>
          <p className="text-slate-500 capitalize">
            {match.match_type.toLowerCase()} • {match.match_format.toLowerCase()}
          </p>
        </div>
        
        <MatchLifecycleActions matchId={match.id} currentStatus={match.status as any} />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        <div className="lg:col-span-2 space-y-6">
          <Card>
            <h2 className="text-lg font-semibold text-slate-900 mb-6 flex items-center justify-between">
              Match Competitors
            </h2>
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-8 items-start relative">
              <div className="hidden md:flex absolute inset-0 items-center justify-center pointer-events-none">
                <div className="bg-slate-100 rounded-full h-10 w-10 flex items-center justify-center font-bold text-slate-400">
                  VS
                </div>
              </div>

              <div>
                <h3 className="font-medium text-slate-700 mb-4 pb-2 border-b">Side A</h3>
                <CompetitorList 
                  matchId={match.id} 
                  side="SIDE_A" 
                  competitor={sideA} 
                  matchFormat={match.match_format} 
                />
              </div>

              <div>
                <h3 className="font-medium text-slate-700 mb-4 pb-2 border-b">Side B</h3>
                <CompetitorList 
                  matchId={match.id} 
                  side="SIDE_B" 
                  competitor={sideB} 
                  matchFormat={match.match_format} 
                />
              </div>
            </div>
          </Card>
        </div>

        <div className="space-y-6">
          <Card>
            <h3 className="font-semibold text-slate-900 mb-4">Match Info</h3>
            
            <div className="space-y-4">
              {match.scheduled_start && (
                <div className="flex items-start">
                  <Calendar className="w-5 h-5 text-slate-400 mr-3 mt-0.5" />
                  <div>
                    <p className="text-sm font-medium text-slate-700">Scheduled Date</p>
                    <p className="text-sm text-slate-500">{format(new Date(match.scheduled_start), 'PPP')}</p>
                  </div>
                </div>
              )}
              
              {match.scheduled_start && (
                <div className="flex items-start">
                  <Clock className="w-5 h-5 text-slate-400 mr-3 mt-0.5" />
                  <div>
                    <p className="text-sm font-medium text-slate-700">Scheduled Time</p>
                    <p className="text-sm text-slate-500">
                      {format(new Date(match.scheduled_start), 'p')}
                      {match.scheduled_end && ` - ${format(new Date(match.scheduled_end), 'p')}`}
                    </p>
                  </div>
                </div>
              )}

              {match.venue && (
                <div className="flex items-start">
                  <MapPin className="w-5 h-5 text-slate-400 mr-3 mt-0.5" />
                  <div>
                    <p className="text-sm font-medium text-slate-700">Venue</p>
                    <p className="text-sm text-slate-500">{match.venue.name}</p>
                    {match.facility && <p className="text-sm text-slate-500">{match.facility.name}</p>}
                  </div>
                </div>
              )}
            </div>
          </Card>
        </div>
      </div>
    </Container>
  );
}
