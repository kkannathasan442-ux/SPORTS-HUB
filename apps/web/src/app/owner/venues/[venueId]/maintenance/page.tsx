import React from 'react';
import { notFound, redirect } from 'next/navigation';
import { getActiveOrganizationContext } from '@/lib/auth/current-user';
import {
  getOwnerVenueById,
  getVenueMaintenanceBlocks,
  getVenueFacilities,
} from '@/lib/owner/queries';
import { MaintenanceBlocksManager, VenueNavTabs } from '@/components/owner';
import Link from 'next/link';
import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Maintenance Schedule — SportsHub Owner',
};

interface PageProps {
  params: Promise<{
    venueId: string;
  }>;
}

export default async function VenueMaintenancePage({ params }: PageProps) {
  const context = await getActiveOrganizationContext();
  if (!context || !context.activeOrganization) {
    redirect('/login?error=auth_required');
  }

  const { venueId } = await params;
  const orgId = context.activeOrganization.id;

  const [venue, maintenanceBlocks, facilities] = await Promise.all([
    getOwnerVenueById(orgId, venueId),
    getVenueMaintenanceBlocks(orgId, venueId),
    getVenueFacilities(venueId),
  ]);

  if (!venue) {
    notFound();
  }

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
          <span className="text-xs font-semibold text-slate-600">Maintenance</span>
        </div>
        <h1 className="text-2xl font-black text-slate-900">Maintenance Downtime</h1>
      </div>

      <VenueNavTabs venueId={venueId} venueName={venue.name} status={venue.status} />

      <MaintenanceBlocksManager
        venueId={venueId}
        maintenanceBlocks={maintenanceBlocks}
        facilities={facilities}
      />
    </div>
  );
}
