'use client';

import React, { useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Badge } from '@/components/ui/Badge';
import {
  Filter,
  RotateCcw,
  DollarSign,
  MapPin,
  Sparkles,
  Layers,
  Star,
  SlidersHorizontal,
  X,
} from 'lucide-react';
import type { Sport, VenueSearchSortOption } from '@sportshub/types';

interface SearchFilterSidebarProps {
  sports: Sport[];
  appliedSportId?: string;
  appliedRadius?: number;
  appliedMinPrice?: number;
  appliedMaxPrice?: number;
  appliedAvailability?: string;
  appliedFacilityType?: string;
  appliedSort?: VenueSearchSortOption;
  currency?: string;
}

const DISTANCE_OPTIONS = [
  { value: '', label: 'Any Distance' },
  { value: '1', label: 'Within 1 km' },
  { value: '3', label: 'Within 3 km' },
  { value: '5', label: 'Within 5 km' },
  { value: '10', label: 'Within 10 km' },
  { value: '25', label: 'Within 25 km' },
];

const SORT_OPTIONS: { value: VenueSearchSortOption; label: string }[] = [
  { value: 'distance', label: 'Nearest First' },
  { value: 'price', label: 'Lowest Price' },
  { value: 'availability', label: 'Most Available Courts' },
];

