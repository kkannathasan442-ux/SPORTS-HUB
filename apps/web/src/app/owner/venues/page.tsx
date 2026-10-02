import React from 'react';
import { redirect } from 'next/navigation';
import { getActiveOrganizationContext } from '@/lib/auth/current-user';
import { getOwnerVenues } from '@/lib/owner/queries';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Badge } from '@/components/ui/Badge';
import {
  MapPin,
  PlusCircle,
  Search,
  Building2,
  Calendar,
  Layers,
  Activity,
  Edit,
  ExternalLink,
} from 'lucide-react';
import Link from 'next/link';
import type { Metadata } from 'next';
import type { VenueStatus } from '@sportshub/types';

export const metadata: Metadata = {
  title: 'Venues & Complexes — SportsHub Owner',
};

interface PageProps {
  searchParams?: Promise<{
    search?: string;
    status?: string;
  }>;
}

function getVenueStatusBadge(status: VenueStatus) {
  switch (status) {
    case 'ACTIVE':
      return <Badge variant="success">ACTIVE</Badge>;
    case 'DRAFT':
      return <Badge variant="warning">DRAFT</Badge>;
    case 'SUSPENDED':
      return <Badge variant="error">SUSPENDED</Badge>;
    case 'CLOSED':
      return <Badge variant="default">CLOSED</Badge>;
    case 'ARCHIVED':
      return <Badge variant="default">ARCHIVED</Badge>;
    default:
      return <Badge variant="outline">{status}</Badge>;
  }
}

