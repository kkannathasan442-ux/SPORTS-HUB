'use client';

import React, { useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { Card } from '@/components/ui/Card';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import {
  MapPin,
  Phone,
  Mail,
  Clock,
  Dumbbell,
  Layers,
  Sparkles,
  Calendar,
  Users,
  DollarSign,
  ArrowRight,
  Search,
  CheckCircle2,
  AlertCircle,
  Wrench,
} from 'lucide-react';
import type { PublicVenueDetail, FacilityAvailabilityStatus } from '@sportshub/types';

interface PublicVenueDetailsProps {
  venue: PublicVenueDetail;
  initialDate?: string;
  initialTime?: string;
}

const DAY_NAMES = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

function getFacilityAvailabilityBadge(status?: FacilityAvailabilityStatus) {
  switch (status) {
    case 'AVAILABLE':
      return (
        <Badge variant="success" className="text-[10px] py-0.5 px-2 flex items-center gap-1">
          <CheckCircle2 className="w-3 h-3 text-emerald-600" />
          <span>Available</span>
        </Badge>
      );
    case 'OUTSIDE_OPERATING_HOURS':
      return (
        <Badge variant="warning" className="text-[10px] py-0.5 px-2 flex items-center gap-1">
          <Clock className="w-3 h-3" />
          <span>Outside Hours</span>
        </Badge>
      );
    case 'MAINTENANCE':
      return (
        <Badge variant="warning" className="text-[10px] py-0.5 px-2 flex items-center gap-1">
          <Wrench className="w-3 h-3" />
          <span>Maintenance</span>
        </Badge>
      );
    case 'NOT_BOOKABLE':
      return (
        <Badge variant="default" className="text-[10px] py-0.5 px-2">
          Walk-in Only
        </Badge>
      );
    default:
      return (
        <Badge variant="default" className="text-[10px] py-0.5 px-2">
          Unavailable
        </Badge>
      );
  }
}

export function PublicVenueDetails({
  venue,
  initialDate = '',
  initialTime = '',
}: PublicVenueDetailsProps) {
  const router = useRouter();
  const [date, setDate] = useState(initialDate);
  const [time, setTime] = useState(initialTime);

  const handleUpdateAvailability = (e: React.FormEvent) => {
    e.preventDefault();
    const query = new URLSearchParams();
    if (date) query.set('date', date);
    if (time) query.set('startTime', time);
    router.push(`/venues/${venue.id}?${query.toString()}`);
  };

  return (
    <div className="space-y-8 max-w-7xl mx-auto">
      {/* Top Hero Banner */}
      <div className="relative rounded-3xl overflow-hidden bg-slate-900 shadow-xl border border-slate-200">
        <div className="h-64 sm:h-80 w-full relative">
          {venue.cover_image_url ? (
            <img
              src={venue.cover_image_url}
              alt={venue.name}
              className="w-full h-full object-cover opacity-60"
            />
          ) : (
            <div className="w-full h-full bg-gradient-to-r from-sports-navy via-slate-800 to-slate-900 flex items-center justify-center opacity-80" />
          )}
          <div className="absolute inset-0 bg-gradient-to-t from-slate-950 via-slate-950/60 to-transparent" />
        </div>

        <div className="absolute bottom-0 inset-x-0 p-6 sm:p-8 text-white flex flex-col sm:flex-row sm:items-end justify-between gap-4">
          <div className="space-y-2 max-w-2xl">
            <div className="flex flex-wrap items-center gap-2">
              <Badge variant="success" className="text-xs font-bold py-0.5 px-2.5">
                ACTIVE VENUE
              </Badge>
              {venue.sports.map((s) => (
                <span
                  key={s.id}
                  className="text-xs font-semibold px-2 py-0.5 rounded-md bg-white/20 backdrop-blur-xs text-white"
                >
                  {s.name}
                </span>
              ))}
            </div>

            <h1 className="text-2xl sm:text-4xl font-black tracking-tight">{venue.name}</h1>

            <p className="text-xs sm:text-sm text-slate-300 flex items-center gap-1.5">
              <MapPin className="w-4 h-4 text-sports-accent shrink-0" />
              <span>
                {[venue.address_line_1, venue.address_line_2, venue.city, venue.district]
                  .filter(Boolean)
                  .join(', ') || 'Sri Lanka'}
              </span>
            </p>
          </div>

          <div className="bg-white/10 backdrop-blur-md rounded-2xl p-4 border border-white/20 text-right shrink-0">
            <span className="text-[10px] uppercase font-bold text-slate-300 block">
              Starting Rate
            </span>
            {venue.starting_price_per_hour !== null ? (
              <div className="text-xl font-black text-white">
                <span className="text-xs font-semibold text-sports-accent">From </span>
                {venue.currency} {Number(venue.starting_price_per_hour).toLocaleString()}
                <span className="text-xs font-normal text-slate-300">/hr</span>
              </div>
            ) : (
              <span className="text-xs text-slate-300 italic">Price on request</span>
            )}
          </div>
        </div>
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
                Check Real-Time Court Availability
              </h3>
              <p className="text-[11px] text-slate-500">
                Select your preferred playing date and start time below.
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
              <span>Check Availability</span>
            </Button>
          </div>
        </form>
      </Card>

      {/* Main Grid: Left Details & Facilities / Right Operating Hours & Contact */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Left 2 Cols: Facilities List & Description */}
        <div className="lg:col-span-2 space-y-8">
          {/* Facilities / Courts List */}
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Layers className="w-5 h-5 text-sports-navy" />
                <h2 className="text-lg font-bold text-slate-900">Facilities & Courts</h2>
              </div>
              <Badge variant="default" className="text-xs">
                {venue.facilities.length} Courts Available
              </Badge>
            </div>

            {venue.facilities.length === 0 ? (
              <Card className="text-center py-10 text-xs text-slate-500">
                No public facilities configured for this venue yet.
              </Card>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                {venue.facilities.map((fac) => {
                  const facilityHref = `/venues/${venue.id}/facilities/${fac.id}${
                    date || time ? `?date=${date}&startTime=${time}` : ''
                  }`;

                  return (
                    <Card
                      key={fac.id}
                      className="p-4 hover:border-slate-300 hover:shadow-md transition-all flex flex-col justify-between"
                    >
                      <div>
                        <div className="flex items-start justify-between gap-2 mb-2">
                          <div>
                            <h3 className="text-sm font-bold text-slate-900">{fac.name}</h3>
                            <p className="text-[11px] text-slate-500">
                              {fac.sport ? fac.sport.name : 'Multi-sport'} • {fac.facility_type || 'Standard'}
                            </p>
                          </div>
                          {getFacilityAvailabilityBadge(fac.availability?.status)}
                        </div>

                        {fac.description && (
                          <p className="text-xs text-slate-500 line-clamp-2 my-2 leading-relaxed">
                            {fac.description}
                          </p>
                        )}

                        <div className="grid grid-cols-2 gap-2 my-3 text-[11px] text-slate-600 pt-2 border-t border-slate-100">
                          <div className="flex items-center gap-1">
                            <Users className="w-3.5 h-3.5 text-slate-400" />
                            <span>Capacity: {fac.capacity ? `${fac.capacity} players` : 'Flexible'}</span>
                          </div>
                          <div className="flex items-center gap-1">
                            <Clock className="w-3.5 h-3.5 text-slate-400" />
                            <span>Duration: {fac.default_duration_minutes} mins</span>
                          </div>
                        </div>
                      </div>

                      <div className="pt-3 border-t border-slate-100 flex items-center justify-between mt-2">
                        <div>
                          {fac.starting_price_per_hour !== null ? (
                            <span className="text-xs font-bold text-slate-900">
                              {venue.currency} {Number(fac.starting_price_per_hour).toLocaleString()}/hr
                            </span>
                          ) : (
                            <span className="text-[11px] text-slate-400 italic">Rate N/A</span>
                          )}
                        </div>

                        <Link href={facilityHref}>
                          <Button variant="outline" size="sm" className="h-7 text-xs flex items-center gap-1">
                            <span>View Details</span>
                            <ArrowRight className="w-3 h-3" />
                          </Button>
                        </Link>
                      </div>
                    </Card>
                  );
                })}
              </div>
            )}
          </div>

          {/* Venue Description & Amenities */}
          <Card className="space-y-3 p-6">
            <h2 className="text-base font-bold text-slate-900">About {venue.name}</h2>
            <p className="text-xs sm:text-sm text-slate-600 leading-relaxed whitespace-pre-line">
              {venue.description || 'Welcome to ' + venue.name + ', a premier sports and recreation venue.'}
            </p>
          </Card>
        </div>

        {/* Right 1 Col: Operating Hours & Contact */}
        <div className="space-y-6">
          {/* Operating Hours Card */}
          <Card className="space-y-4 p-5">
            <div className="flex items-center gap-2 pb-2 border-b border-slate-100">
              <Clock className="w-4 h-4 text-sports-navy" />
              <h3 className="text-sm font-bold text-slate-900">Weekly Operating Hours</h3>
            </div>

            <div className="divide-y divide-slate-100 text-xs">
              {venue.operating_hours.map((h) => (
                <div key={h.day_of_week} className="py-2 flex items-center justify-between">
                  <span className="font-semibold text-slate-700">{DAY_NAMES[h.day_of_week]}</span>
                  {h.is_closed ? (
                    <span className="text-slate-400 italic font-medium">Closed</span>
                  ) : (
                    <span className="font-mono text-slate-800 text-[11px]">
                      {h.open_time?.slice(0, 5)} - {h.close_time?.slice(0, 5)}
                    </span>
                  )}
                </div>
              ))}
            </div>
          </Card>

          {/* Contact & Location Info */}
          <Card className="space-y-4 p-5">
            <h3 className="text-sm font-bold text-slate-900 pb-2 border-b border-slate-100">
              Venue Location & Contact
            </h3>

            <div className="space-y-3 text-xs">
              <div className="flex items-start gap-2.5 text-slate-600">
                <MapPin className="w-4 h-4 text-slate-400 shrink-0 mt-0.5" />
                <span>
                  {[venue.address_line_1, venue.address_line_2, venue.city, venue.district, venue.postal_code]
                    .filter(Boolean)
                    .join(', ') || 'Address not available'}
                </span>
              </div>

              {venue.phone && (
                <div className="flex items-center gap-2.5 text-slate-600">
                  <Phone className="w-4 h-4 text-slate-400 shrink-0" />
                  <span className="font-medium">{venue.phone}</span>
                </div>
              )}

              {venue.email && (
                <div className="flex items-center gap-2.5 text-slate-600">
                  <Mail className="w-4 h-4 text-slate-400 shrink-0" />
                  <span className="font-medium">{venue.email}</span>
                </div>
              )}
            </div>
          </Card>

          {/* Booking Notice */}
          <div className="p-4 rounded-2xl bg-sky-50/70 border border-sky-200/80 text-sky-900 text-xs leading-relaxed">
            <div className="font-bold flex items-center gap-1.5 text-sky-800 mb-1">
              <Sparkles className="w-4 h-4 text-sports-accent" />
              <span>Booking Integration Phase</span>
            </div>
            Direct online reservation confirmation and slot checkout will be enabled in the upcoming Booking Engine phase.
          </div>
        </div>
      </div>
    </div>
  );
}
