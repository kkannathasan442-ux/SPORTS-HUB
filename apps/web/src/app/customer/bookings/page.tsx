import React from 'react';
import Link from 'next/link';
import { redirect } from 'next/navigation';
import { createSupabaseServerClient } from '@/lib/supabase/server';
import { getCustomerBookings } from '@/lib/bookings/queries';
import { Container } from '@/components/ui/Container';
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
  ChevronRight,
  PlusCircle,
  CheckCircle2,
  AlertCircle,
  Timer,
  Trophy,
} from 'lucide-react';
import type { BookingStatus } from '@sportshub/types';

interface CustomerBookingsPageProps {
  searchParams?: {
    tab?: string;
  };
}

export default async function CustomerBookingsPage({ searchParams }: CustomerBookingsPageProps) {
  const supabase = await createSupabaseServerClient();

  // Get current user
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect('/login?error=auth_required');
  }

  const activeTab = searchParams?.tab || 'all';

  // Fetch all customer bookings
  const bookings = await getCustomerBookings(supabase, user.id);

  // Filter based on tab
  const todayStr = new Date().toISOString().split('T')[0];

  const filteredBookings = bookings.filter((b) => {
    if (activeTab === 'upcoming') {
      return (b.status === 'CONFIRMED' || b.status === 'HOLD') && b.booking_date >= todayStr;
    }
    if (activeTab === 'holds') {
      return b.status === 'HOLD';
    }
    if (activeTab === 'completed') {
      return b.status === 'COMPLETED' || (b.status === 'CONFIRMED' && b.booking_date < todayStr);
    }
    if (activeTab === 'cancelled') {
      return b.status === 'CANCELLED' || b.status === 'EXPIRED' || b.status === 'NO_SHOW';
    }
    return true; // 'all'
  });

  const getStatusBadge = (status: BookingStatus) => {
    switch (status) {
      case 'CONFIRMED':
        return <Badge variant="success" className="bg-emerald-100 text-emerald-800 border-emerald-300 font-bold">CONFIRMED</Badge>;
      case 'HOLD':
        return <Badge variant="warning" className="bg-amber-100 text-amber-800 border-amber-300 font-bold">HOLD (10 MINS)</Badge>;
      case 'CANCELLED':
        return <Badge variant="error" className="bg-rose-100 text-rose-800 border-rose-300 font-bold">CANCELLED</Badge>;
      case 'COMPLETED':
        return <Badge variant="info" className="bg-blue-100 text-blue-800 border-blue-300 font-bold">COMPLETED</Badge>;
      case 'EXPIRED':
        return <Badge variant="outline" className="text-slate-500 border-slate-300 font-semibold">EXPIRED</Badge>;
      case 'NO_SHOW':
        return <Badge variant="error" className="bg-purple-100 text-purple-800 border-purple-300 font-bold">NO SHOW</Badge>;
      default:
        return <Badge variant="outline">{status}</Badge>;
    }
  };

  return (
    <div className="min-h-screen bg-slate-50/60 pb-16">
      <Container className="py-8">
        <PageHeader
          title="My Bookings & Reservations"
          description="View and manage all your sport court holds, confirmed reservations, and receipts."
          action={
            <Link href="/search">
              <Button className="bg-slate-900 hover:bg-slate-800 text-white font-bold shadow-sm">
                <PlusCircle className="w-4 h-4 mr-2" />
                Book a Court
              </Button>
            </Link>
          }
        />

        {/* Tab Filters */}
        <div className="flex items-center gap-2 overflow-x-auto pb-2 mb-6 border-b border-slate-200">
          {[
            { key: 'all', label: 'All Bookings', count: bookings.length },
            {
              key: 'upcoming',
              label: 'Upcoming',
              count: bookings.filter((b) => (b.status === 'CONFIRMED' || b.status === 'HOLD') && b.booking_date >= todayStr).length,
            },
            {
              key: 'holds',
              label: 'Active Holds',
              count: bookings.filter((b) => b.status === 'HOLD').length,
            },
            {
              key: 'completed',
              label: 'Completed / Past',
              count: bookings.filter((b) => b.status === 'COMPLETED' || (b.status === 'CONFIRMED' && b.booking_date < todayStr)).length,
            },
            {
              key: 'cancelled',
              label: 'Cancelled',
              count: bookings.filter((b) => b.status === 'CANCELLED' || b.status === 'EXPIRED').length,
            },
          ].map((tab) => {
            const isActive = activeTab === tab.key;
            return (
              <Link
                key={tab.key}
                href={`/customer/bookings?tab=${tab.key}`}
                className={`flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-semibold transition-all whitespace-nowrap ${
                  isActive
                    ? 'bg-slate-900 text-white shadow-sm'
                    : 'bg-white text-slate-600 hover:bg-slate-100/80 border border-slate-200'
                }`}
              >
                <span>{tab.label}</span>
                <span
                  className={`text-xs px-2 py-0.5 rounded-full ${
                    isActive ? 'bg-slate-800 text-slate-200' : 'bg-slate-100 text-slate-500'
                  }`}
                >
                  {tab.count}
                </span>
              </Link>
            );
          })}
        </div>

        {/* Bookings List */}
        {filteredBookings.length === 0 ? (
          <Card className="py-16 text-center bg-white rounded-2xl border-slate-200 shadow-sm max-w-lg mx-auto">
            <Ticket className="w-12 h-12 text-slate-300 mx-auto mb-3" />
            <h3 className="text-lg font-bold text-slate-900">No bookings found</h3>
            <p className="text-sm text-slate-500 mt-1 max-w-xs mx-auto">
              You don&apos;t have any reservations matching the &quot;{activeTab}&quot; filter.
            </p>
            <div className="mt-6">
              <Link href="/search">
                <Button className="bg-emerald-600 hover:bg-emerald-500 text-white font-bold">
                  Browse Venues & Courts
                </Button>
              </Link>
            </div>
          </Card>
        ) : (
          <div className="space-y-4">
            {filteredBookings.map((b) => {
              const canCancel = (b.status === 'CONFIRMED' || b.status === 'HOLD') && b.booking_date >= todayStr;

              return (
                <Card
                  key={b.id}
                  className="p-6 rounded-2xl bg-white border-slate-200 hover:border-slate-300 transition-all shadow-sm flex flex-col md:flex-row items-start md:items-center justify-between gap-6"
                >
                  {/* Left: Info */}
                  <div className="space-y-3 flex-1">
                    <div className="flex flex-wrap items-center gap-2.5">
                      <span className="font-mono text-xs font-bold text-slate-500 bg-slate-100 px-2.5 py-1 rounded-lg border border-slate-200">
                        {b.booking_reference}
                      </span>
                      {getStatusBadge(b.status)}
                      {b.sport && (
                        <Badge variant="info" className="bg-slate-50 text-slate-700 border-slate-200 text-xs">
                          {b.sport.name}
                        </Badge>
                      )}
                    </div>

                    <div>
                      <h3 className="text-lg font-extrabold text-slate-900 flex items-center gap-2">
                        {b.facility?.name || 'Sports Facility'}
                      </h3>
                      <p className="text-sm text-slate-600 flex items-center gap-1.5 mt-0.5">
                        <MapPin className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                        <span>{b.venue?.name || 'SportsHub Venue'}</span>
                        {b.venue?.city && <span className="text-slate-400">· {b.venue.city}</span>}
                      </p>
                    </div>

                    <div className="flex flex-wrap items-center gap-4 text-xs font-medium text-slate-600 pt-1">
                      <div className="flex items-center gap-1.5">
                        <Calendar className="w-4 h-4 text-emerald-600 shrink-0" />
                        <span>{b.booking_date}</span>
                      </div>
                      <div className="flex items-center gap-1.5">
                        <Clock className="w-4 h-4 text-emerald-600 shrink-0" />
                        <span className="font-mono">{b.start_time.substring(0, 5)} – {b.end_time.substring(0, 5)}</span>
                        <span className="text-slate-400">({b.duration_minutes} mins)</span>
                      </div>
                    </div>
                  </div>

                  {/* Right: Price & Actions */}
                  <div className="flex flex-row md:flex-col items-end justify-between md:justify-center w-full md:w-auto pt-4 md:pt-0 border-t md:border-t-0 border-slate-100 gap-4">
                    <div className="text-left md:text-right">
                      <span className="text-xs text-slate-400 uppercase tracking-wider block">Total Amount</span>
                      <span className="text-xl font-extrabold text-slate-900">
                        {b.currency} {Number(b.total_amount).toLocaleString()}
                      </span>
                    </div>

                    <div className="flex items-center gap-2">
                      {canCancel && (
                        <CancelBookingButton
                          bookingId={b.id}
                          bookingReference={b.booking_reference}
                        />
                      )}

                      <Link href={`/customer/bookings/${b.id}`}>
                        <Button
                          variant="primary"
                          size="sm"
                          className="bg-slate-900 hover:bg-slate-800 text-white font-semibold"
                        >
                          <Ticket className="w-3.5 h-3.5 mr-1.5" />
                          View Receipt
                        </Button>
                      </Link>
                    </div>
                  </div>
                </Card>
              );
            })}
          </div>
        )}
      </Container>
    </div>
  );
}
