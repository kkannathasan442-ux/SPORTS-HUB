import React from 'react';
import { notFound, redirect } from 'next/navigation';
import { getActiveOrganizationContext } from '@/lib/auth/current-user';
import { getOwnerVenueById, getVenueOperatingHours } from '@/lib/owner/queries';
import { OperatingHoursForm, VenueNavTabs } from '@/components/owner';
import Link from 'next/link';
import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Operating Hours — SportsHub Owner',
};

interface PageProps {
  params: Promise<{
    venueId: string;
  }>;
}

export default async function VenueHoursPage({ params }: PageProps) {
  const context = await getActiveOrganizationContext();
  if (!context || !context.activeOrganization) {
    redirect('/login?error=auth_required');
  }

  const { venueId } = await params;
  const venue = await getOwnerVenueById(context.activeOrganization.id, venueId);

  if (!venue) {
    notFound();
  }

  const hours = await getVenueOperatingHours(venueId);

  return (
    <div className="space-y-6 max-w-5xl mx-auto">
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
          <span className="text-xs font-semibold text-slate-600">Operating Hours</span>
        </div>
        <h1 className="text-2xl font-black text-slate-900">Operating Hours</h1>
      </div>

      <VenueNavTabs venueId={venueId} venueName={venue.name} status={venue.status} />

      <OperatingHoursForm venueId={venueId} initialHours={hours} />
    </div>
  );
}
