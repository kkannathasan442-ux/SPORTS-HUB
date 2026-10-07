import React from 'react';
import { Metadata } from 'next';
import { notFound, redirect } from 'next/navigation';
import { createSupabaseServerClient } from '@/lib/supabase/server';
import { getMatchWithDetails } from '@/lib/matches/queries';
import { Container } from '@/components/ui/Container';
import { BadmintonScorer } from '@/components/matches/BadmintonScorer';

export async function generateMetadata({ params }: { params: { id: string } }): Promise<Metadata> {
  return {
    title: `Badminton Scorer | SportsHub`,
  };
}

export default async function BadmintonScorerPage({ params }: { params: { id: string } }) {
  const supabase = await createSupabaseServerClient();
  
  // 1. Fetch match and verify it exists
  const match = await getMatchWithDetails(supabase, params.id);
  if (!match) {
    notFound();
  }

  // 2. Verify sport is Badminton (case insensitive check)
  if (match.sport?.name?.toLowerCase() !== 'badminton') {
    redirect(`/matches/${params.id}`);
  }

  return (
    <div className="min-h-screen bg-slate-50 pb-20">
      <Container className="py-4">
        <BadmintonScorer match={match} />
      </Container>
    </div>
  );
}
