import React from 'react';
import { Metadata } from 'next';
import { notFound, redirect } from 'next/navigation';
import { createSupabaseServerClient } from '@/lib/supabase/server';
import { getMatchWithDetails } from '@/lib/matches/queries';
import { Container } from '@/components/ui/Container';
import { BasketballScorer } from '@/components/matches/BasketballScorer';

export async function generateMetadata({ params }: { params: { id: string } }): Promise<Metadata> {
  return {
    title: `Basketball Scorer | SportsHub`,
  };
}

export default async function BasketballScorerPage({ params }: { params: { id: string } }) {
  const supabase = await createSupabaseServerClient();
  
  // 1. Fetch match and verify it exists
  const match = await getMatchWithDetails(supabase, params.id);
  if (!match) {
    notFound();
  }

  // 2. Verify sport is Basketball (case insensitive check)
  const sportSlug = match.sport?.slug?.toLowerCase() || match.sport?.name?.toLowerCase();
  if (sportSlug !== 'basketball') {
    redirect(`/matches/${params.id}`);
  }

  return (
    <div className="min-h-screen bg-slate-950 pb-20">
      <Container className="py-4">
        <BasketballScorer match={match} />
      </Container>
    </div>
  );
}
