import React from 'react';
import Link from 'next/link';
import { redirect } from 'next/navigation';
import { requireAuth } from '@/lib/auth/authorization';
import {
  getCustomerAccountProfile,
  getCustomerAccountStats,
  getCustomerBookingHistory,
} from '@/lib/customer/customer-service';
import { getUserNotifications } from '@/lib/notifications/notification-service';
import { createSupabaseServerClient } from '@/lib/supabase/server';
import { Container } from '@/components/ui/Container';
import { Card } from '@/components/ui/Card';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import {
  User,
  Calendar,
  CreditCard,
  Bell,
  MapPin,
  Clock,
  ChevronRight,
  PlusCircle,
  Sparkles,
  Ticket,
  ShieldCheck,
  Timer,
  CheckCircle2,
  Sliders,
} from 'lucide-react';
import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Customer Dashboard — SportsHub',
};

export default async function CustomerDashboardPage() {
  let authContext;
  try {
    authContext = await requireAuth();
  } catch {
    redirect('/login?error=auth_required');
  }

  const { user } = authContext;
  const profile = await getCustomerAccountProfile(user.id);

  if (!profile) {
    redirect('/login?error=auth_required');
  }

  const supabase = await createSupabaseServerClient();
  const stats = await getCustomerAccountStats(user.id);
  const { bookings: recentBookings } = await getCustomerBookingHistory(user.id, 'all', 1, 3);
  const { notifications: recentNotifs } = await getUserNotifications(supabase, user.id, { page: 1, limit: 3 });

  // Next upcoming booking
  const upcomingBooking = recentBookings.find(
    (b) => (b.status === 'CONFIRMED' || b.status === 'HOLD') && b.booking_date >= new Date().toISOString().split('T')[0]
  );

  return (
    <div className="min-h-screen bg-slate-50/60 pb-16">
      <Container className="py-8 space-y-6 max-w-5xl mx-auto">
        {/* Welcome Header */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 p-6 rounded-2xl bg-gradient-to-r from-sports-navy to-sports-deep text-white shadow-md">
          <div className="flex items-center gap-4">
            <div className="w-14 h-14 rounded-2xl bg-white/10 text-white font-bold flex items-center justify-center text-xl shrink-0 border border-white/20">
              {profile.full_name?.charAt(0).toUpperCase() || 'A'}
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-xl font-bold">
                  Welcome back, {profile.display_name || profile.full_name}
                </h1>
                <span className="px-2 py-0.5 rounded-full text-[10px] font-extrabold bg-sports-accent text-sports-navy uppercase tracking-wider">
                  Athlete
                </span>
              </div>
              <p className="text-xs text-slate-200 mt-0.5">
                {profile.email} • Timezone: {profile.timezone}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <Link href="/search">
              <Button size="sm" className="bg-sports-accent hover:bg-sports-accent/90 text-sports-navy font-bold shadow-xs gap-1.5 text-xs">
                <PlusCircle className="w-4 h-4" />
                <span>Book Court</span>
              </Button>
            </Link>
            <Link href="/customer/account">
              <Button size="sm" variant="outline" className="bg-white/10 text-white hover:bg-white/20 border-white/20 text-xs gap-1.5">
                <Sliders className="w-4 h-4" />
                <span>Settings</span>
              </Button>
            </Link>
          </div>
        </div>

        {/* Account KPI Highlights */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
          <Card className="p-4 border-slate-200/80">
            <div className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider">
              Upcoming Bookings
            </div>
            <div className="text-2xl font-bold text-sports-navy mt-1">
              {stats.upcomingBookings}
            </div>
            <div className="text-[11px] text-emerald-600 font-medium mt-0.5">Ready to play</div>
          </Card>

          <Card className="p-4 border-slate-200/80">
            <div className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider">
              Completed Games
            </div>
            <div className="text-2xl font-bold text-slate-900 mt-1">
              {stats.completedBookings}
            </div>
            <div className="text-[11px] text-slate-400 mt-0.5">Matches finished</div>
          </Card>

          <Card className="p-4 border-slate-200/80">
            <div className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider">
              Total Reservations
            </div>
            <div className="text-2xl font-bold text-slate-900 mt-1">
              {stats.totalBookings}
            </div>
            <div className="text-[11px] text-slate-400 mt-0.5">Lifetime activity</div>
          </Card>

          <Card className="p-4 border-slate-200/80">
            <div className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider">
              Total Spent
            </div>
            <div className="text-2xl font-bold text-emerald-600 mt-1">
              {stats.currency} {stats.totalAmountPaid.toLocaleString()}
            </div>
            <div className="text-[11px] text-slate-400 mt-0.5">Verified payments</div>
          </Card>
        </div>

        {/* Main Grid: Next Upcoming Booking + Quick Actions */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {/* Upcoming Booking Focus */}
          <div className="md:col-span-2 space-y-4">
            <div className="flex items-center justify-between">
              <h2 className="text-sm font-bold text-slate-900 flex items-center gap-2">
                <Calendar className="w-4 h-4 text-sports-accent" />
                <span>Next Scheduled Reservation</span>
              </h2>
              <Link
                href="/customer/bookings"
                className="text-xs font-semibold text-sports-navy hover:underline flex items-center gap-1"
              >
                <span>View all</span>
                <ChevronRight className="w-3.5 h-3.5" />
              </Link>
            </div>

            {upcomingBooking ? (
              <Card className="p-5 border-slate-200/80 shadow-xs space-y-4">
                <div className="flex items-start justify-between gap-4">
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="font-bold text-slate-900 text-base">
                        {upcomingBooking.venue?.name || 'Sports Venue'}
                      </span>
                      <span className="text-xs font-mono text-slate-400">
                        ({upcomingBooking.reference})
                      </span>
                    </div>
                    <div className="text-xs text-slate-500 mt-0.5 flex items-center gap-1.5">
                      <MapPin className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                      <span>{upcomingBooking.venue?.city || upcomingBooking.venue?.address}</span>
                      <span>•</span>
                      <span className="font-semibold text-slate-700">
                        {upcomingBooking.facility?.name} ({upcomingBooking.facility?.facility_type})
                      </span>
                    </div>
                  </div>

                  <Badge
                    variant={upcomingBooking.status === 'CONFIRMED' ? 'success' : 'warning'}
                    className="px-2.5 py-0.5 text-[11px] font-bold"
                  >
                    {upcomingBooking.status}
                  </Badge>
                </div>

                <div className="grid grid-cols-3 gap-3 p-3 bg-slate-50 rounded-xl border border-slate-100 text-xs">
                  <div>
                    <span className="text-slate-400 block font-medium">Date</span>
                    <span className="font-semibold text-slate-800">
                      {new Date(upcomingBooking.booking_date).toLocaleDateString(undefined, {
                        weekday: 'short',
                        month: 'short',
                        day: 'numeric',
                      })}
                    </span>
                  </div>
                  <div>
                    <span className="text-slate-400 block font-medium">Time Slot</span>
                    <span className="font-semibold text-slate-800">
                      {upcomingBooking.start_time.slice(0, 5)} - {upcomingBooking.end_time.slice(0, 5)}
                    </span>
                  </div>
                  <div>
                    <span className="text-slate-400 block font-medium">Amount</span>
                    <span className="font-bold text-slate-900">
                      {upcomingBooking.currency} {upcomingBooking.total_price.toLocaleString()}
                    </span>
                  </div>
                </div>

                <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-100">
                  <Link href={`/customer/bookings/${upcomingBooking.id}`}>
                    <Button size="sm" variant="outline" className="text-xs">
                      View Details & Receipt
                    </Button>
                  </Link>

                  {upcomingBooking.status === 'HOLD' && (
                    <Link href={`/customer/bookings/${upcomingBooking.id}/pay`}>
                      <Button size="sm" className="text-xs gap-1.5 bg-sports-navy text-white">
                        <CreditCard className="w-3.5 h-3.5" />
                        <span>Pay Now</span>
                      </Button>
                    </Link>
                  )}
                </div>
              </Card>
            ) : (
              <Card className="p-8 border-slate-200/80 text-center space-y-3">
                <Ticket className="w-10 h-10 text-slate-300 mx-auto" />
                <h3 className="text-sm font-semibold text-slate-700">No Upcoming Reservations</h3>
                <p className="text-xs text-slate-400 max-w-sm mx-auto">
                  You don&apos;t have any scheduled bookings right now. Explore available venues and reserve a court today!
                </p>
                <Link href="/search">
                  <Button size="sm" className="mt-2 text-xs">
                    Browse Venues & Courts
                  </Button>
                </Link>
              </Card>
            )}

            {/* Recent Bookings List */}
            <div className="pt-4">
              <h3 className="text-xs font-bold uppercase tracking-wider text-slate-400 mb-2">
                Recent Bookings History
              </h3>
              <Card className="border-slate-200/80 divide-y divide-slate-100 overflow-hidden shadow-xs">
                {recentBookings.length === 0 ? (
                  <div className="p-6 text-center text-xs text-slate-400">
                    No booking records found.
                  </div>
                ) : (
                  recentBookings.map((b) => (
                    <div
                      key={b.id}
                      className="p-3.5 hover:bg-slate-50/70 transition-colors flex items-center justify-between gap-3 text-xs"
                    >
                      <div>
                        <div className="font-semibold text-slate-900 flex items-center gap-1.5">
                          <span>{b.venue?.name || 'Venue'}</span>
                          <span className="text-slate-400 font-mono text-[10px]">({b.reference})</span>
                        </div>
                        <div className="text-slate-400 text-[11px] mt-0.5">
                          {b.facility?.name} • {b.booking_date} ({b.start_time.slice(0, 5)} - {b.end_time.slice(0, 5)})
                        </div>
                      </div>

                      <div className="flex items-center gap-3 shrink-0">
                        <span className="font-bold text-slate-800">
                          {b.currency} {b.total_price.toLocaleString()}
                        </span>
                        <Link href={`/customer/bookings/${b.id}`}>
                          <ChevronRight className="w-4 h-4 text-slate-400 hover:text-sports-navy" />
                        </Link>
                      </div>
                    </div>
                  ))
                )}
              </Card>
            </div>
          </div>

          {/* Quick Actions & Recent Activity Feed */}
          <div className="space-y-6">
            {/* Quick Actions Card */}
            <div>
              <h2 className="text-sm font-bold text-slate-900 mb-3">Quick Navigation</h2>
              <Card className="p-3 border-slate-200/80 space-y-1 text-xs">
                <Link
                  href="/search"
                  className="flex items-center gap-3 p-2.5 rounded-xl hover:bg-slate-100/80 transition-colors font-semibold text-slate-700 hover:text-sports-navy"
                >
                  <MapPin className="w-4 h-4 text-sports-accent" />
                  <span>Find & Book Venues</span>
                </Link>

                <Link
                  href="/customer/bookings"
                  className="flex items-center gap-3 p-2.5 rounded-xl hover:bg-slate-100/80 transition-colors font-semibold text-slate-700 hover:text-sports-navy"
                >
                  <Ticket className="w-4 h-4 text-blue-500" />
                  <span>My Bookings & Ledgers</span>
                </Link>

                <Link
                  href="/customer/notifications"
                  className="flex items-center gap-3 p-2.5 rounded-xl hover:bg-slate-100/80 transition-colors font-semibold text-slate-700 hover:text-sports-navy"
                >
                  <Bell className="w-4 h-4 text-amber-500" />
                  <span>Notification Center</span>
                </Link>

                <Link
                  href="/customer/account"
                  className="flex items-center gap-3 p-2.5 rounded-xl hover:bg-slate-100/80 transition-colors font-semibold text-slate-700 hover:text-sports-navy"
                >
                  <User className="w-4 h-4 text-emerald-500" />
                  <span>Account & Preferences</span>
                </Link>
              </Card>
            </div>

            {/* Recent Notifications Feed */}
            <div>
              <div className="flex items-center justify-between mb-2">
                <h3 className="text-xs font-bold uppercase tracking-wider text-slate-400">
                  Recent Alerts
                </h3>
                <Link
                  href="/customer/notifications"
                  className="text-[11px] font-semibold text-sports-navy hover:underline"
                >
                  View All
                </Link>
              </div>

              <Card className="border-slate-200/80 divide-y divide-slate-100 overflow-hidden text-xs">
                {recentNotifs.length === 0 ? (
                  <div className="p-4 text-center text-slate-400 text-xs">
                    No recent notifications.
                  </div>
                ) : (
                  recentNotifs.map((n: any) => (
                    <div key={n.id} className="p-3 hover:bg-slate-50 transition-colors">
                      <div className="font-semibold text-slate-800 line-clamp-1">{n.title}</div>
                      <div className="text-[11px] text-slate-400 line-clamp-1 mt-0.5">{n.message}</div>
                      <div className="text-[10px] text-slate-400 font-mono mt-1">
                        {new Date(n.created_at).toLocaleDateString()}
                      </div>
                    </div>
                  ))
                )}
              </Card>
            </div>
          </div>
        </div>
      </Container>
    </div>
  );
}
