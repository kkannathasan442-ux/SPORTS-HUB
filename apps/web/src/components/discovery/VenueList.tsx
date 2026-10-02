'use client';

import React from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { VenueCard } from './VenueCard';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { MapPin, ChevronLeft, ChevronRight, RotateCcw } from 'lucide-react';
import type { PublicVenueSearchResult } from '@sportshub/types';

interface VenueListProps {
  venues: PublicVenueSearchResult[];
  totalCount: number;
  currentPage: number;
  totalPages: number;
  searchQueryString?: string;
}

export function VenueList({
  venues,
  totalCount,
  currentPage,
  totalPages,
  searchQueryString = '',
}: VenueListProps) {
  const router = useRouter();
  const searchParams = useSearchParams();

  const handlePageChange = (newPage: number) => {
    const current = new URLSearchParams(searchParams.toString());
    current.set('page', String(newPage));
    router.push(`/search?${current.toString()}`);
  };

  const handleReset = () => {
    router.push('/search');
  };

  if (venues.length === 0) {
    return (
      <Card className="text-center py-16 border-dashed border-2 border-slate-200">
        <div className="w-14 h-14 rounded-2xl bg-slate-100 text-slate-400 flex items-center justify-center mx-auto mb-3">
          <MapPin className="w-7 h-7" />
        </div>
        <h3 className="text-base font-bold text-slate-800">No Venues Found</h3>
        <p className="text-xs text-slate-500 max-w-sm mx-auto mt-1 mb-5 leading-relaxed">
          We couldn&apos;t find any venues matching your criteria. Try increasing your distance radius, changing your date/time, or selecting a different sport.
        </p>
        <Button
          onClick={handleReset}
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
          Showing <strong>{venues.length}</strong> of <strong>{totalCount}</strong> venues
        </span>
        {totalPages > 1 && (
          <span>
            Page {currentPage} of {totalPages}
          </span>
        )}
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-5">
        {venues.map((venue) => (
          <VenueCard
            key={venue.venue_id}
            venue={venue}
            searchQueryString={searchQueryString}
          />
        ))}
      </div>

      {/* Pagination Controls */}
      {totalPages > 1 && (
        <div className="flex items-center justify-center gap-2 pt-6">
          <Button
            variant="outline"
            size="sm"
            onClick={() => handlePageChange(currentPage - 1)}
            disabled={currentPage <= 1}
            className="text-xs flex items-center gap-1"
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
            className="text-xs flex items-center gap-1"
          >
            <span>Next</span>
            <ChevronRight className="w-3.5 h-3.5" />
          </Button>
        </div>
      )}
    </div>
  );
}
