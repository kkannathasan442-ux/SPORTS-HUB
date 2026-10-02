import React from 'react';
import { redirect } from 'next/navigation';
import { getActiveOrganizationContext } from '@/lib/auth/current-user';
import { getOwnerDashboardSummary, getOwnerVenues } from '@/lib/owner/queries';
import { Card } from '@/components/ui/Card';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import {
  MapPin,
  Layers,
  Activity,
  Wrench,
  Building2,
  PlusCircle,
  Settings,
  ArrowRight,
  ShieldCheck,
} from 'lucide-react';
import Link from 'next/link';
import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Owner Dashboard — SportsHub',
};

export default async function OwnerDashboardPage() {
  let context;
  try {
    context = await getActiveOrganizationContext();
  } catch {
    redirect('/login?error=auth_required');
  }

  if (!context || !context.activeOrganization) {
    redirect('/login?error=auth_required');
  }

  const { activeOrganization, role, profile } = context;
  const summary = await getOwnerDashboardSummary(activeOrganization.id);
  const recentVenues = await getOwnerVenues(activeOrganization.id);

  return (
    <div className="space-y-8 max-w-7xl mx-auto">
      {/* Welcome Banner */}
      <div className="bg-sports-navy text-white rounded-2xl p-6 md:p-8 shadow-sm flex flex-col md:flex-row md:items-center justify-between gap-6">
        <div className="space-y-1">
          <div className="flex items-center gap-2">
            <span className="text-xs font-semibold uppercase tracking-wider text-sports-accent">
              Welcome back, {profile.full_name}
            </span>
            <Badge variant="info" className="text-[10px] py-0 px-2">
              {role}
            </Badge>
          </div>
          <h1 className="text-2xl font-black tracking-tight">{activeOrganization.name}</h1>
          <p className="text-xs text-slate-300 max-w-lg">
            Manage your sports complexes, courts, playing fields, rate tiers, and scheduled facility maintenance from a single unified hub.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          <Link href="/owner/venues/new">
            <Button size="sm" className="bg-sports-accent text-sports-navy font-bold hover:bg-sports-accent/90 shadow-xs flex items-center gap-1.5">
              <PlusCircle className="w-4 h-4" />
              <span>Add Venue</span>
            </Button>
          </Link>
          <Link href="/owner/organization">
            <Button size="sm" variant="outline" className="text-white border-white/30 hover:bg-white/10 flex items-center gap-1.5">
              <Settings className="w-4 h-4" />
              <span>Settings</span>
            </Button>
          </Link>
        </div>
      </div>

      {/* Summary KPI Metrics */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Total Venues */}
        <Card className="p-5 flex items-center gap-4 hover:border-slate-300 transition-colors">
          <div className="w-12 h-12 rounded-2xl bg-blue-50 text-blue-600 flex items-center justify-center shrink-0">
            <MapPin className="w-6 h-6" />
          </div>
          <div>
            <div className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Venues</div>
            <div className="text-2xl font-black text-slate-900 mt-0.5">{summary.totalVenues}</div>
            <div className="text-[11px] text-slate-400 mt-0.5">Operating locations</div>
          </div>
        </Card>

        {/* Total Facilities */}
        <Card className="p-5 flex items-center gap-4 hover:border-slate-300 transition-colors">
          <div className="w-12 h-12 rounded-2xl bg-emerald-50 text-emerald-600 flex items-center justify-center shrink-0">
            <Layers className="w-6 h-6" />
          </div>
          <div>
            <div className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Facilities</div>
            <div className="text-2xl font-black text-slate-900 mt-0.5">{summary.totalFacilities}</div>
            <div className="text-[11px] text-slate-400 mt-0.5">Courts & pitches</div>
          </div>
        </Card>

        {/* Active Sports */}
        <Card className="p-5 flex items-center gap-4 hover:border-slate-300 transition-colors">
          <div className="w-12 h-12 rounded-2xl bg-amber-50 text-amber-600 flex items-center justify-center shrink-0">
            <Activity className="w-6 h-6" />
          </div>
          <div>
            <div className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Active Sports</div>
            <div className="text-2xl font-black text-slate-900 mt-0.5">{summary.activeSportsCount}</div>
            <div className="text-[11px] text-slate-400 mt-0.5">Sporting disciplines</div>
          </div>
        </Card>

        {/* Active Maintenance */}
        <Card className="p-5 flex items-center gap-4 hover:border-slate-300 transition-colors">
          <div className="w-12 h-12 rounded-2xl bg-rose-50 text-rose-600 flex items-center justify-center shrink-0">
            <Wrench className="w-6 h-6" />
          </div>
          <div>
            <div className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Maintenance</div>
            <div className="text-2xl font-black text-slate-900 mt-0.5">{summary.activeMaintenanceBlocksCount}</div>
            <div className="text-[11px] text-slate-400 mt-0.5">Active downtime blocks</div>
          </div>
        </Card>
      </div>

      {/* Quick Actions & Recent Venues */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Venues Overview List */}
        <div className="lg:col-span-2 space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-base font-bold text-slate-900">Your Venues</h2>
            <Link href="/owner/venues" className="text-xs font-bold text-sports-navy hover:underline flex items-center gap-1">
              <span>View All Venues</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </Link>
          </div>

          {recentVenues.length === 0 ? (
            <Card className="text-center py-12 border-dashed border-2 border-slate-200">
              <div className="w-12 h-12 rounded-2xl bg-slate-100 text-slate-400 flex items-center justify-center mx-auto mb-3">
                <MapPin className="w-6 h-6" />
              </div>
              <h3 className="text-sm font-bold text-slate-800">No Venues Registered</h3>
              <p className="text-xs text-slate-500 max-w-sm mx-auto mt-1 mb-4">
                Get started by creating your first sports complex, stadium, or court venue.
              </p>
              <Link href="/owner/venues/new">
                <Button size="sm" className="inline-flex items-center gap-1.5 shadow-xs">
                  <PlusCircle className="w-4 h-4" />
                  <span>Create First Venue</span>
                </Button>
              </Link>
            </Card>
          ) : (
            <div className="space-y-3">
              {recentVenues.slice(0, 4).map((venue) => (
                <Card
                  key={venue.id}
                  className="p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-4 hover:border-slate-300 transition-colors"
                >
                  <div className="flex items-center gap-3.5">
                    <div className="w-10 h-10 rounded-xl bg-slate-100 text-slate-600 flex items-center justify-center shrink-0">
                      <Building2 className="w-5 h-5 text-sports-navy" />
                    </div>
                    <div>
                      <div className="flex items-center gap-2">
                        <h3 className="text-sm font-bold text-slate-900">{venue.name}</h3>
                        <Badge
                          variant={
                            venue.status === 'ACTIVE'
                              ? 'success'
                              : venue.status === 'DRAFT'
                              ? 'warning'
                              : 'default'
                          }
                          className="text-[10px] py-0 px-2"
                        >
                          {venue.status}
                        </Badge>
                      </div>
                      <p className="text-xs text-slate-500 mt-0.5">
                        {[venue.city, venue.district].filter(Boolean).join(', ') || 'Address not specified'}
                      </p>
                    </div>
                  </div>

                  <div className="flex items-center gap-4 self-end sm:self-auto">
                    <div className="text-right text-xs">
                      <div className="font-bold text-slate-900">{venue.facility_count} Courts / Facilities</div>
                      <div className="text-slate-400 text-[11px]">{venue.sports_count} Sports Active</div>
                    </div>
                    <Link href={`/owner/venues/${venue.id}`}>
                      <Button variant="outline" size="sm" className="h-8 text-xs px-3">
                        Manage &rarr;
                      </Button>
                    </Link>
                  </div>
                </Card>
              ))}
            </div>
          )}
        </div>

        {/* Security & Organization Quick Card */}
        <div className="space-y-4">
          <h2 className="text-base font-bold text-slate-900">Organization Info</h2>
          <Card className="space-y-4 p-5">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-sports-navy text-white flex items-center justify-center shrink-0">
                <Building2 className="w-5 h-5" />
              </div>
              <div>
                <h3 className="text-sm font-bold text-slate-900">{activeOrganization.name}</h3>
                <p className="text-xs text-slate-400 font-mono">/{activeOrganization.slug}</p>
              </div>
            </div>

            <div className="space-y-2 pt-3 border-t border-slate-100 text-xs">
              <div className="flex justify-between py-1 border-b border-slate-50">
                <span className="text-slate-500">Currency</span>
                <span className="font-semibold text-slate-800">{activeOrganization.currency}</span>
              </div>
              <div className="flex justify-between py-1 border-b border-slate-50">
                <span className="text-slate-500">Timezone</span>
                <span className="font-semibold text-slate-800">{activeOrganization.timezone}</span>
              </div>
              <div className="flex justify-between py-1 border-b border-slate-50">
                <span className="text-slate-500">Your Role</span>
                <span className="font-bold text-emerald-600">{role}</span>
              </div>
              <div className="flex justify-between py-1">
                <span className="text-slate-500">Tenant Isolation</span>
                <span className="font-semibold text-emerald-600 flex items-center gap-1">
                  <ShieldCheck className="w-3.5 h-3.5" /> PostgreSQL RLS
                </span>
              </div>
            </div>

            <div className="pt-3 border-t border-slate-100">
              <Link href="/owner/organization" className="block">
                <Button variant="outline" size="sm" className="w-full text-xs flex items-center justify-center gap-1.5">
                  <Settings className="w-3.5 h-3.5" />
                  <span>Manage Organization Settings</span>
                </Button>
              </Link>
            </div>
          </Card>
        </div>
      </div>
    </div>
  );
}
