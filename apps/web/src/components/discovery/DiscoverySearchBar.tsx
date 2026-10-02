'use client';

import React, { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/Button';
import { Search, MapPin, Calendar, Clock, Navigation, Dumbbell } from 'lucide-react';
import type { Sport } from '@sportshub/types';

interface DiscoverySearchBarProps {
  sports: Sport[];
  initialSportId?: string;
  initialDate?: string;
  initialTime?: string;
  initialLocation?: string;
  initialRadius?: number;
  initialLat?: number;
  initialLon?: number;
  compact?: boolean;
}

export function DiscoverySearchBar({
  sports,
  initialSportId = '',
  initialDate = '',
  initialTime = '',
  initialLocation = '',
  initialRadius,
  initialLat,
  initialLon,
  compact = false,
}: DiscoverySearchBarProps) {
  const router = useRouter();

  const [sportId, setSportId] = useState(initialSportId);
  const [date, setDate] = useState(initialDate);
  const [time, setTime] = useState(initialTime);
  const [locationText, setLocationText] = useState(initialLocation);
  const [lat, setLat] = useState<number | undefined>(initialLat);
  const [lon, setLon] = useState<number | undefined>(initialLon);
  const [isLocating, setIsLocating] = useState(false);
  const [locationError, setLocationError] = useState<string | null>(null);

  // Quick Date Helpers
  const handleSetQuickDate = (daysAhead: number) => {
    const d = new Date();
    d.setDate(d.getDate() + daysAhead);
    const yyyy = d.getFullYear();
    const mm = String(d.getMonth() + 1).padStart(2, '0');
    const dd = String(d.getDate()).padStart(2, '0');
    setDate(`${yyyy}-${mm}-${dd}`);
  };

  // Browser Geolocation on click
  const handleUseCurrentLocation = () => {
    setLocationError(null);
    if (!navigator.geolocation) {
      setLocationError('Geolocation is not supported by your browser.');
      return;
    }

    setIsLocating(true);
    navigator.geolocation.getCurrentPosition(
      (position) => {
        setLat(position.coords.latitude);
        setLon(position.coords.longitude);
        setLocationText('Near My Current Location');
        setIsLocating(false);
      },
      (error) => {
        setIsLocating(false);
        if (error.code === error.PERMISSION_DENIED) {
          setLocationError('Location permission denied. Please type your city or area.');
        } else {
          setLocationError('Unable to retrieve location. Please type your location.');
        }
      },
      { timeout: 10000, enableHighAccuracy: false }
    );
  };

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();

    const query = new URLSearchParams();
    if (sportId) query.set('sportId', sportId);
    if (date) query.set('date', date);
    if (time) query.set('startTime', time);
    if (locationText && locationText !== 'Near My Current Location') {
      query.set('locationText', locationText);
    }
    if (lat !== undefined && lon !== undefined && locationText === 'Near My Current Location') {
      query.set('latitude', String(lat));
      query.set('longitude', String(lon));
      query.set('radiusKm', String(initialRadius || 10));
    }

    router.push(`/search?${query.toString()}`);
  };

  return (
    <div className={`w-full ${compact ? '' : 'max-w-5xl mx-auto'}`}>
      <form
        onSubmit={handleSearch}
        className={`bg-white rounded-2xl shadow-xl border border-slate-200/80 p-3 sm:p-4 ${
          compact ? 'space-y-3' : 'space-y-4'
        }`}
      >
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
          {/* Sport Selector */}
          <div className="space-y-1">
            <label className="text-[11px] font-bold uppercase tracking-wider text-slate-500 flex items-center gap-1.5">
              <Dumbbell className="w-3.5 h-3.5 text-sports-navy" />
              <span>Sport</span>
            </label>
            <select
              value={sportId}
              onChange={(e) => setSportId(e.target.value)}
              className="w-full px-3 py-2.5 rounded-xl border border-slate-200 text-xs font-semibold focus:outline-none focus:ring-2 focus:ring-sports-navy bg-slate-50/50 hover:bg-white transition-colors"
            >
              <option value="">All Sports</option>
              {sports.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.name}
                </option>
              ))}
            </select>
          </div>

          {/* Location Input with Geolocation button */}
          <div className="space-y-1">
            <div className="flex items-center justify-between">
              <label className="text-[11px] font-bold uppercase tracking-wider text-slate-500 flex items-center gap-1.5">
                <MapPin className="w-3.5 h-3.5 text-sports-navy" />
                <span>Location</span>
              </label>
              <button
                type="button"
                onClick={handleUseCurrentLocation}
                disabled={isLocating}
                className="text-[10px] font-bold text-sports-accent hover:underline flex items-center gap-1 cursor-pointer"
                title="Use browser GPS"
              >
                <Navigation className="w-2.5 h-2.5" />
                <span>{isLocating ? 'Locating...' : 'Near Me'}</span>
              </button>
            </div>
            <div className="relative">
              <input
                type="text"
                value={locationText}
                onChange={(e) => {
                  setLocationText(e.target.value);
                  if (lat !== undefined) {
                    setLat(undefined);
                    setLon(undefined);
                  }
                }}
                placeholder="City, town, or area..."
                className="w-full px-3 py-2.5 rounded-xl border border-slate-200 text-xs font-semibold focus:outline-none focus:ring-2 focus:ring-sports-navy bg-slate-50/50 hover:bg-white transition-colors"
              />
            </div>
          </div>

          {/* Date Picker */}
          <div className="space-y-1">
            <div className="flex items-center justify-between">
              <label className="text-[11px] font-bold uppercase tracking-wider text-slate-500 flex items-center gap-1.5">
                <Calendar className="w-3.5 h-3.5 text-sports-navy" />
                <span>Date</span>
              </label>
              <div className="flex items-center gap-1.5">
                <button
                  type="button"
                  onClick={() => handleSetQuickDate(0)}
                  className="text-[10px] font-semibold text-slate-500 hover:text-sports-navy px-1 rounded hover:bg-slate-100"
                >
                  Today
                </button>
                <span className="text-[10px] text-slate-300">•</span>
                <button
                  type="button"
                  onClick={() => handleSetQuickDate(1)}
                  className="text-[10px] font-semibold text-slate-500 hover:text-sports-navy px-1 rounded hover:bg-slate-100"
                >
                  Tomorrow
                </button>
              </div>
            </div>
            <input
              type="date"
              value={date}
              onChange={(e) => setDate(e.target.value)}
              className="w-full px-3 py-2.5 rounded-xl border border-slate-200 text-xs font-semibold focus:outline-none focus:ring-2 focus:ring-sports-navy bg-slate-50/50 hover:bg-white transition-colors"
            />
          </div>

          {/* Time Selector */}
          <div className="space-y-1">
            <label className="text-[11px] font-bold uppercase tracking-wider text-slate-500 flex items-center gap-1.5">
              <Clock className="w-3.5 h-3.5 text-sports-navy" />
              <span>Time</span>
            </label>
            <input
              type="time"
              value={time}
              onChange={(e) => setTime(e.target.value)}
              className="w-full px-3 py-2.5 rounded-xl border border-slate-200 text-xs font-semibold focus:outline-none focus:ring-2 focus:ring-sports-navy bg-slate-50/50 hover:bg-white transition-colors font-mono"
            />
          </div>
        </div>

        {locationError && (
          <p className="text-[11px] text-rose-600 bg-rose-50 px-3 py-1.5 rounded-lg border border-rose-200">
            {locationError}
          </p>
        )}

        <div className="flex items-center justify-between pt-1">
          <div className="hidden sm:flex items-center gap-2 text-[11px] text-slate-400">
            <span>Popular sports:</span>
            {sports.slice(0, 4).map((s) => (
              <button
                key={s.id}
                type="button"
                onClick={() => setSportId(s.id)}
                className="hover:text-sports-navy font-medium underline underline-offset-2"
              >
                {s.name}
              </button>
            ))}
          </div>

          <Button
            type="submit"
            size="md"
            className="w-full sm:w-auto px-8 bg-sports-navy text-white hover:bg-sports-navy/90 shadow-md flex items-center justify-center gap-2 text-xs font-bold"
          >
            <Search className="w-4 h-4 text-sports-accent" />
            <span>Search Venues</span>
          </Button>
        </div>
      </form>
    </div>
  );
}
