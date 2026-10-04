import React from 'react';
import Link from 'next/link';
import { redirect } from 'next/navigation';
import { getActiveOrganizationContext } from '@/lib/auth/current-user';
import { createSupabaseServerClient } from '@/lib/supabase/server';
import { PageHeader } from '@/components/ui/PageHeader';
import { Card } from '@/components/ui/Card';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { CancelBookingButton } from '@/components/bookings/CancelBookingButton';
import {
  Calendar,
  Clock,
  MapPin,
  Ticket,
  Search,
  CheckCircle2,
  AlertCircle,
  Timer,
  DollarSign,
  TrendingUp,
} from 'lucide-react';
import type { BookingStatus, BookingWithDetails } from '@sportshub/types';

interface OwnerBookingsPageProps {
  searchParams?: {
    venueId?: string;
    status?: string;
    date?: string;
  };
}

export default async function OwnerBookingsPage({ searchParams }: OwnerBookingsPageProps) {
  const context = await getActiveOrganizationContext();
  if (!context || !context.activeOrganization) {
    redirect('/login?redirect=/owner/bookings');
  }

  const org = context.activeOrganization;
  const supabase = await createSupabaseServerClient();

  // Fetch all venues in active org for filter dropdown
  const { data: venues } = await supabase
    .from('venues')
    .select('id, name')
    .eq('organization_id', org.id);

  // Fetch bookings in active org
  let query = supabase
    .from('bookings')
    .select(`
      *,
      venues (
        id,
        name
      ),
      facilities (
        id,
        name,
        facility_type
      ),
      sports (
        id,
        name
      )
    `)
    .eq('organization_id', org.id)
    .order('booking_date', { ascending: false })
    .order('start_time', { ascending: false });

  if (searchParams?.venueId) {
    query = query.eq('venue_id', searchParams.venueId);
  }

  if (searchParams?.status && searchParams.status !== 'all') {
    query = query.eq('status', searchParams.status);
  }

  if (searchParams?.date) {
    query = query.eq('booking_date', searchParams.date);
  }

  const { data: rawBookings } = await query;
  const bookings: BookingWithDetails[] = (rawBookings || []).map((b: any) => ({
    ...b,
    venue: Array.isArray(b.venues) ? b.venues[0] : b.venues,
    facility: Array.isArray(b.facilities) ? b.facilities[0] : b.facilities,
    sport: Array.isArray(b.sports) ? b.sports[0] : b.sports,
  }));

  // Calculate Metrics
  const totalCount = bookings.length;
  const confirmedCount = bookings.filter((b: BookingWithDetails) => b.status === 'CONFIRMED' || b.status === 'COMPLETED').length;
  const holdCount = bookings.filter((b: BookingWithDetails) => b.status === 'HOLD').length;
  const totalRevenue = bookings
    .filter((b: BookingWithDetails) => b.status === 'CONFIRMED' || b.status === 'COMPLETED')
    .reduce((sum: number, b: BookingWithDetails) => sum + Number(b.total_amount || 0), 0);

  const getStatusBadge = (status: BookingStatus) => {
    switch (status) {
      case 'CONFIRMED':
        return <Badge variant="success" className="bg-emerald-100 text-emerald-800 border-emerald-300 font-bold">CONFIRMED</Badge>;
      case 'HOLD':
        return <Badge variant="warning" className="bg-amber-100 text-amber-800 border-amber-300 font-bold">HOLD</Badge>;
      case 'CANCELLED':
        return <Badge variant="error" className="bg-rose-100 text-rose-800 border-rose-300 font-bold">CANCELLED</Badge>;
      case 'COMPLETED':
        return <Badge variant="info" className="bg-blue-100 text-blue-800 border-blue-300 font-bold">COMPLETED</Badge>;
      case 'EXPIRED':
        return <Badge variant="outline" className="text-slate-500 border-slate-300 font-semibold">EXPIRED</Badge>;
      default:
        return <Badge variant="outline">{status}</Badge>;
    }
  };

  return (
    <div className="space-y-6">
      <PageHeader
        title="Reservations & Bookings Ledger"
        description="Monitor real-time court reservations, customer holds, revenue, and walk-in records across all facilities."
      />

      {/* KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card className="p-5 bg-white rounded-2xl border-slate-200/80 shadow-xs flex items-center justify-between">
          <div>
            <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider block">Total Bookings</span>
            <span className="text-2xl font-extrabold text-slate-900 mt-1 block">{totalCount}</span>
          </div>
          <div className="w-11 h-11 rounded-xl bg-slate-100 flex items-center justify-center text-slate-600">
            <Ticket className="w-5 h-5" />
          </div>
        </Card>

        <Card className="p-5 bg-white rounded-2xl border-slate-200/80 shadow-xs flex items-center justify-between">
          <div>
            <span className="text-xs font-semibold text-emerald-600 uppercase tracking-wider block">Confirmed</span>
            <span className="text-2xl font-extrabold text-emerald-700 mt-1 block">{confirmedCount}</span>
          </div>
          <div className="w-11 h-11 rounded-xl bg-emerald-50 text-emerald-600 flex items-center justify-center">
            <CheckCircle2 className="w-5 h-5" />
          </div>
        </Card>

        <Card className="p-5 bg-white rounded-2xl border-slate-200/80 shadow-xs flex items-center justify-between">
          <div>
            <span className="text-xs font-semibold text-amber-600 uppercase tracking-wider block">Active Holds</span>
            <span className="text-2xl font-extrabold text-amber-700 mt-1 block">{holdCount}</span>
          </div>
          <div className="w-11 h-11 rounded-xl bg-amber-50 text-amber-600 flex items-center justify-center">
            <Timer className="w-5 h-5" />
          </div>
        </Card>

        <Card className="p-5 bg-white rounded-2xl border-slate-200/80 shadow-xs flex items-center justify-between">
          <div>
            <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider block">Confirmed Revenue</span>
            <span className="text-2xl font-extrabold text-slate-900 mt-1 block">
              LKR {totalRevenue.toLocaleString()}
            </span>
          </div>
          <div className="w-11 h-11 rounded-xl bg-emerald-500/10 text-emerald-700 flex items-center justify-center">
            <DollarSign className="w-5 h-5" />
          </div>
        </Card>
      </div>

      {/* Filter Toolbar */}
      <Card className="p-4 bg-white rounded-2xl border-slate-200/80 shadow-xs">
        <form method="GET" className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          <div>
            <label htmlFor="venueId" className="block text-xs font-semibold text-slate-500 mb-1">Venue</label>
            <select
              id="venueId"
              name="venueId"
              defaultValue={searchParams?.venueId || ''}
              className="w-full text-xs p-2.5 rounded-xl border border-slate-200 bg-slate-50 font-medium focus:outline-none"
            >
              <option value="">All Venues</option>
              {(venues || []).map((v: { id: string; name: string }) => (
                <option key={v.id} value={v.id}>{v.name}</option>
              ))}
            </select>
          </div>

          <div>
            <label htmlFor="status" className="block text-xs font-semibold text-slate-500 mb-1">Status</label>
            <select
              id="status"
              name="status"
              defaultValue={searchParams?.status || 'all'}
              className="w-full text-xs p-2.5 rounded-xl border border-slate-200 bg-slate-50 font-medium focus:outline-none"
            >
              <option value="all">All Statuses</option>
              <option value="CONFIRMED">Confirmed</option>
              <option value="HOLD">Hold (Pending)</option>
              <option value="COMPLETED">Completed</option>
              <option value="CANCELLED">Cancelled</option>
              <option value="EXPIRED">Expired</option>
            </select>
          </div>

          <div className="flex items-end gap-2">
            <div className="flex-1">
              <label htmlFor="date" className="block text-xs font-semibold text-slate-500 mb-1">Date</label>
              <input
                id="date"
                type="date"
                name="date"
                defaultValue={searchParams?.date || ''}
                className="w-full text-xs p-2.5 rounded-xl border border-slate-200 bg-slate-50 font-medium focus:outline-none"
              />
            </div>
            <Button type="submit" size="sm" className="bg-sports-navy text-white font-semibold py-2.5 px-4 shadow-xs">
              Filter
            </Button>
          </div>
        </form>
      </Card>

      {/* Bookings Table */}
      <Card className="bg-white rounded-2xl border-slate-200/80 shadow-xs overflow-hidden">
        {bookings.length === 0 ? (
          <div className="py-16 text-center text-slate-500">
            <Ticket className="w-10 h-10 text-slate-300 mx-auto mb-2" />
            <p className="text-sm font-bold text-slate-800">No bookings match the selected criteria</p>
            <p className="text-xs text-slate-500 mt-0.5">Try clearing your filters or selecting a different date range.</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs border-collapse">
              <thead>
                <tr className="bg-slate-50 text-slate-500 font-bold border-b border-slate-200/80 uppercase tracking-wider">
                  <th className="p-4">Reference</th>
                  <th className="p-4">Venue & Facility</th>
                  <th className="p-4">Schedule</th>
                  <th className="p-4">Duration</th>
                  <th className="p-4">Status</th>
                  <th className="p-4 text-right">Amount</th>
                  <th className="p-4 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 font-medium text-slate-700">
                {bookings.map((b: BookingWithDetails) => (
                  <tr key={b.id} className="hover:bg-slate-50/70 transition-colors">
                    <td className="p-4 font-mono font-bold text-slate-900">
                      {b.booking_reference}
                    </td>
                    <td className="p-4">
                      <div className="font-bold text-slate-900">{b.facility?.name}</div>
                      <div className="text-[11px] text-slate-500">{b.venue?.name}</div>
                    </td>
                    <td className="p-4">
                      <div className="font-semibold text-slate-900">{b.booking_date}</div>
                      <div className="font-mono text-[11px] text-slate-500">{b.start_time.substring(0, 5)} – {b.end_time.substring(0, 5)}</div>
                    </td>
                    <td className="p-4">
                      {b.duration_minutes} mins
                    </td>
                    <td className="p-4">
                      {getStatusBadge(b.status)}
                    </td>
                    <td className="p-4 text-right font-extrabold text-slate-900">
                      {b.currency} {Number(b.total_amount).toLocaleString()}
                    </td>
                    <td className="p-4 text-right space-x-2 whitespace-nowrap">
                      {b.status === 'CONFIRMED' || b.status === 'HOLD' ? (
                        <CancelBookingButton
                          bookingId={b.id}
                          bookingReference={b.booking_reference}
                        />
                      ) : (
                        <span className="text-[11px] text-slate-400">Archived</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>
    </div>
  );
}
