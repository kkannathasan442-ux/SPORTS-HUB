'use client';

import React from 'react';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { List, Map as MapIcon, MapPin, ExternalLink } from 'lucide-react';
import type { PublicVenueSearchResult } from '@sportshub/types';
import Link from 'next/link';

interface MapListToggleProps {
  viewMode: 'list' | 'map';
  onViewChange: (mode: 'list' | 'map') => void;
  venues: PublicVenueSearchResult[];
}

export function MapListToggle({ viewMode, onViewChange }: MapListToggleProps) {
  return (
    <div className="bg-slate-200/80 p-1 rounded-xl flex items-center gap-1 shadow-inner">
      <button
        type="button"
        data-testid="list-view-toggle"
        aria-label="Switch to List View"
        onClick={() => onViewChange('list')}
        className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${
          viewMode === 'list'
            ? 'bg-white text-sports-navy shadow-xs'
            : 'text-slate-600 hover:text-sports-navy'
        }`}
      >
        <List className="w-3.5 h-3.5" />
        <span>List View</span>
      </button>

      <button
        type="button"
        data-testid="map-view-toggle"
        aria-label="Switch to Map View"
        onClick={() => onViewChange('map')}
        className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${
          viewMode === 'map'
            ? 'bg-white text-sports-navy shadow-xs'
            : 'text-slate-600 hover:text-sports-navy'
        }`}
      >
        <MapIcon className="w-3.5 h-3.5" />
        <span>Map View</span>
      </button>
    </div>
  );
}

export function MapFoundationView({ venues }: { venues: PublicVenueSearchResult[] }) {
  const venuesWithCoords = venues.filter((v) => v.latitude !== null && v.longitude !== null);

  return (
    <Card className="p-0 overflow-hidden border border-slate-200">
      <div className="relative w-full min-h-[500px] bg-slate-100 flex flex-col items-center justify-between p-6">
        {/* Grid Pattern Background */}
        <div
          className="absolute inset-0 opacity-40"
          style={{
            backgroundImage:
              'radial-gradient(#94a3b8 1px, transparent 1px), radial-gradient(#94a3b8 1px, #f8fafc 1px)',
            backgroundSize: '24px 24px',
            backgroundPosition: '0 0, 12px 12px',
          }}
        />

        {/* Map Foundation Header Notice */}
        <div className="relative z-10 bg-white/95 backdrop-blur-xs border border-slate-200 rounded-xl p-4 shadow-md max-w-md text-center">
          <div className="flex items-center justify-center gap-2 text-xs font-bold text-slate-800">
            <MapIcon className="w-4 h-4 text-sports-navy" />
            <span>Geographic Map Foundation</span>
          </div>
          <p className="text-[11px] text-slate-500 mt-1">
            Displaying <strong>{venuesWithCoords.length}</strong> venues with verified GPS coordinates. Interactive map tile rendering is prepared for the dedicated mapping step.
          </p>
        </div>

        {/* Map Venue Pins Showcase */}
        <div className="relative z-10 w-full max-w-4xl grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3 my-6">
          {venuesWithCoords.slice(0, 6).map((venue) => (
            <div
              key={venue.venue_id}
              className="bg-white/95 backdrop-blur-xs rounded-xl p-3.5 border border-slate-200/80 shadow-md hover:border-sports-navy transition-all flex flex-col justify-between"
            >
              <div>
                <div className="flex items-start gap-2">
                  <div className="w-6 h-6 rounded-md bg-sports-navy text-sports-accent flex items-center justify-center shrink-0">
                    <MapPin className="w-3.5 h-3.5" />
                  </div>
                  <div className="min-w-0">
                    <h4 className="text-xs font-bold text-slate-900 truncate">{venue.venue_name}</h4>
                    <p className="text-[10px] text-slate-500 truncate">{venue.city || venue.district || 'Sri Lanka'}</p>
                  </div>
                </div>
                <div className="mt-2 text-[10px] font-mono text-slate-400">
                  GPS: {venue.latitude !== null && venue.latitude !== undefined ? Number(venue.latitude).toFixed(4) : ''},{' '}
                  {venue.longitude !== null && venue.longitude !== undefined ? Number(venue.longitude).toFixed(4) : ''}
                </div>
              </div>

              <div className="mt-2.5 pt-2 border-t border-slate-100 flex items-center justify-between">
                <span className="text-[11px] font-bold text-slate-900">
                  {venue.starting_price_per_hour
                    ? `${venue.currency} ${venue.starting_price_per_hour}/hr`
                    : 'Price N/A'}
                </span>
                <Link
                  href={`/venues/${venue.venue_id}`}
                  className="text-[11px] font-bold text-sports-navy hover:underline flex items-center gap-1"
                >
                  <span>Details</span>
                  <ExternalLink className="w-2.5 h-2.5" />
                </Link>
              </div>
            </div>
          ))}
        </div>

        {/* Footer */}
        <div className="relative z-10 text-[11px] text-slate-400">
          Interactive Leaflet / Vector tiles ready for integration.
        </div>
      </div>
    </Card>
  );
}
