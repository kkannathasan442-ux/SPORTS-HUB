import React from 'react';
import { Container } from '@/components/ui/Container';
import { SearchPageView } from '@/components/discovery/SearchPageView';
import { getActivePlatformSports } from '@/lib/discovery/public-venue';
import { searchPublicVenues } from '@/lib/discovery/search-venues';
import { venueSearchParamsSchema } from '@sportshub/validation';
import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Sports Venues Directory — SportsHub',
  description:
    'Browse all verified sports venues, complexes, and playing facilities across Sri Lanka.',
};

interface VenuesPageProps {
  searchParams: Promise<{ [key: string]: string | string[] | undefined }> | { [key: string]: string | string[] | undefined };
}

export default async function VenuesPage(props: VenuesPageProps) {
  const resolvedSearchParams = await props.searchParams;

  const rawParams: Record<string, any> = {};
  for (const [key, value] of Object.entries(resolvedSearchParams || {})) {
    if (Array.isArray(value)) {
      rawParams[key] = value[0];
    } else {
      rawParams[key] = value;
    }
  }

  const parsed = venueSearchParamsSchema.safeParse(rawParams);
  const validatedParams = parsed.success ? parsed.data : {};

  const [sports, results] = await Promise.all([
    getActivePlatformSports(),
    searchPublicVenues(validatedParams),
  ]);

  return (
    <div className="py-8">
      <Container>
        <SearchPageView
          sports={sports}
          results={results}
          appliedParams={validatedParams}
        />
      </Container>
    </div>
  );
}
