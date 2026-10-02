import React from 'react';
import Link from 'next/link';
import { notFound, redirect } from 'next/navigation';
import { createSupabaseServerClient } from '@/lib/supabase/server';
import { getBookingDetails } from '@/lib/bookings/queries';
import { Container } from '@/components/ui/Container';
import { Card } from '@/components/ui/Card';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { CancelBookingButton } from '@/components/bookings/CancelBookingButton';
import { CustomerPayNowSection } from '@/components/payments/CustomerPayNowSection';
import {
  Calendar,
  Clock,
  MapPin,
  Ticket,
  ChevronLeft,
  CheckCircle2,
  AlertCircle,
  Phone,
  ShieldCheck,
  Printer,
  Sparkles,
  Trophy,
} from 'lucide-react';
import type { BookingStatus, PaymentTransaction } from '@sportshub/types';

interface BookingDetailsPageProps {
  params: {
    bookingId: string;
  };
  searchParams?: {
    confirmed?: string;
  };
}

export default async function BookingDetailsPage({ params, searchParams }: BookingDetailsPageProps) {
  const supabase = await createSupabaseServerClient();

  // Get current user
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect('/login?error=auth_required');
  }

  const booking = await getBookingDetails(supabase, params.bookingId, user.id);

  if (!booking) {
    notFound();
  }

  // Fetch payment transaction for this booking if exists
  const { data: paymentData } = await supabase
    .from('payment_transactions')
    .select('*')
    .eq('booking_id', booking.id)
    .order('created_at', { ascending: false })
    .maybeSingle();

  const payment = paymentData as PaymentTransaction | null;

  const isJustConfirmed = searchParams?.confirmed === 'true';
  const todayStr = new Date().toISOString().split('T')[0];
  const canCancel = (booking.status === 'CONFIRMED' || booking.status === 'HOLD') && booking.booking_date >= todayStr;

  const getStatusBadge = (status: BookingStatus) => {
    switch (status) {
      case 'CONFIRMED':
        return <Badge variant="success" className="bg-emerald-100 text-emerald-800 border-emerald-300 font-bold px-3 py-1 text-xs">CONFIRMED</Badge>;
      case 'HOLD':
        return <Badge variant="warning" className="bg-amber-100 text-amber-800 border-amber-300 font-bold px-3 py-1 text-xs">HOLD</Badge>;
      case 'CANCELLED':
        return <Badge variant="error" className="bg-rose-100 text-rose-800 border-rose-300 font-bold px-3 py-1 text-xs">CANCELLED</Badge>;
      case 'COMPLETED':
        return <Badge variant="info" className="bg-blue-100 text-blue-800 border-blue-300 font-bold px-3 py-1 text-xs">COMPLETED</Badge>;
      case 'EXPIRED':
        return <Badge variant="outline" className="text-slate-500 border-slate-300 font-semibold px-3 py-1 text-xs">EXPIRED</Badge>;
      default:
        return <Badge variant="outline">{status}</Badge>;
    }
  };

  return (
    <div className="min-h-screen bg-slate-50/60 pb-16">
      <Container className="py-8 max-w-3xl mx-auto space-y-6">
        {/* Back Link */}
        <div>
          <Link
            href="/customer/bookings"
            className="inline-flex items-center text-sm font-semibold text-slate-600 hover:text-slate-900 transition-colors"
          >
            <ChevronLeft className="w-4 h-4 mr-1" />
            Back to My Bookings
          </Link>
        </div>

        {/* Success Alert if just confirmed */}
        {isJustConfirmed && (
          <div className="bg-gradient-to-r from-emerald-800 to-emerald-900 text-white p-5 rounded-2xl shadow-lg flex items-center gap-4 animate-in fade-in slide-in-from-top-4 duration-300">
            <div className="w-12 h-12 rounded-full bg-emerald-500/20 border border-emerald-400/30 flex items-center justify-center shrink-0">
              <CheckCircle2 className="w-7 h-7 text-emerald-300" />
            </div>
            <div>
              <h2 className="text-lg font-bold">Booking Confirmed Successfully!</h2>
              <p className="text-xs text-emerald-200 mt-0.5">
                Your reservation is locked. Present this reference at the front desk when checking in.
              </p>
            </div>
          </div>
        )}

        {/* Official Ticket Card */}
        <Card className="rounded-3xl bg-white border border-slate-200/90 shadow-xl overflow-hidden">
          {/* Ticket Header */}
          <div className="bg-slate-950 text-white p-6 sm:p-8 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 border-b border-slate-800">
            <div>
              <span className="text-xs uppercase tracking-wider font-semibold text-emerald-400">
                Official Reservation Ticket
              </span>
              <h1 className="text-2xl font-extrabold tracking-tight mt-1 text-white">
                {booking.facility?.name || 'Court Reservation'}
              </h1>
              <p className="text-sm text-slate-300 mt-0.5 flex items-center gap-1.5">
                <MapPin className="w-4 h-4 text-emerald-400 shrink-0" />
                <span>{booking.venue?.name}</span>
                {booking.venue?.city && <span>· {booking.venue.city}</span>}
              </p>
            </div>

            <div className="flex flex-col items-start sm:items-end">
              <span className="text-[11px] uppercase tracking-wider text-slate-400">Reference Number</span>
              <span className="font-mono text-lg font-extrabold text-emerald-300 bg-slate-900 px-3 py-1 rounded-lg border border-slate-800 mt-1">
                {booking.booking_reference}
              </span>
            </div>
          </div>

          {/* Ticket Body Details */}
          <div className="p-6 sm:p-8 space-y-6">
            {/* Status & Highlights */}
            <div className="flex flex-wrap items-center justify-between gap-4 pb-6 border-b border-slate-100">
              <div className="flex items-center gap-3">
                <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">Status:</span>
                {getStatusBadge(booking.status)}
              </div>
              {booking.sport && (
                <Badge variant="info" className="bg-slate-100 text-slate-800 border-slate-200 font-bold text-xs">
                  {booking.sport.name}
                </Badge>
              )}
            </div>

            {/* Payment Section */}
            <CustomerPayNowSection booking={booking} payment={payment} />

            {/* Core Schedule Grid */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 bg-slate-50 p-5 rounded-2xl border border-slate-200/80">
              <div>
                <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider block">Date</span>
                <span className="text-base font-extrabold text-slate-900 mt-1 flex items-center gap-1.5">
                  <Calendar className="w-4 h-4 text-emerald-600 shrink-0" />
                  {booking.booking_date}
                </span>
              </div>
              <div>
                <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider block">Time Slot</span>
                <span className="text-base font-extrabold text-slate-900 mt-1 font-mono flex items-center gap-1.5">
                  <Clock className="w-4 h-4 text-emerald-600 shrink-0" />
                  {booking.start_time.substring(0, 5)} – {booking.end_time.substring(0, 5)}
                </span>
              </div>
              <div>
                <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider block">Duration</span>
                <span className="text-base font-extrabold text-slate-900 mt-1 block">
                  {booking.duration_minutes} Minutes
                </span>
              </div>
            </div>

            {/* Venue & Location Details */}
            <div className="space-y-2 text-sm border-b border-slate-100 pb-6">
              <h3 className="font-bold text-slate-900 text-base">Venue Location & Contact</h3>
              <p className="text-slate-600">
                {booking.venue?.address_line_1 ? `${booking.venue.address_line_1}, ` : ''}
                {booking.venue?.city || ''}
              </p>
              {booking.venue?.phone && (
                <p className="text-slate-600 flex items-center gap-2 pt-1">
                  <Phone className="w-4 h-4 text-slate-400" />
                  <span>{booking.venue.phone}</span>
                </p>
              )}
            </div>

            {/* Financial Itemization */}
            <div className="space-y-3 border-b border-slate-100 pb-6 text-sm">
              <h3 className="font-bold text-slate-900 text-base">Price Summary</h3>
              <div className="flex justify-between text-slate-600">
                <span>Facility Reservation ({booking.duration_minutes} mins)</span>
                <span className="font-medium text-slate-900">
                  {booking.currency} {Number(booking.subtotal).toLocaleString()}
                </span>
              </div>
              {Number(booking.discount_amount) > 0 && (
                <div className="flex justify-between text-emerald-600">
                  <span>Discount Applied</span>
                  <span className="font-medium">- {booking.currency} {Number(booking.discount_amount).toLocaleString()}</span>
                </div>
              )}
              <div className="flex justify-between text-base font-extrabold text-slate-950 pt-2 border-t border-slate-100">
                <span>Total Amount</span>
                <span className="text-xl text-emerald-700 font-black">
                  {booking.currency} {Number(booking.total_amount).toLocaleString()}
                </span>
              </div>
            </div>

            {/* Customer Note if exists */}
            {booking.customer_note && (
              <div className="bg-slate-50 p-4 rounded-xl border border-slate-200 text-sm">
                <span className="text-xs font-bold text-slate-500 uppercase tracking-wider block mb-1">
                  Customer Request / Notes
                </span>
                <p className="text-slate-700 italic">{booking.customer_note}</p>
              </div>
            )}

            {/* Rules & Check-in Notice */}
            <div className="flex items-start gap-3 bg-emerald-50/70 p-4 rounded-xl border border-emerald-200/70 text-xs text-slate-600">
              <ShieldCheck className="w-5 h-5 text-emerald-600 shrink-0 mt-0.5" />
              <div>
                <p className="font-bold text-slate-900">Check-in Guidelines:</p>
                <p className="mt-0.5">
                  Please arrive 10 minutes prior to your start time. Bring appropriate non-marking footwear and equipment. Present your reference code ({booking.booking_reference}) upon arrival.
                </p>
              </div>
            </div>

            {/* Actions Bar */}
            <div className="flex flex-wrap items-center justify-between gap-4 pt-4">
              <div className="flex items-center gap-2">
                {canCancel && (
                  <CancelBookingButton
                    bookingId={booking.id}
                    bookingReference={booking.booking_reference}
                  />
                )}
              </div>

              <div className="flex items-center gap-3">
                <Link href={`/customer/bookings/${booking.id}/receipt`}>
                  <Button variant="outline" size="sm" className="font-semibold text-slate-800 gap-1.5">
                    <Printer className="w-3.5 h-3.5" />
                    <span>View Receipt</span>
                  </Button>
                </Link>
                <Link href={`/venues/${booking.venue_id}/facilities/${booking.facility_id}/book`}>
                  <Button variant="outline" size="sm" className="font-semibold text-slate-800">
                    Book Again
                  </Button>
                </Link>
              </div>
            </div>
          </div>
        </Card>
      </Container>
    </div>
  );
}
