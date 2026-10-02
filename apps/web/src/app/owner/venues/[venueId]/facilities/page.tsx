import React from 'react';
import { notFound, redirect } from 'next/navigation';
import { getActiveOrganizationContext } from '@/lib/auth/current-user';
import { getOwnerVenueById, getVenueFacilities, getVenueSports } from '@/lib/owner/queries';
import { FacilityList, VenueNavTabs } from '@/components/owner';
import Link from 'next/link';
import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Venue Facilities — SportsHub Owner',
};

interface PageProps {
  params: Promise<{
    venueId: string;
  }>;
}

export default async function VenueFacilitiesPage({ params }: PageProps) {
  const context = await getActiveOrganizationContext();
  if (!context || !context.activeOrganization) {
    redirect('/login?error=auth_required');
  }

  const { venueId } = await params;
  const venue = await getOwnerVenueById(context.activeOrganization.id, venueId);

  if (!venue) {
    notFound();
  }

  const [facilities, venueSports] = await Promise.all([
    getVenueFacilities(venueId),
    getVenueSports(venueId),
  ]);

  return (
    <div className="space-y-6 max-w-7xl mx-auto">
      <div>
        <div className="flex items-center gap-2 mb-1">
          <Link href="/owner/venues" className="text-xs text-slate-400 hover:text-slate-600">
            Venues
          </Link>
          <span className="text-xs text-slate-300">/</span>
          <Link href={`/owner/venues/${venueId}`} className="text-xs text-slate-400 hover:text-slate-600">
            {venue.name}
          </Link>
          <span className="text-xs text-slate-300">/</span>
          <span className="text-xs font-semibold text-slate-600">Facilities</span>
        </div>
        <h1 className="text-2xl font-black text-slate-900">Facilities & Courts</h1>
      </div>

      <VenueNavTabs venueId={venueId} venueName={venue.name} status={venue.status} />

      <FacilityList
        venueId={venueId}
        facilities={facilities}
        venueSports={venueSports}
      />
    </div>
  );
}
