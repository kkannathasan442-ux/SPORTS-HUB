'use client';

import React, { useState, useEffect } from 'react';
import { DiscoverySearchBar } from './DiscoverySearchBar';
import { SearchFilterSidebar } from './SearchFilterSidebar';
import { VenueList } from './VenueList';
import { MapListToggle, MapFoundationView } from './MapListToggle';
import { Card } from '@/components/ui/Card';
import { Badge } from '@/components/ui/Badge';
import { Building2, Compass, SlidersHorizontal, MapPin } from 'lucide-react';
import type {
  DiscoverySearchResults,
  Sport,
  VenueSearchParams,
  VenueSearchSortOption,
} from '@sportshub/types';

interface SearchPageViewProps {
  sports: Sport[];
  results: DiscoverySearchResults;
  appliedParams: VenueSearchParams;
}

export function SearchPageView({ sports, results, appliedParams }: SearchPageViewProps) {
  const [viewMode, setViewMode] = useState<'list' | 'map'>(appliedParams.view || 'list');
  const [isHydrated, setIsHydrated] = useState(false);

  useEffect(() => {
    setIsHydrated(true);
  }, []);

  const activeSport = sports.find((s) => s.id === appliedParams.sportId);

  return (
    <div className="space-y-6" data-hydrated={isHydrated ? 'true' : 'false'}>
      {/* Top Search Controls Bar */}
      <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-xs">
        <DiscoverySearchBar
          sports={sports}
          initialSportId={appliedParams.sportId}
          initialDate={appliedParams.date}
          initialTime={appliedParams.startTime}
          initialLocation={appliedParams.locationText}
          initialLat={appliedParams.latitude}
          initialLon={appliedParams.longitude}
        />
      </div>

      {/* Main Grid: Left Filter Sidebar, Right Venue Listings */}
      <div className="grid grid-cols-1 lg:grid-cols-4 gap-6 items-start">
        {/* Left Column: Filter Sidebar */}
        <div className="lg:col-span-1">
          <SearchFilterSidebar
            sports={sports}
            appliedSportId={appliedParams.sportId}
            appliedRadius={appliedParams.radiusKm}
            appliedMinPrice={appliedParams.minPrice}
            appliedMaxPrice={appliedParams.maxPrice}
            appliedAvailability={appliedParams.availability}
            appliedFacilityType={appliedParams.facilityType}
            appliedSort={appliedParams.sort}
          />
        </div>

        {/* Right Column: Search Results Header & Listings */}
        <div className="lg:col-span-3 space-y-4">
          {/* Results Summary Bar & View Mode Toggle */}
          <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-xs flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div className="space-y-1">
              <div className="flex items-center gap-2">
                <Compass className="w-4 h-4 text-sports-navy" />
                <h1 className="text-base font-bold text-slate-900">
                  {appliedParams.locationText
                    ? `Sports Venues in "${appliedParams.locationText}"`
                    : activeSport
                    ? `${activeSport.name} Venues`
                    : 'Discover Sports Venues'}
                </h1>
              </div>

              <div className="flex flex-wrap items-center gap-2 text-xs text-slate-500">
                <span>
                  Found <strong>{results.totalCount}</strong> matching venue
                  {results.totalCount === 1 ? '' : 's'}
                </span>
                {appliedParams.radiusKm && appliedParams.latitude && (
                  <Badge variant="default" className="text-[10px] py-0.5">
                    Within {appliedParams.radiusKm} km
                  </Badge>
                )}
                {appliedParams.date && (
                  <Badge variant="default" className="text-[10px] py-0.5">
                    Date: {appliedParams.date}
                  </Badge>
                )}
                {appliedParams.startTime && (
                  <Badge variant="default" className="text-[10px] py-0.5">
                    Time: {appliedParams.startTime}
                  </Badge>
                )}
              </div>
            </div>

            {/* View Mode Toggle */}
            <MapListToggle
              viewMode={viewMode}
              onViewChange={setViewMode}
              venues={results.items}
            />
          </div>

          {/* Results Grid List (When List Mode is active) */}
          {viewMode === 'list' && (
            <VenueList
              venues={results.items}
              totalCount={results.totalCount}
              currentPage={results.page}
              totalPages={results.totalPages}
            />
          )}

          {/* Geographic Map View (When Map Mode is active) */}
          {viewMode === 'map' && <MapFoundationView venues={results.items} />}
        </div>
      </div>
    </div>
  );
}
