'use client';

import React from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Badge } from '@/components/ui/Badge';
import { MapPin, ChevronLeft, ChevronRight, RotateCcw, Clock, ArrowRight, CheckCircle2 } from 'lucide-react';
import type { PublicFacilityDetail } from '@sportshub/types';

interface FacilityListProps {
  facilities: PublicFacilityDetail[];
  totalCount: number;
  currentPage: number;
  totalPages: number;
  searchQueryString?: string;
  date: string;
}

export function FacilityList({
  facilities,
  totalCount,
  currentPage,
  totalPages,
  searchQueryString = '',
  date,
}: FacilityListProps) {
  const router = useRouter();
  const searchParams = useSearchParams();

  const handlePageChange = (newPage: number) => {
    const current = new URLSearchParams(searchParams.toString());
    current.set('page', String(newPage));
    router.push(`/search?${current.toString()}`);
  };

  if (facilities.length === 0) {
    return (
      <Card className="text-center py-16 border-dashed border-2 border-slate-200">
        <div className="w-14 h-14 rounded-2xl bg-slate-100 text-slate-400 flex items-center justify-center mx-auto mb-3">
          <Clock className="w-7 h-7" />
        </div>
        <h3 className="text-base font-bold text-slate-800">No facilities available</h3>
        <p className="text-xs text-slate-500 max-w-sm mx-auto mt-1 mb-5 leading-relaxed">
          No facilities are available for your selected sport, date and time.
          Try an earlier time, later time, another facility, or another date.
        </p>
        <Button
          onClick={() => router.push('/search')}
          size="sm"
          variant="outline"
          className="inline-flex items-center gap-1.5 text-xs font-semibold"
        >
          <RotateCcw className="w-3.5 h-3.5" />
          <span>Clear All Filters</span>
        </Button>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between text-xs text-slate-500 pb-1">
        <span>
          Showing <strong>{facilities.length}</strong> of <strong>{totalCount}</strong> available slots
        </span>
      </div>

      <div className="flex flex-col gap-4">
        {facilities.map((fac) => {
          const avail = fac.availability;
          const isAvailable = avail?.is_available;
          
          let durationParams = '';
          const duration = searchParams.get('durationMinutes');
          if (duration) {
            durationParams = `&duration=${duration}`;
          }
          
          // STEP 6 booking flow route: /venues/[venueId]/facilities/[facilityId]/book
          // We pass date and time via query params if they exist in the URL
          const bookHref = `/venues/${fac.venue_id}/facilities/${fac.id}/book?date=${date}&time=${avail?.slot_start || searchParams.get('startTime')}${durationParams}`;

          return (
            <Card key={`${fac.venue_id}-${fac.id}`} className="overflow-hidden hover:border-slate-300 hover:shadow-lg transition-all duration-200 flex flex-col sm:flex-row items-stretch p-0">
              <div className="p-4 sm:p-5 flex-1 space-y-2">
                <div className="flex justify-between items-start">
                  <div>
                    <h3 className="text-base font-bold text-slate-900 leading-tight">
                      {fac.venue.name} — {fac.name}
                    </h3>
                    <p className="text-xs text-slate-500 mt-1 flex items-center gap-1">
                      <MapPin className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                      <span>{[fac.venue.city, fac.venue.district].filter(Boolean).join(', ') || 'Sri Lanka'}</span>
                    </p>
                  </div>
                  {isAvailable && (
                    <Badge variant="success" className="text-[10px] py-0.5 px-2 flex items-center gap-1 whitespace-nowrap">
                      <CheckCircle2 className="w-2.5 h-2.5 text-emerald-600" />
                      <span>Available</span>
                    </Badge>
                  )}
                  {!isAvailable && (
                    <Badge variant="warning" className="text-[10px] py-0.5 px-2 flex items-center gap-1 whitespace-nowrap">
                      <span>Not Available</span>
                    </Badge>
                  )}
                </div>

                <div className="flex flex-wrap gap-x-4 gap-y-2 text-xs text-slate-600 mt-2">
                  <div className="flex items-center gap-1 font-medium bg-slate-50 px-2 py-1 rounded-md">
                    <span className="text-slate-400">Sport:</span> 
                    <span className="text-slate-700 font-semibold">{fac.sport?.name || 'Any'}</span>
                  </div>
                  <div className="flex items-center gap-1 font-medium bg-slate-50 px-2 py-1 rounded-md">
                    <span className="text-slate-400">Date:</span> 
                    <span className="text-slate-700 font-semibold">{date}</span>
                  </div>
                  {avail?.slot_start && (
                    <div className="flex items-center gap-1 font-medium bg-slate-50 px-2 py-1 rounded-md">
                      <span className="text-slate-400">Time:</span> 
                      <span className="text-slate-700 font-semibold">{avail.slot_start.substring(0, 5)} {avail.slot_end ? `- ${avail.slot_end.substring(0, 5)}` : ''}</span>
                    </div>
                  )}
                </div>
              </div>

              <div className="bg-slate-50 p-4 sm:p-5 flex flex-row sm:flex-col items-center justify-between sm:justify-center gap-4 sm:w-48 border-t sm:border-t-0 sm:border-l border-slate-100">
                <div className="text-left sm:text-center">
                  <span className="text-[10px] text-slate-400 block uppercase tracking-wider font-semibold">
                    Price
                  </span>
                  {avail?.price_per_hour !== undefined ? (
                    <div className="text-sm font-black text-slate-900">
                      {fac.currency} {Number(avail.price_per_hour).toLocaleString()}
                    </div>
                  ) : fac.starting_price_per_hour !== null ? (
                     <div className="text-sm font-black text-slate-900">
                      <span className="text-xs font-semibold text-slate-500">From </span>
                      {fac.currency} {Number(fac.starting_price_per_hour).toLocaleString()}
                    </div>
                  ) : (
                    <div className="text-xs font-semibold text-slate-400 italic">
                      Unavailable
                    </div>
                  )}
                </div>

                <Button 
                  disabled={!isAvailable} 
                  onClick={() => router.push(bookHref)}
                  size="sm" 
                  className="bg-sports-navy text-white text-xs font-bold px-4 py-2 flex items-center gap-1 w-full justify-center shadow-xs hover:bg-sports-navy/90"
                >
                  <span>Book Now</span>
                  <ArrowRight className="w-3.5 h-3.5" />
                </Button>
              </div>
            </Card>
          );
        })}
      </div>

      {totalPages > 1 && (
        <div className="flex items-center justify-center gap-2 pt-6">
          <Button
            variant="outline"
            size="sm"
            onClick={() => handlePageChange(currentPage - 1)}
            disabled={currentPage <= 1}
          >
            <ChevronLeft className="w-3.5 h-3.5" />
            <span>Previous</span>
          </Button>
          <div className="text-xs font-semibold px-3 text-slate-600">
            {currentPage} / {totalPages}
          </div>
          <Button
            variant="outline"
            size="sm"
            onClick={() => handlePageChange(currentPage + 1)}
            disabled={currentPage >= totalPages}
          >
            <span>Next</span>
            <ChevronRight className="w-3.5 h-3.5" />
          </Button>
        </div>
      )}
    </div>
  );
}
