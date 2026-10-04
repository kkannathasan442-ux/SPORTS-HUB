import React from 'react';
import { Metadata } from 'next';
import { createSupabaseServerClient } from '@/lib/supabase/server';
import { listMatches } from '@/lib/matches/queries';
import { PageHeader } from '@/components/ui/PageHeader';
import { Container } from '@/components/ui/Container';
import { MatchCard } from '@/components/matches/MatchCard';
import { Button } from '@/components/ui/Button';
import Link from 'next/link';

export const metadata: Metadata = {
  title: 'Matches | SportsHub',
};

export default async function MatchesPage({
  searchParams,
}: {
  searchParams: { [key: string]: string | string[] | undefined };
}) {
  const supabase = await createSupabaseServerClient();
  const page = typeof searchParams.page === 'string' ? parseInt(searchParams.page, 10) : 1;
  const statusFilter = typeof searchParams.status === 'string' ? searchParams.status : undefined;
  
  // Wait, let's fetch matches safely.
  let matchesResult = null;
  let errorMsg = null;
  try {
    matchesResult = await listMatches(supabase, {
      page,
      limit: 24,
      status: statusFilter as any,
    });
  } catch (error: any) {
    errorMsg = error.message;
  }

  const { matches = [] } = matchesResult || {};

  return (
    <Container className="py-8">
      <PageHeader 
        title="Matches" 
        description="View and manage matches across all sports and venues."
      >
        <Link href="/matches/new">
          <Button>Create Match</Button>
        </Link>
      </PageHeader>

      <div className="flex gap-4 mb-8">
        <Link href="/matches" className={`px-4 py-2 rounded-full text-sm font-medium ${!statusFilter ? 'bg-sports-navy text-white' : 'bg-slate-100 text-slate-700 hover:bg-slate-200'}`}>All Matches</Link>
        <Link href="/matches?status=LIVE" className={`px-4 py-2 rounded-full text-sm font-medium ${statusFilter === 'LIVE' ? 'bg-sports-navy text-white' : 'bg-slate-100 text-slate-700 hover:bg-slate-200'}`}>Live</Link>
        <Link href="/matches?status=SCHEDULED" className={`px-4 py-2 rounded-full text-sm font-medium ${statusFilter === 'SCHEDULED' ? 'bg-sports-navy text-white' : 'bg-slate-100 text-slate-700 hover:bg-slate-200'}`}>Upcoming</Link>
        <Link href="/matches?status=COMPLETED" className={`px-4 py-2 rounded-full text-sm font-medium ${statusFilter === 'COMPLETED' ? 'bg-sports-navy text-white' : 'bg-slate-100 text-slate-700 hover:bg-slate-200'}`}>Completed</Link>
      </div>

      {errorMsg && (
        <div className="bg-rose-50 text-rose-700 p-4 rounded-lg mb-8">
          {errorMsg}
        </div>
      )}

      {!errorMsg && matches.length === 0 ? (
        <div className="text-center py-12 bg-slate-50 rounded-xl border border-dashed border-slate-200">
          <h3 className="text-lg font-medium text-slate-900 mb-2">No matches found</h3>
          <p className="text-slate-500 mb-6">There are no matches matching your criteria.</p>
          <Link href="/matches/new">
            <Button variant="outline">Create your first match</Button>
          </Link>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
          {matches.map((match: any) => (
            <MatchCard key={match.id} match={match} />
          ))}
        </div>
      )}
    </Container>
  );
}
