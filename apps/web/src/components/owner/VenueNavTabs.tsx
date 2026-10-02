'use client';

import React from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import {
  Layers,
  Dumbbell,
  Clock,
  DollarSign,
  Wrench,
  Edit,
  Eye,
} from 'lucide-react';
import { cn } from '@/lib/utils';

interface VenueNavTabsProps {
  venueId: string;
  venueName: string;
  status: string;
}

export function VenueNavTabs({ venueId, venueName, status }: VenueNavTabsProps) {
  const pathname = usePathname();

  const tabs = [
    {
      name: 'Overview',
      href: `/owner/venues/${venueId}`,
      icon: Eye,
      exact: true,
    },
    {
      name: 'Sports',
      href: `/owner/venues/${venueId}/sports`,
      icon: Dumbbell,
      exact: true,
    },
    {
      name: 'Facilities',
      href: `/owner/venues/${venueId}/facilities`,
      icon: Layers,
      exact: true,
    },
    {
      name: 'Hours',
      href: `/owner/venues/${venueId}/hours`,
      icon: Clock,
      exact: true,
    },
    {
      name: 'Pricing',
      href: `/owner/venues/${venueId}/pricing`,
      icon: DollarSign,
      exact: true,
    },
    {
      name: 'Maintenance',
      href: `/owner/venues/${venueId}/maintenance`,
      icon: Wrench,
      exact: true,
    },
    {
      name: 'Edit',
      href: `/owner/venues/${venueId}/edit`,
      icon: Edit,
      exact: true,
    },
  ];

  return (
    <div className="border-b border-slate-200/80 bg-white mb-6 -mt-2 -mx-4 sm:-mx-6 px-4 sm:px-6">
      <div className="flex items-center gap-2 overflow-x-auto no-scrollbar py-2">
        {tabs.map((tab) => {
          const isActive = pathname === tab.href;
          const Icon = tab.icon;

          return (
            <Link
              key={tab.href}
              href={tab.href}
              className={cn(
                'flex items-center gap-2 px-3.5 py-2 rounded-xl text-xs font-semibold whitespace-nowrap transition-all',
                isActive
                  ? 'bg-sports-navy text-white shadow-xs'
                  : 'text-slate-600 hover:text-sports-navy hover:bg-slate-100'
              )}
            >
              <Icon className={cn('w-3.5 h-3.5', isActive ? 'text-sports-accent' : 'text-slate-400')} />
              <span>{tab.name}</span>
            </Link>
          );
        })}
      </div>
    </div>
  );
}
