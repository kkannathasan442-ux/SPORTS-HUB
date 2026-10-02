'use client';

import React, { useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { Card } from '@/components/ui/Card';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import {
  MapPin,
  Clock,
  Dumbbell,
  Layers,
  Sparkles,
  Calendar,
  Users,
  DollarSign,
  ArrowLeft,
  Search,
  CheckCircle2,
  AlertCircle,
  Wrench,
  ShieldCheck,
  ChevronRight,
} from 'lucide-react';
import type { PublicFacilityDetail, FacilityAvailabilityStatus } from '@sportshub/types';

interface PublicFacilityDetailsProps {
  facility: PublicFacilityDetail;
  initialDate?: string;
  initialTime?: string;
}

const DAY_NAMES = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

function getFacilityAvailabilityBadge(status?: FacilityAvailabilityStatus) {
  switch (status) {
    case 'AVAILABLE':
      return (
        <Badge variant="success" className="text-xs py-1 px-3 flex items-center gap-1.5 shadow-xs">
          <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
          <span className="font-bold">Available for Requested Slot</span>
        </Badge>
      );
    case 'OUTSIDE_OPERATING_HOURS':
      return (
        <Badge variant="warning" className="text-xs py-1 px-3 flex items-center gap-1.5">
          <Clock className="w-3.5 h-3.5" />
          <span className="font-bold">Outside Operating Hours</span>
        </Badge>
      );
    case 'MAINTENANCE':
      return (
        <Badge variant="warning" className="text-xs py-1 px-3 flex items-center gap-1.5">
          <Wrench className="w-3.5 h-3.5" />
          <span className="font-bold">Maintenance in Progress</span>
        </Badge>
      );
    case 'NOT_BOOKABLE':
      return (
        <Badge variant="default" className="text-xs py-1 px-3">
          Walk-in Only (Not Bookable)
        </Badge>
      );
    default:
      return (
        <Badge variant="default" className="text-xs py-1 px-3">
          Status Unavailable
        </Badge>
      );
  }
}

export function PublicFacilityDetails({
  facility,
  initialDate = '',
  initialTime = '',
}: PublicFacilityDetailsProps) {
  const router = useRouter();
  const [date, setDate] = useState(initialDate);
  const [time, setTime] = useState(initialTime);

  const handleUpdateAvailability = (e: React.FormEvent) => {
    e.preventDefault();
    const query = new URLSearchParams();
    if (date) query.set('date', date);
    if (time) query.set('startTime', time);
    router.push(`/venues/${facility.venue_id}/facilities/${facility.id}?${query.toString()}`);
  };

  const venueHref = `/venues/${facility.venue_id}${
    date || time ? `?date=${date}&startTime=${time}` : ''
  }`;

  return (
    <div className="space-y-8 max-w-7xl mx-auto">
      {/* Breadcrumb Navigation */}
      <div className="flex items-center gap-2 text-xs font-semibold text-slate-500">
        <Link href="/search" className="hover:text-sports-navy transition-colors">
          Search
        </Link>
        <ChevronRight className="w-3.5 h-3.5 text-slate-400" />
        <Link href={venueHref} className="hover:text-sports-navy transition-colors">
          {facility.venue.name}
        </Link>
        <ChevronRight className="w-3.5 h-3.5 text-slate-400" />
        <span className="text-slate-900 font-bold">{facility.name}</span>
      </div>

      {/* Hero Header */}
      <div className="rounded-3xl bg-slate-900 border border-slate-200 text-white p-6 sm:p-8 relative overflow-hidden shadow-xl">
        <div className="relative z-10 space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-4">
            <Link
              href={venueHref}
              className="inline-flex items-center gap-1.5 text-xs font-bold text-slate-300 hover:text-white transition-colors"
            >
              <ArrowLeft className="w-4 h-4" />
              <span>Back to {facility.venue.name}</span>
            </Link>

            {facility.availability && getFacilityAvailabilityBadge(facility.availability.status)}
          </div>

          <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-6 pt-2">
            <div className="space-y-2 max-w-2xl">
              <div className="flex flex-wrap items-center gap-2">
                {facility.sport && (
                  <Badge variant="success" className="text-xs font-bold py-0.5 px-2.5">
                    {facility.sport.name}
                  </Badge>
                )}
                {facility.facility_type && (
                  <span className="text-xs font-semibold px-2 py-0.5 rounded-md bg-white/10 backdrop-blur-xs text-white">
                    {facility.facility_type}
                  </span>
                )}
                {facility.surface_type && (
                  <span className="text-xs font-semibold px-2 py-0.5 rounded-md bg-white/10 backdrop-blur-xs text-slate-300">
                    {facility.surface_type} Surface
                  </span>
                )}
              </div>

              <h1 className="text-2xl sm:text-4xl font-black tracking-tight">{facility.name}</h1>

              <p className="text-xs sm:text-sm text-slate-300 flex items-center gap-1.5">
                <MapPin className="w-4 h-4 text-sports-accent shrink-0" />
                <span>
                  Located at{' '}
                  <strong className="text-white font-bold">{facility.venue.name}</strong> •{' '}
                  {[facility.venue.address_line_1, facility.venue.city, facility.venue.district]
                    .filter(Boolean)
                    .join(', ')}
                </span>
              </p>
            </div>

            <div className="bg-white/10 backdrop-blur-md rounded-2xl p-4 border border-white/20 text-right shrink-0">
              <span className="text-[10px] uppercase font-bold text-slate-300 block">
                Hourly Rate
              </span>
              {facility.starting_price_per_hour !== null ? (
                <div className="text-xl font-black text-white">
                  <span className="text-xs font-semibold text-sports-accent">From </span>
                  {facility.currency} {Number(facility.starting_price_per_hour).toLocaleString()}
                  <span className="text-xs font-normal text-slate-300">/hr</span>
                </div>
              ) : (
                <span className="text-xs text-slate-300 italic">Price on request</span>
              )}
            </div>
          </div>
        </div>

        {/* Ambient background glow */}
        <div className="absolute top-0 right-0 w-96 h-96 bg-sports-navy/50 rounded-full blur-3xl pointer-events-none" />
      </div>

      {/* Date / Time Availability Checker Bar */}
      <Card className="p-4 sm:p-5 bg-gradient-to-r from-slate-50 to-white border-slate-200">
        <form
          onSubmit={handleUpdateAvailability}
          className="flex flex-col sm:flex-row sm:items-center justify-between gap-4"
        >
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-sports-navy text-white flex items-center justify-center font-bold shrink-0">
              <Sparkles className="w-4 h-4 text-sports-accent" />
            </div>
            <div>
              <h3 className="text-xs font-bold text-slate-900 uppercase tracking-wider">
                Check Court Availability
              </h3>
              <p className="text-[11px] text-slate-500">
                Choose a date and start time to verify real-time court status.
              </p>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <div className="flex items-center gap-1.5">
              <Calendar className="w-3.5 h-3.5 text-slate-400" />
              <input
                type="date"
                value={date}
                onChange={(e) => setDate(e.target.value)}
                className="px-3 py-1.5 rounded-xl border border-slate-200 text-xs font-semibold focus:outline-none focus:ring-2 focus:ring-sports-navy bg-white"
              />
            </div>

            <div className="flex items-center gap-1.5">
              <Clock className="w-3.5 h-3.5 text-slate-400" />
              <input
                type="time"
                value={time}
                onChange={(e) => setTime(e.target.value)}
                className="px-3 py-1.5 rounded-xl border border-slate-200 text-xs font-semibold focus:outline-none focus:ring-2 focus:ring-sports-navy bg-white font-mono"
              />
            </div>

            <Button
              type="submit"
              size="sm"
              className="bg-sports-navy text-white text-xs font-bold flex items-center gap-1.5 h-8 shadow-xs"
            >
              <Search className="w-3.5 h-3.5" />
              <span>Check</span>
            </Button>
          </div>
        </form>
      </Card>

      {/* Availability Status Card (if checked) */}
      {facility.availability && (
        <Card
          className={`p-5 border-l-4 ${
            facility.availability.is_available
              ? 'border-l-emerald-500 bg-emerald-50/30'
              : 'border-l-amber-500 bg-amber-50/30'
          }`}
        >
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div className="space-y-1">
              <div className="flex items-center gap-2">
                {facility.availability.is_available ? (
                  <CheckCircle2 className="w-5 h-5 text-emerald-600" />
                ) : (
                  <AlertCircle className="w-5 h-5 text-amber-600" />
                )}
                <h3 className="text-sm font-bold text-slate-900">
                  {facility.availability.is_available
                    ? 'Court is Available for Requested Slot!'
                    : 'Court is Currently Unavailable'}
                </h3>
              </div>
              <p className="text-xs text-slate-600">
                {facility.availability.message || facility.availability.reason}
                {facility.availability.slot_start && facility.availability.slot_end && (
                  <span className="font-mono font-medium ml-1">
                    ({facility.availability.slot_start} – {facility.availability.slot_end})
                  </span>
                )}
              </p>
            </div>

            <div className="text-right">
              {(facility.availability.price_per_hour !== undefined ||
                facility.availability.calculated_price?.price_per_hour !== undefined) && (
                <div className="text-sm font-bold text-slate-900">
                  Rate:{' '}
                  <span className="text-sports-navy font-black">
                    {facility.currency}{' '}
                    {Number(
                      facility.availability.price_per_hour ??
                        facility.availability.calculated_price?.price_per_hour
                    ).toLocaleString()}
                  </span>
                  <span className="text-xs font-normal text-slate-500">/hr</span>
                </div>
              )}
              <span className="text-[11px] text-slate-400 block mt-0.5">
                (Booking Engine will be activated in upcoming phase)
              </span>
            </div>
          </div>
        </Card>
      )}

      {/* Main Grid Details */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Left 2 Cols: Facility Specs, Description, Pricing Rules */}
        <div className="lg:col-span-2 space-y-8">
          {/* Specifications */}
          <Card className="p-6 space-y-4">
            <h2 className="text-base font-bold text-slate-900 flex items-center gap-2">
              <Layers className="w-4 h-4 text-sports-navy" />
              <span>Court Specifications</span>
            </h2>

            <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
              <div className="p-3.5 rounded-2xl bg-slate-50 border border-slate-100">
                <span className="text-[10px] uppercase font-bold text-slate-400 block">Sport</span>
                <span className="text-xs font-bold text-slate-900 mt-1 block">
                  {facility.sport?.name || 'All Sports'}
                </span>
              </div>

              <div className="p-3.5 rounded-2xl bg-slate-50 border border-slate-100">
                <span className="text-[10px] uppercase font-bold text-slate-400 block">Court Type</span>
                <span className="text-xs font-bold text-slate-900 mt-1 block">
                  {facility.facility_type || 'Standard'}
                </span>
              </div>

              <div className="p-3.5 rounded-2xl bg-slate-50 border border-slate-100">
                <span className="text-[10px] uppercase font-bold text-slate-400 block">Surface</span>
                <span className="text-xs font-bold text-slate-900 mt-1 block">
                  {facility.surface_type || 'Standard'}
                </span>
              </div>

              <div className="p-3.5 rounded-2xl bg-slate-50 border border-slate-100">
                <span className="text-[10px] uppercase font-bold text-slate-400 block">Capacity</span>
                <span className="text-xs font-bold text-slate-900 mt-1 block">
                  {facility.capacity_per_slot ? `${facility.capacity_per_slot} Players` : 'Standard'}
                </span>
              </div>

              <div className="p-3.5 rounded-2xl bg-slate-50 border border-slate-100">
                <span className="text-[10px] uppercase font-bold text-slate-400 block">Slot Duration</span>
                <span className="text-xs font-bold text-slate-900 mt-1 block">
                  {facility.default_duration_minutes} Minutes
                </span>
              </div>

              <div className="p-3.5 rounded-2xl bg-slate-50 border border-slate-100">
                <span className="text-[10px] uppercase font-bold text-slate-400 block">Buffer Time</span>
                <span className="text-xs font-bold text-slate-900 mt-1 block">
                  {facility.buffer_minutes || 0} Minutes
                </span>
              </div>
            </div>

            {facility.description && (
              <div className="pt-2 border-t border-slate-100">
                <h3 className="text-xs font-bold text-slate-900 mb-1">About This Court</h3>
                <p className="text-xs text-slate-600 leading-relaxed">{facility.description}</p>
              </div>
            )}
          </Card>

          {/* Pricing Rules */}
          <Card className="p-6 space-y-4">
            <h2 className="text-base font-bold text-slate-900 flex items-center gap-2">
              <DollarSign className="w-4 h-4 text-emerald-600" />
              <span>Public Rates & Tariffs</span>
            </h2>

            {facility.pricing_rules.length === 0 ? (
              <p className="text-xs text-slate-500 italic">
                Standard venue rates apply or price is provided on inquiry.
              </p>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs border-collapse">
                  <thead>
                    <tr className="border-b border-slate-200 text-[11px] font-bold text-slate-500 uppercase">
                      <th className="py-2.5 px-3">Tariff Name</th>
                      <th className="py-2.5 px-3">Applicable Days</th>
                      <th className="py-2.5 px-3">Time Window</th>
                      <th className="py-2.5 px-3 text-right">Rate / Hour</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 text-slate-700">
                    {facility.pricing_rules.map((rule) => {
                      const days =
                        rule.day_of_week !== null && rule.day_of_week !== undefined
                          ? DAY_NAMES[rule.day_of_week]
                          : 'All Days';

                      const times =
                        rule.start_time && rule.end_time
                          ? `${rule.start_time.slice(0, 5)} – ${rule.end_time.slice(0, 5)}`
                          : 'Full Day';

                      return (
                        <tr key={rule.id} className="hover:bg-slate-50/80">
                          <td className="py-2.5 px-3 font-semibold text-slate-900">{rule.name}</td>
                          <td className="py-2.5 px-3 text-slate-500">{days}</td>
                          <td className="py-2.5 px-3 text-slate-500 font-mono">{times}</td>
                          <td className="py-2.5 px-3 text-right font-bold text-slate-900">
                            {facility.currency} {Number(rule.price_per_hour).toLocaleString()}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </Card>
        </div>

        {/* Right Col: Venue Operating Hours & Location */}
        <div className="space-y-6">
          {/* Venue Operating Schedule */}
          <Card className="p-6 space-y-4">
            <h2 className="text-base font-bold text-slate-900 flex items-center gap-2">
              <Clock className="w-4 h-4 text-sports-navy" />
              <span>Venue Schedule</span>
            </h2>

            <div className="space-y-2">
              {facility.venue.operating_hours.length === 0 ? (
                <p className="text-xs text-slate-500 italic">Schedule not configured yet.</p>
              ) : (
                [1, 2, 3, 4, 5, 6, 0].map((dayNum) => {
                  const hour = facility.venue.operating_hours.find((h) => h.day_of_week === dayNum);
                  const isClosed = !hour || hour.is_closed;

                  return (
                    <div
                      key={dayNum}
                      className="flex items-center justify-between text-xs py-1.5 px-2 rounded-lg hover:bg-slate-50"
                    >
                      <span className="font-semibold text-slate-700">{DAY_NAMES[dayNum]}</span>
                      {isClosed ? (
                        <span className="text-[11px] font-bold text-rose-500">Closed</span>
                      ) : (
                        <span className="text-[11px] font-mono text-slate-600">
                          {hour.open_time?.slice(0, 5)} – {hour.close_time?.slice(0, 5)}
                        </span>
                      )}
                    </div>
                  );
                })
              )}
            </div>
          </Card>

          {/* Location & Safety */}
          <Card className="p-6 space-y-3">
            <h2 className="text-base font-bold text-slate-900 flex items-center gap-2">
              <ShieldCheck className="w-4 h-4 text-emerald-600" />
              <span>Verified Facility</span>
            </h2>
            <p className="text-xs text-slate-500 leading-relaxed">
              This facility is an active, verified sports listing under {facility.venue.name}.
              Operating hours and availability conform to official venue schedules in Asia/Colombo.
            </p>
          </Card>
        </div>
      </div>
    </div>
  );
}
