import React from 'react';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { createSupabaseServerClient } from '@/lib/supabase/server';
import { Container } from '@/components/ui/Container';
import { PageHeader } from '@/components/ui/PageHeader';
import { Badge } from '@/components/ui/Badge';
import { BookingSlotPicker } from '@/components/bookings/BookingSlotPicker';
import { ChevronRight, MapPin, Trophy, ShieldCheck } from 'lucide-react';

interface BookFacilityPageProps {
  params: {
    venueId: string;
    facilityId: string;
  };
  searchParams?: {
    date?: string;
  };
}

export default async function BookFacilityPage({ params, searchParams }: BookFacilityPageProps) {
  const supabase = await createSupabaseServerClient();

  // Fetch facility & venue details
  const { data: facility, error } = await supabase
    .from('facilities')
    .select(`
      id,
      venue_id,
      sport_id,
      name,
      slug,
      description,
      facility_type,
      capacity,
      status,
      is_bookable,
      buffer_minutes,
      default_duration_minutes,
      venues (
        id,
        name,
        slug,
        address_line_1,
        city,
        phone,
        status,
        currency
      ),
      sports (
        id,
        name,
        icon_name
      )
    `)
    .eq('id', params.facilityId)
    .single();

  if (error || !facility) {
    notFound();
  }

  const venue = Array.isArray(facility.venues) ? facility.venues[0] : facility.venues;
  if (!venue || venue.status !== 'ACTIVE') {
    notFound();
  }

  const sport = Array.isArray(facility.sports) ? facility.sports[0] : facility.sports;

  return (
    <div className="min-h-screen bg-slate-50/60 pb-16">
      {/* Breadcrumb Navigation */}
      <div className="bg-white border-b border-slate-200">
        <Container className="py-3">
          <nav className="flex items-center space-x-2 text-xs font-medium text-slate-500 overflow-x-auto whitespace-nowrap">
            <Link href="/" className="hover:text-slate-900 transition-colors">Home</Link>
            <ChevronRight className="w-3.5 h-3.5 text-slate-400 shrink-0" />
            <Link href="/venues" className="hover:text-slate-900 transition-colors">Venues</Link>
            <ChevronRight className="w-3.5 h-3.5 text-slate-400 shrink-0" />
            <Link href={`/venues/${venue.id}`} className="hover:text-slate-900 transition-colors">{venue.name}</Link>
            <ChevronRight className="w-3.5 h-3.5 text-slate-400 shrink-0" />
            <span className="text-slate-900 font-semibold">{facility.name}</span>
            <ChevronRight className="w-3.5 h-3.5 text-slate-400 shrink-0" />
            <span className="text-emerald-700 font-bold">Reserve Slot</span>
          </nav>
        </Container>
      </div>

      <Container className="py-8">
        {/* Header Title with Venue Info */}
        <div className="mb-8">
          <div className="flex flex-wrap items-center gap-2 mb-2">
            <Badge variant="success" className="bg-emerald-100 text-emerald-800 border-emerald-200 font-bold text-xs uppercase tracking-wider">
              Instant Online Booking
            </Badge>
            {sport && (
              <Badge variant="info" className="bg-slate-100 text-slate-800 border-slate-200 font-semibold text-xs">
                {sport.name}
              </Badge>
            )}
            <Badge variant="outline" className="text-slate-600 text-xs">
              {facility.facility_type || 'Standard Court'}
            </Badge>
          </div>

          <h1 className="text-3xl font-extrabold text-slate-900 tracking-tight">
            Reserve {facility.name}
          </h1>
          <p className="text-slate-600 text-sm mt-1 flex items-center gap-2">
            <MapPin className="w-4 h-4 text-slate-400 shrink-0" />
            <span>{venue.name} — {venue.address_line_1 ? `${venue.address_line_1}, ` : ''}{venue.city || ''}</span>
          </p>
        </div>

        {/* Main Slot Picker & Reservation Flow */}
        <BookingSlotPicker
          venue={{
            id: venue.id,
            name: venue.name,
            slug: venue.slug,
            city: venue.city,
            currency: venue.currency || 'LKR',
            address_line_1: venue.address_line_1,
          }}
          facility={{
            id: facility.id,
            name: facility.name,
            slug: facility.slug,
            facility_type: facility.facility_type,
            capacity: facility.capacity || 4,
            default_duration_minutes: facility.default_duration_minutes || 60,
            buffer_minutes: facility.buffer_minutes || 0,
          }}
          sport={sport || null}
          initialDate={searchParams?.date}
        />
      </Container>
    </div>
  );
}
