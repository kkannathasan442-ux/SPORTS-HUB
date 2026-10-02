'use client';

import React from 'react';
import Link from 'next/link';
import { Card } from '@/components/ui/Card';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import {
  MapPin,
  Building2,
  Layers,
  Sparkles,
  ArrowRight,
  Clock,
  Wrench,
  Navigation,
} from 'lucide-react';
import type { PublicVenueSearchResult, FacilityAvailabilityStatus } from '@sportshub/types';

interface VenueCardProps {
  venue: PublicVenueSearchResult;
  searchQueryString?: string;
}

function getAvailabilityBadge(status: FacilityAvailabilityStatus, availableCount: number) {
  switch (status) {
    case 'AVAILABLE':
      return (
        <Badge variant="success" className="text-[10px] py-0.5 px-2 flex items-center gap-1">
          <Sparkles className="w-2.5 h-2.5 text-emerald-600" />
          <span>{availableCount > 0 ? `${availableCount} Available` : 'Available'}</span>
        </Badge>
      );
    case 'OUTSIDE_OPERATING_HOURS':
      return (
        <Badge variant="warning" className="text-[10px] py-0.5 px-2 flex items-center gap-1">
          <Clock className="w-2.5 h-2.5" />
          <span>Outside Hours</span>
        </Badge>
      );
    case 'MAINTENANCE':
      return (
        <Badge variant="warning" className="text-[10px] py-0.5 px-2 flex items-center gap-1">
          <Wrench className="w-2.5 h-2.5" />
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

export function VenueCard({ venue, searchQueryString = '' }: VenueCardProps) {
  const detailHref = `/venues/${venue.venue_id}${searchQueryString ? `?${searchQueryString}` : ''}`;

  return (
    <Card className="overflow-hidden hover:border-slate-300 hover:shadow-lg transition-all duration-200 flex flex-col justify-between p-0 group">
      <div>
        {/* Cover Image or Thematic Header */}
        <div className="relative h-44 w-full bg-slate-900 overflow-hidden flex items-center justify-center">
          {venue.cover_image_url ? (
            <img
              src={venue.cover_image_url}
              alt={venue.venue_name}
              className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
            />
          ) : (
            <div className="w-full h-full bg-gradient-to-br from-sports-navy via-slate-800 to-slate-900 flex flex-col items-center justify-center text-white/80 p-4">
              <Building2 className="w-10 h-10 text-sports-accent mb-2 opacity-80" />
              <span className="text-xs font-semibold text-slate-300">{venue.venue_name}</span>
            </div>
          )}

          {/* Availability Badge */}
          <div className="absolute top-3 right-3 shadow-md">
            {getAvailabilityBadge(venue.overall_availability_status, venue.available_facilities_count)}
          </div>

          {/* Distance Tag (if available) */}
          {venue.distance_km !== null && (
            <div className="absolute bottom-3 left-3 bg-black/75 backdrop-blur-xs text-white text-[11px] font-bold px-2.5 py-1 rounded-lg flex items-center gap-1">
              <Navigation className="w-3 h-3 text-sports-accent" />
              <span>{venue.distance_km} km away</span>
            </div>
          )}
        </div>

        {/* Content Body */}
        <div className="p-4 sm:p-5 space-y-3">
          <div>
            <h3 className="text-base font-bold text-slate-900 group-hover:text-sports-navy transition-colors line-clamp-1">
              {venue.venue_name}
            </h3>
            <p className="text-xs text-slate-500 mt-1 flex items-center gap-1 truncate">
              <MapPin className="w-3.5 h-3.5 text-slate-400 shrink-0" />
              <span>{[venue.city, venue.district].filter(Boolean).join(', ') || 'Sri Lanka'}</span>
            </p>
          </div>

          {/* Sports Tags */}
          <div className="flex flex-wrap gap-1.5 py-1">
            {venue.sports.slice(0, 3).map((s) => (
              <span
                key={s.id}
                className="inline-flex items-center text-[10px] font-semibold px-2 py-0.5 rounded-md bg-slate-100 text-slate-700 border border-slate-200/60"
              >
                {s.name}
              </span>
            ))}
            {venue.sports.length > 3 && (
              <span className="inline-flex items-center text-[10px] font-semibold px-1.5 py-0.5 rounded-md bg-slate-50 text-slate-500">
                +{venue.sports.length - 3}
              </span>
            )}
          </div>

          {/* Facilities Summary */}
          <div className="text-xs text-slate-500 flex items-center gap-1.5 pt-1 border-t border-slate-50">
            <Layers className="w-3.5 h-3.5 text-slate-400" />
            <span>{venue.total_facilities_count} Courts & Practice Spaces</span>
          </div>
        </div>
      </div>

      {/* Footer / CTA */}
      <div className="p-4 sm:p-5 pt-0 mt-auto border-t border-slate-100 flex items-center justify-between gap-3">
        <div>
          <span className="text-[10px] text-slate-400 block uppercase tracking-wider font-semibold">
            Hourly Rate
          </span>
          {venue.starting_price_per_hour !== null ? (
            <div className="text-sm font-black text-slate-900">
              <span className="text-xs font-semibold text-slate-500">From </span>
              {venue.currency} {Number(venue.starting_price_per_hour).toLocaleString()}
              <span className="text-[11px] font-normal text-slate-400">/hr</span>
            </div>
          ) : (
            <div className="text-xs font-semibold text-slate-400 italic">
              Price unavailable
            </div>
          )}
        </div>

        <Link href={detailHref}>
          <Button size="sm" className="bg-sports-navy text-white text-xs font-bold px-4 py-2 flex items-center gap-1 shadow-xs hover:bg-sports-navy/90">
            <span>View Venue</span>
            <ArrowRight className="w-3.5 h-3.5" />
          </Button>
        </Link>
      </div>
    </Card>
  );
}
