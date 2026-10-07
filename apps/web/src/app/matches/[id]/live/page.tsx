import React from 'react';
import { Metadata } from 'next';
import { notFound, redirect } from 'next/navigation';
import { createSupabaseServerClient } from '@/lib/supabase/server';
import { getMatchWithDetails } from '@/lib/matches/queries';
import { Container } from '@/components/ui/Container';
import { LiveMatchCentre } from '@/components/matches/LiveMatchCentre';
import { BadmintonLiveMatchCentre } from '@/components/matches/BadmintonLiveMatchCentre';
import { BasketballScorer } from '@/components/matches/BasketballScorer';

export async function generateMetadata({ params }: { params: { id: string } }): Promise<Metadata> {
  return {
    title: `Live Match Centre | SportsHub`,
  };
}

export default async function LiveMatchPage({ params }: { params: { id: string } }) {
  const supabase = await createSupabaseServerClient();
  
  const match = await getMatchWithDetails(supabase, params.id);
  if (!match) {
    notFound();
  }

  const sportSlug = match.sport?.slug?.toLowerCase() || match.sport?.name?.toLowerCase();

  if (sportSlug === 'cricket') {
    return (
      <div className="min-h-screen bg-slate-50 pb-20">
        <Container className="py-8">
          <LiveMatchCentre match={match} />
        </Container>
      </div>
    );
  }

  if (sportSlug === 'badminton') {
    return (
      <div className="min-h-screen bg-slate-50 pb-20">
        <Container className="py-8">
          <BadmintonLiveMatchCentre match={match} />
        </Container>
      </div>
    );
  }

  if (sportSlug === 'basketball') {
    return (
      <div className="min-h-screen bg-slate-950 pb-20">
        <Container className="py-4">
          <BasketballScorer match={match} />
        </Container>
      </div>
    );
  }

  // Safe fallback for other / unsupported sports
  redirect(`/matches/${params.id}`);
}
