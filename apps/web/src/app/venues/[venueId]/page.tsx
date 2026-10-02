import React from 'react';
import { notFound } from 'next/navigation';
import { Container } from '@/components/ui/Container';
import { PublicVenueDetails } from '@/components/discovery/PublicVenueDetails';
import { getPublicVenueById } from '@/lib/discovery/public-venue';
import { venueSearchParamsSchema } from '@sportshub/validation';
import type { VenueSearchParams } from '@sportshub/types';
import type { Metadata } from 'next';

interface VenueDetailPageProps {
  params: Promise<{ venueId: string }> | { venueId: string };
  searchParams: Promise<{ [key: string]: string | string[] | undefined }> | { [key: string]: string | string[] | undefined };
}

export async function generateMetadata(props: VenueDetailPageProps): Promise<Metadata> {
  const resolvedParams = await props.params;
  const venue = await getPublicVenueById(resolvedParams.venueId);

  if (!venue) {
    return {
      title: 'Venue Not Found — SportsHub',
    };
  }

  return {
    title: `${venue.name} — SportsHub`,
    description:
      venue.description ||
      `Find courts, sports facilities, and real-time availability at ${venue.name} in ${venue.city || 'Sri Lanka'}.`,
    openGraph: {
      title: `${venue.name} — SportsHub`,
      description: venue.description || `Sports venue in ${venue.city || 'Sri Lanka'}`,
      images: venue.cover_image_url ? [venue.cover_image_url] : [],
    },
  };
}

export default async function VenueDetailPage(props: VenueDetailPageProps) {
  const resolvedParams = await props.params;
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
  const validatedParams: VenueSearchParams = parsed.success ? parsed.data : {};

  const venue = await getPublicVenueById(resolvedParams.venueId, validatedParams);

  if (!venue) {
    return (
      <div className="py-20">
        <Container className="max-w-md text-center space-y-6">
          <div className="w-16 h-16 rounded-3xl bg-slate-100 text-slate-400 flex items-center justify-center mx-auto">
            <span className="text-2xl font-bold text-slate-600">404</span>
          </div>

          <div className="space-y-2">
            <h1 className="text-3xl font-black text-slate-900 tracking-tight">Venue Listing Not Found</h1>
            <p className="text-xs text-slate-500 leading-relaxed">
              The requested venue does not exist, has been archived, or is currently not available for public discovery.
            </p>
          </div>

          <div className="pt-2 flex flex-col sm:flex-row items-center justify-center gap-3">
            <a
              href="/search"
              className="w-full sm:w-auto text-xs font-bold px-4 py-2 bg-sports-navy text-white rounded-xl shadow-md text-center"
            >
              Discover Active Venues
            </a>
            <a
              href="/"
              className="w-full sm:w-auto text-xs font-bold px-4 py-2 border border-slate-200 text-slate-700 rounded-xl hover:bg-slate-50 text-center"
            >
              Back Home
            </a>
          </div>
        </Container>
      </div>
    );
  }

  return (
    <div className="py-8">
      <Container>
        <PublicVenueDetails
          venue={venue}
          initialDate={validatedParams.date}
          initialTime={validatedParams.startTime}
        />
      </Container>
    </div>
  );
}
