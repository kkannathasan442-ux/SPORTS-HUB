import React from 'react';
import { Metadata } from 'next';
import { notFound, redirect } from 'next/navigation';
import { createSupabaseServerClient } from '@/lib/supabase/server';
import { getMatchWithDetails } from '@/lib/matches/queries';
import { Container } from '@/components/ui/Container';
import { CricketScorer } from '@/components/matches/CricketScorer';

export async function generateMetadata({ params }: { params: { id: string } }): Promise<Metadata> {
  return {
    title: `Cricket Scorer | SportsHub`,
  };
}

export default async function CricketScorerPage({ params }: { params: { id: string } }) {
  const supabase = await createSupabaseServerClient();
  
  // 1. Fetch match and verify it exists
  const match = await getMatchWithDetails(supabase, params.id);
  if (!match) {
    notFound();
  }

  // 2. Verify sport is Cricket (case insensitive check)
  if (match.sport?.name?.toLowerCase() !== 'cricket') {
    redirect(`/matches/${params.id}`);
  }
  
  // 3. Authorization is enforced by RLS when mutating.
  // We can fetch initial innings data here if we had a query for it, 
  // but we can also just pass the match down to the client component.
  
  // For STEP 16D, we need the initial innings. 
  // If no innings exists, the scorer might need to create one, or we assume one exists.
  // We will let the client component handle fetching the latest innings and deliveries.

  return (
    <div className="min-h-screen bg-slate-50 pb-20">
      <Container className="py-4">
        <CricketScorer match={match} />
      </Container>
    </div>
  );
}
