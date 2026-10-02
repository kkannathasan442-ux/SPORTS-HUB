import React from 'react';
import { notFound, redirect } from 'next/navigation';
import { getActiveOrganizationContext } from '@/lib/auth/current-user';
import { getOwnerVenueDetail } from '@/lib/owner/queries';
import { VenueNavTabs } from '@/components/owner';
import { Card } from '@/components/ui/Card';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import {
  MapPin,
  Phone,
  Mail,
  Clock,
  Layers,
  Activity,
  DollarSign,
  Wrench,
  Edit,
  Globe,
  ArrowRight,
} from 'lucide-react';
import Link from 'next/link';
import type { Metadata } from 'next';
import type { VenueStatus } from '@sportshub/types';

export const metadata: Metadata = {
  title: 'Venue Overview — SportsHub Owner',
};

interface PageProps {
  params: Promise<{
    venueId: string;
  }>;
}

const DAY_NAMES = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

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

export default async function VenueOverviewPage({ params }: PageProps) {
  const context = await getActiveOrganizationContext();
  if (!context || !context.activeOrganization) {
    redirect('/login?error=auth_required');
  }

  const { venueId } = await params;
  const venue = await getOwnerVenueDetail(context.activeOrganization.id, venueId);

  if (!venue) {
    notFound();
  }

  const activeSports = venue.sports.filter((s) => s.is_active);
  const activeMaintenance = venue.maintenance_blocks.filter((m) => m.status === 'ACTIVE');

  return (
    <div className="space-y-6 max-w-7xl mx-auto">
      {/* Top Header & Breadcrumb */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <Link href="/owner/venues" className="text-xs text-slate-400 hover:text-slate-600">
              Venues
            </Link>
            <span className="text-xs text-slate-300">/</span>
            <span className="text-xs font-semibold text-slate-600 truncate">{venue.name}</span>
          </div>
          <div className="flex items-center gap-3">
            <h1 className="text-2xl font-black text-slate-900">{venue.name}</h1>
            {getVenueStatusBadge(venue.status)}
          </div>
        </div>

        <Link href={`/owner/venues/${venueId}/edit`}>
          <Button size="sm" variant="outline" className="flex items-center gap-1.5 shadow-xs">
            <Edit className="w-3.5 h-3.5" />
            <span>Edit Venue</span>
          </Button>
        </Link>
      </div>

      {/* Tabs */}
      <VenueNavTabs venueId={venueId} venueName={venue.name} status={venue.status} />

      {/* Main Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left 2 Cols: Details, Sports, Facilities */}
        <div className="lg:col-span-2 space-y-6">
          {/* Overview Info Card */}
          <Card className="space-y-4">
            <div className="flex items-center justify-between">
              <h2 className="text-base font-bold text-slate-900">Venue Details</h2>
              <span className="text-xs font-mono text-slate-400">Slug: {venue.slug}</span>
            </div>

            <p className="text-xs text-slate-600 leading-relaxed">
              {venue.description || 'No description provided for this venue.'}
            </p>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-3 border-t border-slate-100 text-xs">
              <div className="flex items-start gap-2.5">
                <MapPin className="w-4 h-4 text-slate-400 shrink-0 mt-0.5" />
                <div>
                  <span className="text-slate-400 block text-[11px]">Address</span>
                  <span className="text-slate-800 font-medium">
                    {[venue.address_line_1, venue.address_line_2, venue.city, venue.district]
                      .filter(Boolean)
                      .join(', ') || 'Not specified'}
                  </span>
                </div>
              </div>

              <div className="flex items-start gap-2.5">
                <Globe className="w-4 h-4 text-slate-400 shrink-0 mt-0.5" />
                <div>
                  <span className="text-slate-400 block text-[11px]">Coordinates & Timezone</span>
                  <span className="text-slate-800 font-medium">
                    {venue.latitude && venue.longitude
                      ? `${venue.latitude}, ${venue.longitude} (${venue.timezone})`
                      : venue.timezone}
                  </span>
                </div>
              </div>

              {venue.phone && (
                <div className="flex items-start gap-2.5">
                  <Phone className="w-4 h-4 text-slate-400 shrink-0 mt-0.5" />
                  <div>
                    <span className="text-slate-400 block text-[11px]">Phone</span>
                    <span className="text-slate-800 font-medium">{venue.phone}</span>
                  </div>
                </div>
              )}

              {venue.email && (
                <div className="flex items-start gap-2.5">
                  <Mail className="w-4 h-4 text-slate-400 shrink-0 mt-0.5" />
                  <div>
                    <span className="text-slate-400 block text-[11px]">Email</span>
                    <span className="text-slate-800 font-medium">{venue.email}</span>
                  </div>
                </div>
              )}
            </div>
          </Card>

          {/* Configured Sports Card */}
          <Card className="space-y-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Activity className="w-4 h-4 text-sports-navy" />
                <h2 className="text-base font-bold text-slate-900">Supported Sports</h2>
                <Badge variant="default" className="text-[10px]">{activeSports.length} active</Badge>
              </div>
              <Link
                href={`/owner/venues/${venueId}/sports`}
                className="text-xs font-bold text-sports-navy hover:underline flex items-center gap-1"
              >
                <span>Manage</span>
                <ArrowRight className="w-3 h-3" />
              </Link>
            </div>

            {venue.sports.length === 0 ? (
              <div className="text-center py-6 text-xs text-slate-500">
                No sports enabled for this venue yet.
              </div>
            ) : (
              <div className="flex flex-wrap gap-2">
                {venue.sports.map((vs) => (
                  <div
                    key={vs.sport_id}
                    className={`px-3 py-1.5 rounded-xl border text-xs font-medium flex items-center gap-2 ${
                      vs.is_active
                        ? 'bg-slate-50 border-slate-200 text-slate-800'
                        : 'bg-slate-50/50 border-slate-100 text-slate-400 line-through'
                    }`}
                  >
                    <span>{vs.sport.name}</span>
                    {vs.is_active && (
                      <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
                    )}
                  </div>
                ))}
              </div>
            )}
          </Card>

          {/* Facilities Summary Card */}
          <Card className="space-y-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Layers className="w-4 h-4 text-sports-navy" />
                <h2 className="text-base font-bold text-slate-900">Facilities / Courts</h2>
                <Badge variant="default" className="text-[10px]">{venue.facilities.length}</Badge>
              </div>
              <Link
                href={`/owner/venues/${venueId}/facilities`}
                className="text-xs font-bold text-sports-navy hover:underline flex items-center gap-1"
              >
                <span>Manage Facilities</span>
                <ArrowRight className="w-3 h-3" />
              </Link>
            </div>

            {venue.facilities.length === 0 ? (
              <div className="text-center py-6 text-xs text-slate-500">
                No courts or pitches configured yet.
              </div>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {venue.facilities.map((fac) => (
                  <div
                    key={fac.id}
                    className="p-3 rounded-xl border border-slate-100 bg-slate-50/50 flex items-center justify-between text-xs"
                  >
                    <div>
                      <div className="font-bold text-slate-900">{fac.name}</div>
                      <div className="text-[11px] text-slate-400">
                        {fac.sport ? fac.sport.name : 'Multi-sport'} • {fac.facility_type || 'Standard'}
                      </div>
                    </div>
                    <Badge variant={fac.status === 'AVAILABLE' ? 'success' : 'warning'} className="text-[10px]">
                      {fac.status}
                    </Badge>
                  </div>
                ))}
              </div>
            )}
          </Card>
        </div>

        {/* Right 1 Col: Operating Hours, Pricing, Maintenance */}
        <div className="space-y-6">
          {/* Operating Schedule */}
          <Card className="space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Clock className="w-4 h-4 text-sports-navy" />
                <h2 className="text-sm font-bold text-slate-900">Operating Hours</h2>
              </div>
              <Link
                href={`/owner/venues/${venueId}/hours`}
                className="text-xs font-bold text-sports-navy hover:underline"
              >
                Edit
              </Link>
            </div>

            <div className="divide-y divide-slate-100 text-xs">
              {venue.operating_hours.map((h) => (
                <div key={h.day_of_week} className="py-1.5 flex justify-between items-center">
                  <span className="font-semibold text-slate-600">{DAY_NAMES[h.day_of_week]}</span>
                  {h.is_closed ? (
                    <span className="text-slate-400 italic">Closed</span>
                  ) : (
                    <span className="font-mono text-slate-800 text-[11px]">
                      {h.open_time?.slice(0, 5)} - {h.close_time?.slice(0, 5)}
                    </span>
                  )}
                </div>
              ))}
            </div>
          </Card>

          {/* Pricing Rules */}
          <Card className="space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <DollarSign className="w-4 h-4 text-sports-navy" />
                <h2 className="text-sm font-bold text-slate-900">Pricing Tiers</h2>
                <Badge variant="default" className="text-[10px]">{venue.pricing_rules.length}</Badge>
              </div>
              <Link
                href={`/owner/venues/${venueId}/pricing`}
                className="text-xs font-bold text-sports-navy hover:underline"
              >
                Manage
              </Link>
            </div>

            {venue.pricing_rules.length === 0 ? (
              <p className="text-xs text-slate-500 py-2">No pricing rules set up.</p>
            ) : (
              <div className="space-y-2">
                {venue.pricing_rules.slice(0, 4).map((p) => (
                  <div
                    key={p.id}
                    className="p-2.5 rounded-lg border border-slate-100 bg-slate-50/50 flex items-center justify-between text-xs"
                  >
                    <div>
                      <div className="font-semibold text-slate-800">{p.name}</div>
                      <div className="text-[10px] text-slate-400 uppercase">{p.pricing_type}</div>
                    </div>
                    <div className="font-bold text-slate-900">
                      {venue.organization.currency} {Number(p.price_per_hour).toFixed(2)}/hr
                    </div>
                  </div>
                ))}
              </div>
            )}
          </Card>

          {/* Maintenance Downtime */}
          <Card className="space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Wrench className="w-4 h-4 text-sports-navy" />
                <h2 className="text-sm font-bold text-slate-900">Maintenance</h2>
                <Badge variant={activeMaintenance.length > 0 ? 'warning' : 'default'} className="text-[10px]">
                  {activeMaintenance.length} active
                </Badge>
              </div>
              <Link
                href={`/owner/venues/${venueId}/maintenance`}
                className="text-xs font-bold text-sports-navy hover:underline"
              >
                Schedule
              </Link>
            </div>

            {activeMaintenance.length === 0 ? (
              <p className="text-xs text-slate-500 py-2">No active maintenance blocks.</p>
            ) : (
              <div className="space-y-2">
                {activeMaintenance.map((m) => (
                  <div
                    key={m.id}
                    className="p-2.5 rounded-lg border border-amber-200 bg-amber-50/50 text-xs"
                  >
                    <div className="font-semibold text-amber-900">{m.reason || 'Downtime'}</div>
                    <div className="text-[10px] font-mono text-amber-700 mt-0.5">
                      {new Date(m.start_at).toLocaleDateString()} - {new Date(m.end_at).toLocaleDateString()}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </Card>
        </div>
      </div>
    </div>
  );
}
