'use client';

import React from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import {
  LayoutDashboard,
  MapPin,
  Building2,
  PlusCircle,
  Ticket,
  CreditCard,
  Bell,
  BarChart3,
  Users,
  History,
  Sliders,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/Button';

export function OwnerSidebar() {
  const pathname = usePathname();

  const navItems = [
    {
      name: 'Overview',
      href: '/owner',
      icon: LayoutDashboard,
      exact: true,
    },
    {
      name: 'Reports & Analytics',
      href: '/owner/reports',
      icon: BarChart3,
      exact: false,
    },
    {
      name: 'Bookings & Holds',
      href: '/owner/bookings',
      icon: Ticket,
      exact: false,
    },
    {
      name: 'Financials & Payments',
      href: '/owner/payments',
      icon: CreditCard,
      exact: false,
    },
    {
      name: 'Notifications',
      href: '/owner/notifications',
      icon: Bell,
      exact: false,
    },
    {
      name: 'Venues & Facilities',
      href: '/owner/venues',
      icon: MapPin,
      exact: false,
    },
    {
      name: 'Team Members',
      href: '/owner/members',
      icon: Users,
      exact: false,
    },
    {
      name: 'Audit Logs',
      href: '/owner/audit-logs',
      icon: History,
      exact: false,
    },
    {
      name: 'Settings',
      href: '/owner/settings',
      icon: Sliders,
      exact: false,
    },
  ];

  return (
    <aside className="w-full md:w-64 bg-white md:min-h-[calc(100vh-8rem)] border-b md:border-b-0 md:border-r border-slate-200/80 p-4 md:p-6 shrink-0">
      <div className="space-y-6">
        <div className="hidden md:block">
          <Link href="/owner/venues/new" className="block">
            <Button size="sm" className="w-full shadow-xs flex items-center justify-center gap-2">
              <PlusCircle className="w-4 h-4" />
              <span>Add Venue</span>
            </Button>
          </Link>
        </div>

        <div>
          <div className="text-[11px] font-bold uppercase tracking-wider text-slate-400 px-3 mb-2">
            Management Portal
          </div>
          <nav className="flex md:flex-col gap-1 overflow-x-auto md:overflow-x-visible pb-2 md:pb-0">
            {navItems.map((item) => {
              const isActive = item.exact
                ? pathname === item.href
                : pathname === item.href || (item.href !== '/owner' && pathname.startsWith(item.href));

              const Icon = item.icon;

              return (
                <Link
                  key={item.href}
                  href={item.href}
                  className={cn(
                    'flex items-center gap-3 px-3 py-2 rounded-xl text-xs font-semibold transition-all whitespace-nowrap',
                    isActive
                      ? 'bg-sports-navy text-white shadow-xs'
                      : 'text-slate-600 hover:text-sports-navy hover:bg-slate-100/80'
                  )}
                >
                  <Icon className={cn('w-4 h-4', isActive ? 'text-sports-accent' : 'text-slate-400')} />
                  <span>{item.name}</span>
                </Link>
              );
            })}
          </nav>
        </div>
      </div>
    </aside>
  );
}
