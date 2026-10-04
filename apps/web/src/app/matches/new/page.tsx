import React from 'react';
import { Metadata } from 'next';
import { PageHeader } from '@/components/ui/PageHeader';
import { Container } from '@/components/ui/Container';
import { MatchForm } from '@/components/matches/MatchForm';
import { getGlobalActiveSports } from '@/lib/owner/queries';

export const metadata: Metadata = {
  title: 'Create Match | SportsHub',
};

export default async function CreateMatchPage() {
  const sports = await getGlobalActiveSports();

  return (
    <Container className="py-8">
      <PageHeader 
        title="Create Match" 
        description="Set up a new match, practice session, or competitive game."
      />

      <div className="mt-8">
        <MatchForm sports={sports} />
      </div>
    </Container>
  );
}
