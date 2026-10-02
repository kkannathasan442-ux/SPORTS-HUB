'use client';

import React, { useState, useEffect, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Badge } from '@/components/ui/Badge';
import {
  Calendar,
  Clock,
  UserPlus,
  Phone,
  Mail,
  User,
  CheckCircle2,
  AlertCircle,
  CreditCard,
  Banknote,
  Search,
  Filter,
  RefreshCw,
  Building2,
  Layers,
  X,
  PlusCircle,
} from 'lucide-react';
import type { VenueWithCounts, FacilityWithSport, BookingWithDetails, Sport } from '@sportshub/types';

interface ReceptionistBookingDeskProps {
  organizationName: string;
  venues: VenueWithCounts[];
  sports: Sport[];
  initialBookings: BookingWithDetails[];
}

export function ReceptionistBookingDesk({
  organizationName,
  venues,
  sports,
  initialBookings,
}: ReceptionistBookingDeskProps) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();

  const [selectedVenueId, setSelectedVenueId] = useState<string>(venues[0]?.id || '');
  const [selectedDate, setSelectedDate] = useState<string>(
    new Date().toISOString().split('T')[0]
  );
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('ALL');
  const [bookings, setBookings] = useState<BookingWithDetails[]>(initialBookings);

  // Walk-in modal state
  const [isWalkInOpen, setIsWalkInOpen] = useState(false);
  const [facilities, setFacilities] = useState<FacilityWithSport[]>([]);
  const [loadingFacilities, setLoadingFacilities] = useState(false);

  const [walkInFacilityId, setWalkInFacilityId] = useState<string>('');
  const [walkInDate, setWalkInDate] = useState<string>(
    new Date().toISOString().split('T')[0]
  );
  const [walkInTime, setWalkInTime] = useState<string>('09:00');
  const [walkInDuration, setWalkInDuration] = useState<number>(60);
  const [walkInSportId, setWalkInSportId] = useState<string>('');
  const [walkInCustomerName, setWalkInCustomerName] = useState('');
  const [walkInCustomerPhone, setWalkInCustomerPhone] = useState('');
  const [walkInCustomerEmail, setWalkInCustomerEmail] = useState('');
  const [walkInPaymentMethod, setWalkInPaymentMethod] = useState<'CASH' | 'CARD' | 'BANK_TRANSFER' | 'COMPLIMENTARY'>('CASH');
  const [walkInNotes, setWalkInNotes] = useState('');
  const [walkInAmount, setWalkInAmount] = useState<string>('');

  const [submittingWalkIn, setSubmittingWalkIn] = useState(false);
  const [walkInError, setWalkInError] = useState<string | null>(null);
  const [walkInSuccess, setWalkInSuccess] = useState<string | null>(null);

  // Fetch facilities when venue changes
  useEffect(() => {
    if (!selectedVenueId) return;
    async function loadFacilities() {
      setLoadingFacilities(true);
      try {
        const res = await fetch(`/api/venues/${selectedVenueId}/facilities`);
        if (res.ok) {
          const data = await res.json();
          setFacilities(data.facilities || []);
          if (data.facilities?.length > 0) {
            setWalkInFacilityId(data.facilities[0].id);
          }
        }
      } catch (err) {
        console.error('Failed to load facilities', err);
      } finally {
        setLoadingFacilities(false);
      }
    }
    loadFacilities();
  }, [selectedVenueId]);

  // Filter bookings
  const filteredBookings = bookings.filter((b) => {
    if (statusFilter !== 'ALL' && b.status !== statusFilter) return false;
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      const matchRef = b.booking_reference?.toLowerCase().includes(q);
      const matchNote = b.customer_note?.toLowerCase().includes(q);
      const matchFacility = b.facility?.name?.toLowerCase().includes(q);
      return matchRef || matchNote || matchFacility;
    }
    return true;
  });

  // Calculate metrics
  const totalCount = bookings.length;
  const confirmedCount = bookings.filter((b) => b.status === 'CONFIRMED').length;
  const holdCount = bookings.filter((b) => b.status === 'HOLD').length;
  const completedCount = bookings.filter((b) => b.status === 'COMPLETED').length;

  const handleCreateWalkIn = async (e: React.FormEvent) => {
    e.preventDefault();
    setWalkInError(null);
    setWalkInSuccess(null);

    if (!walkInFacilityId) {
      setWalkInError('Please select a facility court');
      return;
    }
    if (!walkInCustomerName.trim() || !walkInCustomerPhone.trim()) {
      setWalkInError('Customer full name and phone number are required');
      return;
    }

    setSubmittingWalkIn(true);
    try {
      const payload: any = {
        venueId: selectedVenueId,
        facilityId: walkInFacilityId,
        sportId: walkInSportId || undefined,
        bookingDate: walkInDate,
        startTime: walkInTime,
        durationMinutes: walkInDuration,
        customerName: walkInCustomerName.trim(),
        customerPhone: walkInCustomerPhone.trim(),
        customerEmail: walkInCustomerEmail.trim() || undefined,
        paymentMethod: walkInPaymentMethod,
        notes: walkInNotes.trim() || undefined,
      };

      if (walkInAmount !== '') {
        payload.amountPaid = Number(walkInAmount);
      }

      const res = await fetch('/api/bookings/walk-in', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      const data = await res.json();

      if (!res.ok || !data.success) {
        throw new Error(data.error?.message || 'Failed to create walk-in booking');
      }

      setWalkInSuccess(`Walk-in confirmed! Reference: ${data.data?.booking_reference}`);
      
      // Reset form
      setWalkInCustomerName('');
      setWalkInCustomerPhone('');
      setWalkInCustomerEmail('');
      setWalkInNotes('');
      setWalkInAmount('');

      // Refresh list
      setTimeout(() => {
        setIsWalkInOpen(false);
        setWalkInSuccess(null);
        startTransition(() => {
          router.refresh();
        });
      }, 1500);
    } catch (err: any) {
      setWalkInError(err.message || 'An error occurred during booking');
    } finally {
      setSubmittingWalkIn(false);
    }
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'CONFIRMED':
        return <Badge variant="success">Confirmed</Badge>;
      case 'HOLD':
        return <Badge variant="warning">Hold (Pending)</Badge>;
      case 'COMPLETED':
        return <Badge variant="info">Completed</Badge>;
      case 'CANCELLED':
        return <Badge variant="error">Cancelled</Badge>;
      case 'NO_SHOW':
        return <Badge variant="error">No-Show</Badge>;
      default:
        return <Badge variant="default">{status}</Badge>;
    }
  };

  return (
    <div className="space-y-6">
      {/* Top Controls & Metrics Bar */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card className="p-4 bg-white/70 backdrop-blur-md border border-slate-200/80 shadow-sm">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Today&apos;s Bookings</p>
              <h3 className="text-2xl font-black text-slate-900 mt-1">{totalCount}</h3>
            </div>
            <div className="p-2.5 bg-blue-50 text-blue-600 rounded-xl">
              <Calendar className="w-5 h-5" />
            </div>
          </div>
        </Card>

        <Card className="p-4 bg-white/70 backdrop-blur-md border border-slate-200/80 shadow-sm">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-xs font-semibold text-emerald-600 uppercase tracking-wider">Confirmed</p>
              <h3 className="text-2xl font-black text-slate-900 mt-1">{confirmedCount}</h3>
            </div>
            <div className="p-2.5 bg-emerald-50 text-emerald-600 rounded-xl">
              <CheckCircle2 className="w-5 h-5" />
            </div>
          </div>
        </Card>

        <Card className="p-4 bg-white/70 backdrop-blur-md border border-slate-200/80 shadow-sm">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-xs font-semibold text-amber-600 uppercase tracking-wider">Active Holds</p>
              <h3 className="text-2xl font-black text-slate-900 mt-1">{holdCount}</h3>
            </div>
            <div className="p-2.5 bg-amber-50 text-amber-600 rounded-xl">
              <Clock className="w-5 h-5" />
            </div>
          </div>
        </Card>

        <Card className="p-4 bg-white/70 backdrop-blur-md border border-slate-200/80 shadow-sm">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-xs font-semibold text-indigo-600 uppercase tracking-wider">Completed</p>
              <h3 className="text-2xl font-black text-slate-900 mt-1">{completedCount}</h3>
            </div>
            <div className="p-2.5 bg-indigo-50 text-indigo-600 rounded-xl">
              <CheckCircle2 className="w-5 h-5" />
            </div>
          </div>
        </Card>
      </div>

      {/* Action Toolbar */}
      <Card className="p-5 bg-white/90 border border-slate-200 shadow-sm">
        <div className="flex flex-col lg:flex-row items-stretch lg:items-center justify-between gap-4">
          <div className="flex flex-wrap items-center gap-3">
            {/* Venue Selector */}
            <div className="relative min-w-[200px]">
              <select
                value={selectedVenueId}
                onChange={(e) => setSelectedVenueId(e.target.value)}
                aria-label="Select venue"
                className="w-full h-10 px-3 pr-8 text-xs font-semibold text-slate-800 bg-slate-50 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-sports-accent"
              >
                {venues.map((v) => (
                  <option key={v.id} value={v.id}>
                    {v.name} ({v.city || 'Venue'})
                  </option>
                ))}
              </select>
            </div>

            {/* Date Picker */}
            <div className="relative">
              <input
                type="date"
                value={selectedDate}
                onChange={(e) => setSelectedDate(e.target.value)}
                aria-label="Select date"
                className="h-10 px-3 text-xs font-semibold text-slate-800 bg-slate-50 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-sports-accent"
              />
            </div>

            {/* Search Input */}
            <div className="relative min-w-[220px]">
              <Search className="w-4 h-4 text-slate-400 absolute left-3 top-3" />
              <input
                type="text"
                placeholder="Search reference or guest..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full h-10 pl-9 pr-3 text-xs text-slate-800 bg-slate-50 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-sports-accent"
              />
            </div>
          </div>

          <div className="flex items-center gap-3">
            {/* Status Filter */}
            <div className="flex items-center bg-slate-100 p-1 rounded-lg">
              {['ALL', 'CONFIRMED', 'HOLD', 'COMPLETED'].map((s) => (
                <button
                  key={s}
                  onClick={() => setStatusFilter(s)}
                  className={`px-3 py-1.5 text-xs font-bold rounded-md transition-colors ${
                    statusFilter === s
                      ? 'bg-white text-slate-900 shadow-sm'
                      : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  {s}
                </button>
              ))}
            </div>

            {/* Walk-in Modal Trigger */}
            <Button
              onClick={() => setIsWalkInOpen(true)}
              className="bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs h-10 px-4 shadow-sm"
            >
              <UserPlus className="w-4 h-4 mr-2" />
              New Walk-In
            </Button>
          </div>
        </div>
      </Card>

      {/* Bookings Table / Schedule View */}
      <Card className="p-0 border border-slate-200 shadow-sm overflow-hidden bg-white">
        <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between">
          <div>
            <h3 className="text-sm font-bold text-slate-900">Today&apos;s Court Schedule</h3>
            <p className="text-xs text-slate-500">Live booking ledger for front desk check-in</p>
          </div>
          <button
            onClick={() => startTransition(() => router.refresh())}
            disabled={isPending}
            className="p-2 text-slate-400 hover:text-slate-600 rounded-lg hover:bg-slate-100 transition-colors"
            title="Refresh bookings"
          >
            <RefreshCw className={`w-4 h-4 ${isPending ? 'animate-spin' : ''}`} />
          </button>
        </div>

        {filteredBookings.length === 0 ? (
          <div className="text-center py-16 px-4">
            <div className="w-12 h-12 rounded-full bg-slate-100 flex items-center justify-center mx-auto mb-3 text-slate-400">
              <Calendar className="w-6 h-6" />
            </div>
            <h4 className="text-sm font-bold text-slate-800">No Bookings Found</h4>
            <p className="text-xs text-slate-500 mt-1 max-w-sm mx-auto">
              No reservations recorded for the selected date and filters. Use &quot;New Walk-In&quot; to register guest check-ins.
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-slate-50/70 border-b border-slate-200/80 text-[11px] font-bold text-slate-600 uppercase tracking-wider">
                  <th className="py-3 px-4">Ref & Status</th>
                  <th className="py-3 px-4">Court / Facility</th>
                  <th className="py-3 px-4">Time Slot</th>
                  <th className="py-3 px-4">Guest Details</th>
                  <th className="py-3 px-4">Payment</th>
                  <th className="py-3 px-4 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 text-xs text-slate-700">
                {filteredBookings.map((b) => (
                  <tr key={b.id} className="hover:bg-slate-50/50 transition-colors">
                    <td className="py-3.5 px-4">
                      <div className="font-mono font-bold text-slate-900">{b.booking_reference}</div>
                      <div className="mt-1">{getStatusBadge(b.status)}</div>
                    </td>
                    <td className="py-3.5 px-4">
                      <div className="font-bold text-slate-900">{b.facility?.name || 'Facility'}</div>
                      <div className="text-[11px] text-slate-500 flex items-center gap-1 mt-0.5">
                        <span className="w-1.5 h-1.5 rounded-full bg-sports-accent"></span>
                        {b.sport?.name || b.facility?.facility_type || 'Court'}
                      </div>
                    </td>
                    <td className="py-3.5 px-4">
                      <div className="font-semibold text-slate-900 flex items-center gap-1.5">
                        <Clock className="w-3.5 h-3.5 text-slate-400" />
                        {b.start_time?.substring(0, 5)} - {b.end_time?.substring(0, 5)}
                      </div>
                      <div className="text-[11px] text-slate-500 mt-0.5">{b.duration_minutes} mins</div>
                    </td>
                    <td className="py-3.5 px-4 max-w-[240px]">
                      <div className="font-semibold text-slate-900 truncate">
                        {b.customer_note || 'Online Reservation'}
                      </div>
                    </td>
                    <td className="py-3.5 px-4">
                      <div className="font-black text-slate-900">
                        {b.currency || 'LKR'} {b.total_amount?.toLocaleString() || '0'}
                      </div>
                      <div className="text-[11px] text-slate-500">
                        {b.status === 'CONFIRMED' ? 'Paid / Confirmed' : 'Pending'}
                      </div>
                    </td>
                    <td className="py-3.5 px-4 text-right">
                      <a
                        href={`/customer/bookings/${b.id}`}
                        target="_blank"
                        rel="noreferrer"
                        className="text-xs font-bold text-sports-accent hover:underline inline-flex items-center gap-1"
                      >
                        Receipt &rarr;
                      </a>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>

      {/* Walk-In Booking Modal */}
      {isWalkInOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in">
          <div className="bg-white rounded-2xl shadow-2xl border border-slate-200 max-w-lg w-full max-h-[90vh] overflow-y-auto p-6">
            <div className="flex items-center justify-between pb-4 border-b border-slate-100">
              <div className="flex items-center gap-2.5">
                <div className="p-2 bg-emerald-50 text-emerald-600 rounded-xl">
                  <UserPlus className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-base font-bold text-slate-900">Walk-In Court Booking</h3>
                  <p className="text-xs text-slate-500">Register on-the-spot guest reservation</p>
                </div>
              </div>
              <button
                onClick={() => setIsWalkInOpen(false)}
                className="text-slate-400 hover:text-slate-600 p-1 rounded-lg"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {walkInError && (
              <div className="mt-4 p-3 bg-rose-50 border border-rose-200 text-rose-700 text-xs rounded-xl flex items-center gap-2">
                <AlertCircle className="w-4 h-4 shrink-0" />
                <span>{walkInError}</span>
              </div>
            )}

            {walkInSuccess && (
              <div className="mt-4 p-3 bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs rounded-xl flex items-center gap-2">
                <CheckCircle2 className="w-4 h-4 shrink-0" />
                <span>{walkInSuccess}</span>
              </div>
            )}

            <form onSubmit={handleCreateWalkIn} className="space-y-4 mt-4">
              {/* Facility Picker */}
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  Court / Facility *
                </label>
                <select
                  value={walkInFacilityId}
                  onChange={(e) => setWalkInFacilityId(e.target.value)}
                  required
                  className="w-full h-10 px-3 text-xs font-medium text-slate-800 bg-slate-50 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-500"
                >
                  {facilities.map((f) => (
                    <option key={f.id} value={f.id}>
                      {f.name} ({f.facility_type || 'Court'})
                    </option>
                  ))}
                </select>
              </div>

              {/* Date & Time */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">Date *</label>
                  <input
                    type="date"
                    value={walkInDate}
                    onChange={(e) => setWalkInDate(e.target.value)}
                    required
                    className="w-full h-10 px-3 text-xs text-slate-800 bg-slate-50 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-500"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">Start Time *</label>
                  <input
                    type="time"
                    value={walkInTime}
                    onChange={(e) => setWalkInTime(e.target.value)}
                    required
                    className="w-full h-10 px-3 text-xs text-slate-800 bg-slate-50 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-500"
                  />
                </div>
              </div>

              {/* Duration & Sport */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">Duration</label>
                  <select
                    value={walkInDuration}
                    onChange={(e) => setWalkInDuration(Number(e.target.value))}
                    className="w-full h-10 px-3 text-xs text-slate-800 bg-slate-50 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-500"
                  >
                    <option value={30}>30 Minutes</option>
                    <option value={60}>60 Minutes (1 Hour)</option>
                    <option value={90}>90 Minutes (1.5 Hours)</option>
                    <option value={120}>120 Minutes (2 Hours)</option>
                    <option value={180}>180 Minutes (3 Hours)</option>
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">Sport</label>
                  <select
                    value={walkInSportId}
                    onChange={(e) => setWalkInSportId(e.target.value)}
                    className="w-full h-10 px-3 text-xs text-slate-800 bg-slate-50 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-500"
                  >
                    <option value="">Select Sport (Optional)</option>
                    {sports.map((s) => (
                      <option key={s.id} value={s.id}>
                        {s.name}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              {/* Customer Info */}
              <div className="border-t border-slate-100 pt-3 space-y-3">
                <h4 className="text-xs font-bold text-slate-800">Guest Information</h4>
                <div>
                  <input
                    type="text"
                    placeholder="Guest Full Name *"
                    value={walkInCustomerName}
                    onChange={(e) => setWalkInCustomerName(e.target.value)}
                    required
                    className="w-full h-10 px-3 text-xs text-slate-800 bg-slate-50 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-500"
                  />
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <input
                    type="tel"
                    placeholder="Phone Number *"
                    value={walkInCustomerPhone}
                    onChange={(e) => setWalkInCustomerPhone(e.target.value)}
                    required
                    className="w-full h-10 px-3 text-xs text-slate-800 bg-slate-50 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-500"
                  />
                  <input
                    type="email"
                    placeholder="Email (Optional)"
                    value={walkInCustomerEmail}
                    onChange={(e) => setWalkInCustomerEmail(e.target.value)}
                    className="w-full h-10 px-3 text-xs text-slate-800 bg-slate-50 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-500"
                  />
                </div>
              </div>

              {/* Payment Info */}
              <div className="border-t border-slate-100 pt-3 space-y-3">
                <h4 className="text-xs font-bold text-slate-800">Payment & Pricing</h4>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-[11px] font-semibold text-slate-600 mb-1">
                      Payment Mode
                    </label>
                    <select
                      value={walkInPaymentMethod}
                      onChange={(e) => setWalkInPaymentMethod(e.target.value as any)}
                      className="w-full h-10 px-3 text-xs text-slate-800 bg-slate-50 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-500"
                    >
                      <option value="CASH">Cash at Desk</option>
                      <option value="CARD">POS / Card Terminal</option>
                      <option value="BANK_TRANSFER">Bank Transfer</option>
                      <option value="COMPLIMENTARY">Complimentary / Free</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-[11px] font-semibold text-slate-600 mb-1">
                      Amount Paid (LKR)
                    </label>
                    <input
                      type="number"
                      placeholder="Auto if empty"
                      value={walkInAmount}
                      onChange={(e) => setWalkInAmount(e.target.value)}
                      className="w-full h-10 px-3 text-xs text-slate-800 bg-slate-50 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-500"
                    />
                  </div>
                </div>

                <div>
                  <textarea
                    rows={2}
                    placeholder="Desk notes or special instructions..."
                    value={walkInNotes}
                    onChange={(e) => setWalkInNotes(e.target.value)}
                    className="w-full p-2.5 text-xs text-slate-800 bg-slate-50 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-500"
                  />
                </div>
              </div>

              <div className="flex items-center justify-end gap-3 pt-3 border-t border-slate-100">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setIsWalkInOpen(false)}
                  className="text-xs h-10"
                >
                  Cancel
                </Button>
                <Button
                  type="submit"
                  disabled={submittingWalkIn}
                  className="bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs h-10 px-5"
                >
                  {submittingWalkIn ? 'Confirming...' : 'Confirm Walk-In'}
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
