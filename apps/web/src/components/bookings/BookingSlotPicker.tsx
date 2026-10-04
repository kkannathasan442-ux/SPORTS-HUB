'use client';

import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import {
  Calendar,
  Clock,
  CheckCircle2,
  AlertCircle,
  Timer,
  ChevronRight,
  ShieldCheck,
  MapPin,
  Sparkles,
  Info,
  Loader2,
} from 'lucide-react';
import { Card } from '@/components/ui/Card';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import type { FacilitySlot, Booking } from '@sportshub/types';

interface BookingSlotPickerProps {
  venue: {
    id: string;
    name: string;
    slug: string;
    city: string | null;
    currency: string;
    address_line_1: string | null;
  };
  facility: {
    id: string;
    name: string;
    slug: string;
    facility_type: string | null;
    capacity: number;
    default_duration_minutes: number;
    buffer_minutes: number;
  };
  sport?: {
    id: string;
    name: string;
    icon_name: string | null;
  } | null;
  initialDate?: string;
}

export function BookingSlotPicker({
  venue,
  facility,
  sport,
  initialDate,
}: BookingSlotPickerProps) {
  const router = useRouter();

  // Next 14 days generator
  const getDaysArray = () => {
    const days = [];
    const today = new Date();
    for (let i = 0; i < 14; i++) {
      const d = new Date(today);
      d.setDate(today.getDate() + i);
      const isoDate = d.toISOString().split('T')[0];
      const dayName = i === 0 ? 'Today' : i === 1 ? 'Tomorrow' : d.toLocaleDateString('en-US', { weekday: 'short' });
      const dayNum = d.toLocaleDateString('en-US', { day: 'numeric', month: 'short' });
      days.push({ isoDate, dayName, dayNum });
    }
    return days;
  };

  const daysList = getDaysArray();
  const [selectedDate, setSelectedDate] = useState<string>(initialDate || daysList[0].isoDate);
  const [durationMinutes, setDurationMinutes] = useState<number>(facility.default_duration_minutes || 60);
  const [slots, setSlots] = useState<FacilitySlot[]>([]);
  const [loadingSlots, setLoadingSlots] = useState<boolean>(true);
  const [selectedSlot, setSelectedSlot] = useState<FacilitySlot | null>(null);
  const [customerNote, setCustomerNote] = useState<string>('');

  // Active Hold state
  const [activeHold, setActiveHold] = useState<Booking | null>(null);
  const [holdTimeLeftSeconds, setHoldTimeLeftSeconds] = useState<number>(0);
  const [isHolding, setIsHolding] = useState<boolean>(false);
  const [isConfirming, setIsConfirming] = useState<boolean>(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  // Fetch slots on date / duration change
  useEffect(() => {
    let isMounted = true;
    async function fetchSlots() {
      setLoadingSlots(true);
      setErrorMsg(null);
      setSelectedSlot(null);

      try {
        const res = await fetch(
          `/api/bookings/availability?facilityId=${facility.id}&date=${selectedDate}&durationMinutes=${durationMinutes}`
        );
        const json = await res.json();

        if (isMounted) {
          if (json.success && json.slots) {
            setSlots(json.slots);
          } else {
            setSlots([]);
            if (json.error) setErrorMsg(json.error);
          }
        }
      } catch (err: any) {
        if (isMounted) {
          setErrorMsg(err.message || 'Failed to fetch slots');
        }
      } finally {
        if (isMounted) setLoadingSlots(false);
      }
    }

    fetchSlots();
    return () => {
      isMounted = false;
    };
  }, [facility.id, selectedDate, durationMinutes]);

  // Hold Timer countdown
  useEffect(() => {
    if (!activeHold || !activeHold.hold_expires_at) return;

    const expiryTime = new Date(activeHold.hold_expires_at).getTime();

    const interval = setInterval(() => {
      const remaining = Math.max(0, Math.floor((expiryTime - Date.now()) / 1000));
      setHoldTimeLeftSeconds(remaining);

      if (remaining === 0) {
        clearInterval(interval);
        setActiveHold(null);
        setErrorMsg('Your 10-minute hold has expired. Please select a time slot again.');
      }
    }, 1000);

    return () => clearInterval(interval);
  }, [activeHold]);

  // Handle Create Hold
  const handleCreateHold = async () => {
    if (!selectedSlot) return;

    setIsHolding(true);
    setErrorMsg(null);

    try {
      const res = await fetch('/api/bookings/hold', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          facilityId: facility.id,
          date: selectedDate,
          startTime: selectedSlot.startTime,
          durationMinutes,
          customerNote: customerNote.trim() || undefined,
        }),
      });

      const json = await res.json();

      if (!res.ok || !json.success) {
        if (res.status === 401) {
          router.push(`/login?redirect=/venues/${venue.id}/facilities/${facility.id}/book`);
          return;
        }
        throw new Error(json.error?.message || 'Failed to create reservation hold');
      }

      setActiveHold(json.booking);
    } catch (err: any) {
      setErrorMsg(err.message || 'Error creating hold');
    } finally {
      setIsHolding(false);
    }
  };

  // Handle Confirm Booking
  const handleConfirmBooking = async () => {
    if (!activeHold) return;

    setIsConfirming(true);
    setErrorMsg(null);

    try {
      const res = await fetch('/api/bookings/confirm', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          bookingId: activeHold.id,
        }),
      });

      const json = await res.json();

      if (!res.ok || !json.success) {
        throw new Error(json.error?.message || 'Failed to confirm reservation');
      }

      // Redirect to customer receipt details
      router.push(`/customer/bookings/${json.booking.id}?confirmed=true`);
    } catch (err: any) {
      setErrorMsg(err.message || 'Error confirming booking');
      setIsConfirming(false);
    }
  };

  // Format MM:SS for countdown timer
  const formatTimer = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;
  };

  const currency = venue.currency || 'LKR';

  return (
    <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
      {/* Left Column: Date & Slot Selector */}
      <div className="lg:col-span-8 space-y-6">
        {/* Active Hold Alert Banner */}
        {activeHold && (
          <div className="bg-gradient-to-r from-emerald-900 to-emerald-800 text-white p-5 rounded-2xl shadow-lg border border-emerald-700 animate-in fade-in slide-in-from-top-4 duration-300">
            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-full bg-emerald-500/20 border border-emerald-400/30 flex items-center justify-center shrink-0">
                  <Timer className="w-5 h-5 text-emerald-300 animate-pulse" />
                </div>
                <div>
                  <h3 className="font-bold text-base text-emerald-100 flex items-center gap-2">
                    Slot Locked for You!
                    <Badge variant="success" className="bg-emerald-500/30 text-emerald-200 border-emerald-400/30">
                      {activeHold.booking_reference}
                    </Badge>
                  </h3>
                  <p className="text-xs text-emerald-200/80 mt-0.5">
                    Hold expires in <span className="font-mono font-bold text-emerald-300 text-sm">{formatTimer(holdTimeLeftSeconds)}</span>. Complete confirmation below to secure your court.
                  </p>
                </div>
              </div>
              <Button
                onClick={handleConfirmBooking}
                disabled={isConfirming}
                className="bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-bold px-5 py-2.5 shadow-md shrink-0 w-full sm:w-auto"
              >
                {isConfirming ? (
                  <>
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                    Confirming...
                  </>
                ) : (
                  <>
                    <CheckCircle2 className="w-4 h-4 mr-1.5" />
                    Confirm & Lock ({currency} {activeHold.total_amount.toLocaleString()})
                  </>
                )}
              </Button>
            </div>
          </div>
        )}

        {/* Error Alert */}
        {errorMsg && (
          <div className="bg-rose-50 border border-rose-200 text-rose-800 p-4 rounded-xl flex items-start gap-3">
            <AlertCircle className="w-5 h-5 text-rose-600 shrink-0 mt-0.5" />
            <div className="text-sm font-medium">{errorMsg}</div>
          </div>
        )}

        {/* 1. Date Selection Pills */}
        <Card className="p-6 rounded-2xl bg-white border-slate-200/80 shadow-sm">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-base font-bold text-slate-900 flex items-center gap-2">
              <Calendar className="w-4 h-4 text-emerald-600" />
              1. Select Date
            </h2>
            <span className="text-xs font-medium text-slate-500">
              Showing next 14 days
            </span>
          </div>

          <div className="grid grid-cols-4 sm:grid-cols-7 gap-2">
            {daysList.map((day) => {
              const isSelected = selectedDate === day.isoDate;
              return (
                <button
                  key={day.isoDate}
                  type="button"
                  onClick={() => setSelectedDate(day.isoDate)}
                  disabled={Boolean(activeHold)}
                  className={`flex flex-col items-center justify-center p-3 rounded-xl border text-center transition-all ${
                    isSelected
                      ? 'bg-slate-900 border-slate-900 text-white shadow-sm ring-2 ring-emerald-500/30 font-bold'
                      : 'bg-slate-50/70 border-slate-200 text-slate-700 hover:bg-slate-100/80 hover:border-slate-300'
                  } ${activeHold ? 'opacity-50 cursor-not-allowed' : ''}`}
                >
                  <span className={`text-xs ${isSelected ? 'text-emerald-400 font-semibold' : 'text-slate-500'}`}>
                    {day.dayName}
                  </span>
                  <span className="text-sm font-bold mt-1">
                    {day.dayNum}
                  </span>
                </button>
              );
            })}
          </div>
        </Card>

        {/* 2. Duration Selection */}
        <Card className="p-6 rounded-2xl bg-white border-slate-200/80 shadow-sm">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-base font-bold text-slate-900 flex items-center gap-2">
              <Clock className="w-4 h-4 text-emerald-600" />
              2. Select Duration
            </h2>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            {[30, 60, 90, 120].map((mins) => {
              const isSelected = durationMinutes === mins;
              return (
                <button
                  key={mins}
                  type="button"
                  onClick={() => setDurationMinutes(mins)}
                  disabled={Boolean(activeHold)}
                  className={`py-3 px-4 rounded-xl border text-center font-medium transition-all ${
                    isSelected
                      ? 'bg-emerald-600 border-emerald-600 text-white shadow-sm font-bold'
                      : 'bg-slate-50 border-slate-200 text-slate-700 hover:bg-slate-100 hover:border-slate-300'
                  } ${activeHold ? 'opacity-50 cursor-not-allowed' : ''}`}
                >
                  {mins === 60 ? '1 Hour' : mins === 90 ? '1.5 Hours' : mins === 120 ? '2 Hours' : `${mins} Mins`}
                </button>
              );
            })}
          </div>
        </Card>

        {/* 3. Time Slots Grid */}
        <Card className="p-6 rounded-2xl bg-white border-slate-200/80 shadow-sm">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-base font-bold text-slate-900 flex items-center gap-2">
              <Timer className="w-4 h-4 text-emerald-600" />
              3. Available Time Slots
            </h2>
            <div className="flex items-center gap-4 text-xs font-medium text-slate-500">
              <span className="flex items-center gap-1.5">
                <span className="w-2.5 h-2.5 rounded-full bg-emerald-500" /> Available
              </span>
              <span className="flex items-center gap-1.5">
                <span className="w-2.5 h-2.5 rounded-full bg-slate-300" /> Unavailable
              </span>
            </div>
          </div>

          {loadingSlots ? (
            <div className="py-12 text-center text-slate-500 flex flex-col items-center justify-center gap-3">
              <Loader2 className="w-8 h-8 animate-spin text-emerald-600" />
              <p className="text-sm font-medium">Checking live schedule & pricing...</p>
            </div>
          ) : slots.length === 0 ? (
            <div className="py-10 text-center text-slate-500 bg-slate-50 rounded-xl border border-dashed border-slate-300">
              <Info className="w-8 h-8 text-slate-400 mx-auto mb-2" />
              <p className="text-sm font-semibold text-slate-700">No slots available for this date</p>
              <p className="text-xs text-slate-500 mt-1">The venue might be closed or fully booked on this day.</p>
            </div>
          ) : (
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3">
              {slots.map((slot) => {
                const isSelected = selectedSlot?.startTime === slot.startTime;
                const isHeld = activeHold?.start_time?.substring(0, 5) === slot.startTime;

                if (!slot.isAvailable) {
                  return (
                    <div
                      key={slot.startTime}
                      className="p-3.5 rounded-xl border border-slate-100 bg-slate-50/60 text-slate-400 opacity-60 flex flex-col justify-between cursor-not-allowed select-none"
                    >
                      <div className="font-mono text-sm font-bold">
                        {slot.startTime} – {slot.endTime}
                      </div>
                      <span className="text-[11px] uppercase tracking-wider font-semibold text-slate-400 mt-1">
                        {slot.unavailableReason || 'Unavailable'}
                      </span>
                    </div>
                  );
                }

                return (
                  <button
                    key={slot.startTime}
                    type="button"
                    onClick={() => {
                      if (!activeHold) setSelectedSlot(slot);
                    }}
                    disabled={Boolean(activeHold)}
                    className={`p-3.5 rounded-xl border text-left transition-all flex flex-col justify-between ${
                      isHeld
                        ? 'bg-emerald-900 border-emerald-700 text-white ring-2 ring-emerald-500 shadow-md font-bold'
                        : isSelected
                        ? 'bg-slate-900 border-slate-900 text-white ring-2 ring-emerald-500/40 shadow-md font-bold'
                        : 'bg-emerald-50/40 border-emerald-200/70 hover:border-emerald-500 hover:bg-emerald-50/80 text-slate-900'
                    } ${activeHold && !isHeld ? 'opacity-40 cursor-not-allowed' : ''}`}
                  >
                    <div className="flex items-center justify-between w-full">
                      <span className="font-mono text-sm font-bold">
                        {slot.startTime} – {slot.endTime}
                      </span>
                    </div>
                    <div className="mt-2 flex items-center justify-between">
                      <span className={`text-xs font-semibold ${isSelected || isHeld ? 'text-emerald-300' : 'text-emerald-700'}`}>
                        {currency} {slot.price?.toLocaleString()}
                      </span>
                      {isSelected && (
                        <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
                      )}
                    </div>
                  </button>
                );
              })}
            </div>
          )}
        </Card>

        {/* 4. Customer Note */}
        <Card className="p-6 rounded-2xl bg-white border-slate-200/80 shadow-sm">
          <label htmlFor="customerNote" className="block text-sm font-bold text-slate-900 mb-2">
            Special Requests / Notes (Optional)
          </label>
          <textarea
            id="customerNote"
            rows={2}
            value={customerNote}
            onChange={(e) => setCustomerNote(e.target.value)}
            disabled={Boolean(activeHold)}
            placeholder="e.g., Left-handed court preference, training session, specific equipment..."
            className="w-full text-sm p-3 rounded-xl border border-slate-300 focus:ring-2 focus:ring-emerald-500 focus:outline-none disabled:bg-slate-100 disabled:opacity-70"
          />
        </Card>
      </div>

      {/* Right Column: Checkout Summary Card */}
      <div className="lg:col-span-4">
        <div className="sticky top-24 space-y-4">
          <Card className="p-6 rounded-2xl bg-white border-slate-200/90 shadow-md">
            <h2 className="text-lg font-bold text-slate-900 pb-4 border-b border-slate-100 flex items-center justify-between">
              <span>Reservation Summary</span>
              {sport && (
                <Badge variant="info" className="bg-slate-100 text-slate-800 font-semibold border-slate-200">
                  {sport.name}
                </Badge>
              )}
            </h2>

            <div className="py-4 space-y-3 text-sm border-b border-slate-100">
              <div>
                <span className="text-xs text-slate-500 uppercase tracking-wider block">Venue</span>
                <span className="font-bold text-slate-900">{venue.name}</span>
                {venue.city && (
                  <span className="text-xs text-slate-500 flex items-center gap-1 mt-0.5">
                    <MapPin className="w-3 h-3 text-slate-400" />
                    {venue.city}
                  </span>
                )}
              </div>

              <div>
                <span className="text-xs text-slate-500 uppercase tracking-wider block">Facility / Court</span>
                <span className="font-bold text-slate-900">{facility.name}</span>
                {facility.facility_type && (
                  <span className="text-xs text-slate-500 block mt-0.5">
                    {facility.facility_type} · Max {facility.capacity} players
                  </span>
                )}
              </div>

              <div className="grid grid-cols-2 gap-2 pt-1">
                <div>
                  <span className="text-xs text-slate-500 uppercase tracking-wider block">Date</span>
                  <span className="font-semibold text-slate-800">{selectedDate}</span>
                </div>
                <div>
                  <span className="text-xs text-slate-500 uppercase tracking-wider block">Duration</span>
                  <span className="font-semibold text-slate-800">{durationMinutes} mins</span>
                </div>
              </div>

              {selectedSlot && (
                <div className="p-3 bg-emerald-50/80 rounded-xl border border-emerald-200/70">
                  <span className="text-xs font-semibold text-emerald-800 block">Selected Time Slot</span>
                  <span className="text-base font-bold text-emerald-950 font-mono">
                    {selectedSlot.startTime} – {selectedSlot.endTime}
                  </span>
                </div>
              )}
            </div>

            {/* Price Calculation Breakdown */}
            <div className="py-4 space-y-2 text-sm border-b border-slate-100">
              <div className="flex justify-between text-slate-600">
                <span>Facility Rate ({durationMinutes}m)</span>
                <span className="font-medium text-slate-900">
                  {selectedSlot?.price ? `${currency} ${selectedSlot.price.toLocaleString()}` : '—'}
                </span>
              </div>
              <div className="flex justify-between text-slate-600">
                <span>Platform Booking Fee</span>
                <span className="font-medium text-emerald-700">FREE</span>
              </div>
              <div className="flex justify-between text-base font-bold text-slate-950 pt-2 border-t border-slate-100">
                <span>Total Amount</span>
                <span className="text-lg text-emerald-700 font-extrabold">
                  {activeHold
                    ? `${currency} ${activeHold.total_amount.toLocaleString()}`
                    : selectedSlot?.price
                    ? `${currency} ${selectedSlot.price.toLocaleString()}`
                    : '—'}
                </span>
              </div>
            </div>

            {/* Action Buttons */}
            <div className="pt-4 space-y-3">
              {!activeHold ? (
                <Button
                  onClick={handleCreateHold}
                  disabled={!selectedSlot || isHolding}
                  className="w-full bg-slate-900 hover:bg-slate-800 text-white font-bold py-3.5 rounded-xl shadow-md text-base"
                >
                  {isHolding ? (
                    <>
                      <Loader2 className="w-5 h-5 mr-2 animate-spin" />
                      Locking Slot...
                    </>
                  ) : (
                    <>
                      Lock Slot & Continue
                      <ChevronRight className="w-4 h-4 ml-1" />
                    </>
                  )}
                </Button>
              ) : (
                <Button
                  onClick={handleConfirmBooking}
                  disabled={isConfirming}
                  className="w-full bg-emerald-600 hover:bg-emerald-500 text-white font-bold py-3.5 rounded-xl shadow-lg text-base"
                >
                  {isConfirming ? (
                    <>
                      <Loader2 className="w-5 h-5 mr-2 animate-spin" />
                      Confirming Reservation...
                    </>
                  ) : (
                    <>
                      <CheckCircle2 className="w-5 h-5 mr-1.5" />
                      Confirm Reservation Now
                    </>
                  )}
                </Button>
              )}

              <div className="flex items-center gap-2 text-xs text-slate-500 justify-center pt-2">
                <ShieldCheck className="w-4 h-4 text-emerald-600" />
                <span>Zero double-booking guarantee · Instant confirmation</span>
              </div>
            </div>
          </Card>
        </div>
      </div>
    </div>
  );
}