export default async function OwnerVenuesPage({ searchParams }: PageProps) {
  let context;
  try {
    context = await getActiveOrganizationContext();
  } catch {
    redirect('/login?error=auth_required');
  }

  if (!context || !context.activeOrganization) {
    redirect('/login?error=auth_required');
  }

  const { activeOrganization } = context;
  const resolvedParams = searchParams ? await searchParams : {};
  const search = resolvedParams.search;
  const statusFilter = resolvedParams.status as VenueStatus | undefined;

  const venues = await getOwnerVenues(activeOrganization.id, {
    search,
    status: statusFilter,
  });

  return (
    <div className="space-y-6 max-w-7xl mx-auto">
      {/* Page Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-xl font-bold text-slate-900">Venues & Sports Complexes</h1>
          <p className="text-xs text-slate-500 mt-1">
            Manage your physical sports locations, addresses, court capacities, and operational settings.
          </p>
        </div>

        <Link href="/owner/venues/new">
          <Button size="sm" className="shadow-xs flex items-center gap-1.5 self-start sm:self-auto">
            <PlusCircle className="w-4 h-4" />
            <span>Add Venue</span>
          </Button>
        </Link>
      </div>

      {/* Filter / Search Bar */}
      <Card className="p-3.5 bg-white">
        <form method="GET" className="flex flex-col sm:flex-row gap-3">
          <div className="relative flex-1">
            <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
              type="text"
              name="search"
              defaultValue={search || ''}
              placeholder="Search by venue name, city, or district..."
              className="w-full pl-9 pr-3.5 py-2 rounded-xl border border-slate-200 text-xs focus:outline-none focus:ring-2 focus:ring-sports-navy"
            />
          </div>

          <div className="flex items-center gap-2">
            <select
              name="status"
              defaultValue={statusFilter || ''}
              className="px-3 py-2 rounded-xl border border-slate-200 text-xs focus:outline-none focus:ring-2 focus:ring-sports-navy bg-white"
            >
              <option value="">All Statuses</option>
              <option value="ACTIVE">ACTIVE</option>
              <option value="DRAFT">DRAFT</option>
              <option value="SUSPENDED">SUSPENDED</option>
              <option value="CLOSED">CLOSED</option>
              <option value="ARCHIVED">ARCHIVED</option>
            </select>

            <Button type="submit" size="sm" variant="outline" className="text-xs px-3">
              Filter
            </Button>

            {(search || statusFilter) && (
              <Link href="/owner/venues">
                <Button type="button" size="sm" variant="ghost" className="text-xs text-slate-500">
                  Clear
                </Button>
              </Link>
            )}
          </div>
        </form>
      </Card>

      {/* Venues Grid / Table */}
      {venues.length === 0 ? (
        <Card className="text-center py-16 border-dashed border-2 border-slate-200">
          <div className="w-14 h-14 rounded-2xl bg-slate-100 text-slate-400 flex items-center justify-center mx-auto mb-3">
            <MapPin className="w-7 h-7" />
          </div>
          <h3 className="text-sm font-bold text-slate-800">
            {search || statusFilter ? 'No Venues Match Filter' : 'No Venues Found'}
          </h3>
          <p className="text-xs text-slate-500 max-w-sm mx-auto mt-1 mb-4">
            {search || statusFilter
              ? 'Try changing your search terms or clearing status filters.'
              : 'Add your first sports venue to begin setting up courts and pricing tiers.'}
          </p>
          <Link href="/owner/venues/new">
            <Button size="sm" className="inline-flex items-center gap-1.5 shadow-xs">
              <PlusCircle className="w-4 h-4" />
              <span>Create New Venue</span>
            </Button>
          </Link>
        </Card>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
          {venues.map((venue) => {
            const updatedDate = new Date(venue.updated_at).toLocaleDateString(undefined, {
              month: 'short',
              day: 'numeric',
              year: 'numeric',
            });

            return (
              <Card
                key={venue.id}
                className="p-5 flex flex-col justify-between hover:border-slate-300 transition-all hover:shadow-md"
              >
                <div>
                  <div className="flex items-start justify-between gap-3 mb-3">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-xl bg-slate-100 text-sports-navy flex items-center justify-center shrink-0">
                        <Building2 className="w-5 h-5" />
                      </div>
                      <div>
                        <h2 className="text-sm font-bold text-slate-900 line-clamp-1" title={venue.name}>
                          {venue.name}
                        </h2>
                        <p className="text-[11px] font-mono text-slate-400">/{venue.slug}</p>
                      </div>
                    </div>
                    {getVenueStatusBadge(venue.status)}
                  </div>

                  <p className="text-xs text-slate-500 line-clamp-2 mt-2 mb-4">
                    {venue.description || 'No description provided.'}
                  </p>

                  <div className="space-y-2 py-3 border-y border-slate-100 text-xs text-slate-600">
                    <div className="flex items-center justify-between">
                      <span className="text-slate-400 flex items-center gap-1">
                        <MapPin className="w-3.5 h-3.5 text-slate-400" /> Location
                      </span>
                      <span className="font-medium text-slate-800 truncate max-w-[160px]">
                        {[venue.city, venue.district].filter(Boolean).join(', ') || 'Not specified'}
                      </span>
                    </div>

                    <div className="flex items-center justify-between">
                      <span className="text-slate-400 flex items-center gap-1">
                        <Layers className="w-3.5 h-3.5 text-slate-400" /> Facilities
                      </span>
                      <span className="font-semibold text-slate-900">{venue.facility_count} Courts</span>
                    </div>

                    <div className="flex items-center justify-between">
                      <span className="text-slate-400 flex items-center gap-1">
                        <Activity className="w-3.5 h-3.5 text-slate-400" /> Sports
                      </span>
                      <span className="font-semibold text-slate-900">{venue.sports_count} Sports</span>
                    </div>

                    <div className="flex items-center justify-between">
                      <span className="text-slate-400 flex items-center gap-1">
                        <Calendar className="w-3.5 h-3.5 text-slate-400" /> Updated
                      </span>
                      <span className="text-slate-500">{updatedDate}</span>
                    </div>
                  </div>
                </div>

                <div className="pt-4 mt-2 flex items-center justify-between gap-2">
                  <Link href={`/owner/venues/${venue.id}/edit`} className="flex-1">
                    <Button variant="outline" size="sm" className="w-full text-xs flex items-center justify-center gap-1">
                      <Edit className="w-3 h-3" />
                      <span>Edit</span>
                    </Button>
                  </Link>

                  <Link href={`/owner/venues/${venue.id}`} className="flex-1">
                    <Button size="sm" className="w-full text-xs flex items-center justify-center gap-1 shadow-xs">
                      <span>Manage</span>
                      <ExternalLink className="w-3 h-3" />
                    </Button>
                  </Link>
                </div>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}
