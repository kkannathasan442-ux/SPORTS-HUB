import React from 'react';
import { Container } from '@/components/ui/Container';
import { SearchPageView } from '@/components/discovery/SearchPageView';
import { getActivePlatformSports } from '@/lib/discovery/public-venue';
import { searchPublicVenues } from '@/lib/discovery/search-venues';
import { searchFacilities } from '@/lib/discovery/search-facilities';
import { venueSearchParamsSchema } from '@sportshub/validation';
import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Discover Sports Venues & Courts — SportsHub',
  description:
    'Search sports venues by sport, location, distance, price, and real-time court availability across Sri Lanka.',
};

interface SearchPageProps {
  searchParams: Promise<{ [key: string]: string | string[] | undefined }> | { [key: string]: string | string[] | undefined };
}

export default async function SearchPage(props: SearchPageProps) {
  const resolvedSearchParams = await props.searchParams;

  // Flatten searchParams
  const rawParams: Record<string, any> = {};
  for (const [key, value] of Object.entries(resolvedSearchParams || {})) {
    if (Array.isArray(value)) {
      rawParams[key] = value[0];
    } else {
      rawParams[key] = value;
    }
  }

  // Parse and validate with zod schema
  const parsed = venueSearchParamsSchema.safeParse(rawParams);
  const validatedParams = parsed.success ? parsed.data : ({} as any);

  const isSlotSearch = Boolean(validatedParams.date && validatedParams.startTime);

  // Fetch sports and search results
  const [sports, results, facilityResults] = await Promise.all([
    getActivePlatformSports(),
    !isSlotSearch ? searchPublicVenues(validatedParams) : Promise.resolve(null),
    isSlotSearch ? searchFacilities(validatedParams) : Promise.resolve(null),
  ]);

  return (
    <div className="py-8">
      <Container>
        <SearchPageView
          sports={sports}
          results={results}
          facilityResults={facilityResults}
          appliedParams={validatedParams}
        />
      </Container>
    </div>
  );
}