export function SearchFilterSidebar({
  sports,
  appliedSportId = '',
  appliedRadius,
  appliedMinPrice,
  appliedMaxPrice,
  appliedAvailability = 'all',
  appliedFacilityType = '',
  appliedSort = 'distance',
  currency = 'LKR',
}: SearchFilterSidebarProps) {
  const router = useRouter();
  const searchParams = useSearchParams();

  const [isOpenMobile, setIsOpenMobile] = useState(false);
  const [sportId, setSportId] = useState(appliedSportId);
  const [radius, setRadius] = useState(appliedRadius ? String(appliedRadius) : '');
  const [minPrice, setMinPrice] = useState(appliedMinPrice !== undefined ? String(appliedMinPrice) : '');
  const [maxPrice, setMaxPrice] = useState(appliedMaxPrice !== undefined ? String(appliedMaxPrice) : '');
  const [availability, setAvailability] = useState(appliedAvailability);
  const [facilityType, setFacilityType] = useState(appliedFacilityType);
  const [sort, setSort] = useState<VenueSearchSortOption>(appliedSort);

  const handleApply = (e?: React.FormEvent) => {
    if (e) e.preventDefault();

    const current = new URLSearchParams(searchParams.toString());

    if (sportId) current.set('sportId', sportId);
    else current.delete('sportId');

    if (radius) current.set('radiusKm', radius);
    else current.delete('radiusKm');

    if (minPrice) current.set('minPrice', minPrice);
    else current.delete('minPrice');

    if (maxPrice) current.set('maxPrice', maxPrice);
    else current.delete('maxPrice');

    if (availability && availability !== 'all') current.set('availability', availability);
    else current.delete('availability');

    if (facilityType) current.set('facilityType', facilityType);
    else current.delete('facilityType');

    if (sort && sort !== 'distance') current.set('sort', sort);
    else current.delete('sort');

    current.set('page', '1'); // Reset to page 1

    setIsOpenMobile(false);
    router.push(`/search?${current.toString()}`);
  };

  const handleReset = () => {
    const current = new URLSearchParams(searchParams.toString());
    current.delete('sportId');
    current.delete('radiusKm');
    current.delete('minPrice');
    current.delete('maxPrice');
    current.delete('availability');
    current.delete('facilityType');
    current.delete('sort');
    current.set('page', '1');

    setSportId('');
    setRadius('');
    setMinPrice('');
    setMaxPrice('');
    setAvailability('all');
    setFacilityType('');
    setSort('distance');

    setIsOpenMobile(false);
    router.push(`/search?${current.toString()}`);
  };

  return (
    <>
      {/* Mobile Toggle Button */}
      <div className="lg:hidden mb-4">
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={() => setIsOpenMobile(true)}
          className="w-full flex items-center justify-center gap-2 text-xs font-bold py-2.5 bg-white shadow-xs"
        >
          <SlidersHorizontal className="w-4 h-4 text-sports-navy" />
          <span>Filters & Sorting</span>
          {(appliedSportId || appliedRadius || appliedMinPrice || appliedMaxPrice || appliedAvailability === 'available') && (
            <Badge variant="info" className="ml-1 text-[10px] py-0 px-1.5">
              Active
            </Badge>
          )}
        </Button>
      </div>

      {/* Filter Sidebar Container */}
      <div
        className={`${
          isOpenMobile
            ? 'fixed inset-0 z-50 bg-slate-900/50 backdrop-blur-xs flex justify-end'
            : 'hidden lg:block'
        }`}
      >
        <div
          className={`${
            isOpenMobile
              ? 'bg-white w-full max-w-sm h-full p-6 overflow-y-auto shadow-2xl flex flex-col justify-between'
              : 'w-full'
          }`}
        >
          <Card className={`${isOpenMobile ? 'border-0 shadow-none p-0' : 'p-5'} space-y-6`}>
            {/* Header */}
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <div className="flex items-center gap-2">
                <Filter className="w-4 h-4 text-sports-navy" />
                <h3 className="text-sm font-bold text-slate-900">Search Filters</h3>
              </div>
              {isOpenMobile ? (
                <button
                  type="button"
                  onClick={() => setIsOpenMobile(false)}
                  className="p-1 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-100"
                >
                  <X className="w-5 h-5" />
                </button>
              ) : (
                <button
                  type="button"
                  onClick={handleReset}
                  className="text-[11px] font-semibold text-slate-400 hover:text-sports-navy flex items-center gap-1"
                  title="Reset all filters"
                >
                  <RotateCcw className="w-3 h-3" />
                  <span>Reset</span>
                </button>
              )}
            </div>

            <form onSubmit={handleApply} className="space-y-5">
              {/* Sort Order */}
              <div className="space-y-1.5">
                <label className="text-[11px] font-bold uppercase tracking-wider text-slate-700">
                  Sort By
                </label>
                <select
                  value={sort}
                  onChange={(e) => setSort(e.target.value as VenueSearchSortOption)}
                  className="w-full px-3 py-2 rounded-xl border border-slate-200 text-xs font-semibold focus:outline-none focus:ring-2 focus:ring-sports-navy bg-white"
                >
                  {SORT_OPTIONS.map((opt) => (
                    <option key={opt.value} value={opt.value}>
                      {opt.label}
                    </option>
                  ))}
                </select>
              </div>

              {/* Sport Filter */}
              <div className="space-y-1.5">
                <label className="text-[11px] font-bold uppercase tracking-wider text-slate-700">
                  Sport Discipline
                </label>
                <select
                  value={sportId}
                  onChange={(e) => setSportId(e.target.value)}
                  className="w-full px-3 py-2 rounded-xl border border-slate-200 text-xs font-semibold focus:outline-none focus:ring-2 focus:ring-sports-navy bg-white"
                >
                  <option value="">All Sports</option>
                  {sports.map((s) => (
                    <option key={s.id} value={s.id}>
                      {s.name}
                    </option>
                  ))}
                </select>
              </div>

              {/* Distance Radius */}
              <div className="space-y-1.5">
                <label className="text-[11px] font-bold uppercase tracking-wider text-slate-700 flex items-center justify-between">
                  <span>Distance Radius</span>
                  <MapPin className="w-3 h-3 text-slate-400" />
                </label>
                <select
                  value={radius}
                  onChange={(e) => setRadius(e.target.value)}
                  className="w-full px-3 py-2 rounded-xl border border-slate-200 text-xs font-semibold focus:outline-none focus:ring-2 focus:ring-sports-navy bg-white"
                >
                  {DISTANCE_OPTIONS.map((opt) => (
                    <option key={opt.value} value={opt.value}>
                      {opt.label}
                    </option>
                  ))}
                </select>
              </div>

              {/* Hourly Price Range */}
              <div className="space-y-1.5">
                <label className="text-[11px] font-bold uppercase tracking-wider text-slate-700 flex items-center justify-between">
                  <span>Price Range ({currency}/hr)</span>
                  <DollarSign className="w-3 h-3 text-slate-400" />
                </label>
                <div className="grid grid-cols-2 gap-2">
                  <input
                    type="number"
                    min="0"
                    placeholder="Min"
                    value={minPrice}
                    onChange={(e) => setMinPrice(e.target.value)}
                    className="w-full px-3 py-1.5 rounded-xl border border-slate-200 text-xs focus:outline-none focus:ring-2 focus:ring-sports-navy"
                  />
                  <input
                    type="number"
                    min="0"
                    placeholder="Max"
                    value={maxPrice}
                    onChange={(e) => setMaxPrice(e.target.value)}
                    className="w-full px-3 py-1.5 rounded-xl border border-slate-200 text-xs focus:outline-none focus:ring-2 focus:ring-sports-navy"
                  />
                </div>
              </div>

              {/* Availability Filter */}
              <div className="space-y-2 pt-1">
                <label className="text-[11px] font-bold uppercase tracking-wider text-slate-700 flex items-center justify-between">
                  <span>Availability</span>
                  <Sparkles className="w-3 h-3 text-amber-500" />
                </label>
                <div className="space-y-1 text-xs">
                  <label className="flex items-center gap-2 cursor-pointer py-1">
                    <input
                      type="radio"
                      name="availability"
                      value="all"
                      checked={availability === 'all'}
                      onChange={() => setAvailability('all')}
                      className="text-sports-navy focus:ring-sports-navy"
                    />
                    <span className="text-slate-700">Show all venues</span>
                  </label>
                  <label className="flex items-center gap-2 cursor-pointer py-1">
                    <input
                      type="radio"
                      name="availability"
                      value="available"
                      checked={availability === 'available'}
                      onChange={() => setAvailability('available')}
                      className="text-sports-navy focus:ring-sports-navy"
                    />
                    <span className="font-semibold text-emerald-700">Available courts only</span>
                  </label>
                </div>
              </div>

              {/* Facility Type Surface */}
              <div className="space-y-1.5">
                <label className="text-[11px] font-bold uppercase tracking-wider text-slate-700 flex items-center justify-between">
                  <span>Facility Surface / Type</span>
                  <Layers className="w-3 h-3 text-slate-400" />
                </label>
                <input
                  type="text"
                  placeholder="e.g. Synthetic, Turf, Wood..."
                  value={facilityType}
                  onChange={(e) => setFacilityType(e.target.value)}
                  className="w-full px-3 py-2 rounded-xl border border-slate-200 text-xs focus:outline-none focus:ring-2 focus:ring-sports-navy"
                />
              </div>

              {/* Future Filter: Ratings & Reviews (Marked unavailable as required) */}
              <div className="space-y-1 pt-1 opacity-60">
                <div className="flex items-center justify-between">
                  <label className="text-[11px] font-bold uppercase tracking-wider text-slate-500 flex items-center gap-1">
                    <Star className="w-3 h-3 text-slate-400" />
                    <span>Customer Rating</span>
                  </label>
                  <Badge variant="default" className="text-[9px] py-0 px-1.5">
                    Coming Soon
                  </Badge>
                </div>
                <p className="text-[10px] text-slate-400">
                  Verified player review ratings will be activated in an upcoming release.
                </p>
              </div>

              {/* Actions */}
              <div className="pt-3 border-t border-slate-100 flex items-center gap-2">
                <Button
                  type="submit"
                  size="sm"
                  className="w-full bg-sports-navy text-white text-xs font-bold py-2 shadow-xs"
                >
                  Apply Filters
                </Button>
                {isOpenMobile && (
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={handleReset}
                    className="w-1/3 text-xs"
                  >
                    Reset
                  </Button>
                )}
              </div>
            </form>
          </Card>
        </div>
      </div>
    </>
  );
}
