import React from 'react';
import Link from 'next/link';
import { UserNav } from '@/components/auth/UserNav';
import { getCurrentUser, getCurrentProfile, getActiveOrganizationContext } from '@/lib/auth/current-user';
import { Compass, Building2, CalendarDays, LayoutDashboard } from 'lucide-react';
import { NotificationBell } from '@/components/notifications/NotificationBell';

export async function HeaderNav() {
  let user = null;
  let profile = null;
  let activeMembership = null;

  try {
    user = await getCurrentUser();
    if (user) {
      profile = await getCurrentProfile();
      const context = await getActiveOrganizationContext();
      activeMembership = context?.activeMembership || null;
    }
  } catch {
    // Gracefully handle unconfigured / offline development state
  }

  const isStaffOrOwner =
    activeMembership?.role === 'OWNER' ||
    activeMembership?.role === 'MANAGER' ||
    activeMembership?.role === 'SUPER_ADMIN';

  return (
    <nav className="flex items-center gap-2 sm:gap-6">
      {/* Primary Discovery Navigation */}
      <div className="flex items-center gap-1 sm:gap-3">
        <Link
          href="/search"
          className="text-xs font-semibold text-slate-600 hover:text-sports-navy transition-colors px-2.5 py-1.5 rounded-lg hover:bg-slate-100 flex items-center gap-1.5"
        >
          <Compass className="w-3.5 h-3.5 text-sports-accent" />
          <span>Discover</span>
        </Link>

        <Link
          href="/venues"
          className="text-xs font-semibold text-slate-600 hover:text-sports-navy transition-colors px-2.5 py-1.5 rounded-lg hover:bg-slate-100 hidden sm:flex items-center gap-1.5"
        >
          <Building2 className="w-3.5 h-3.5 text-slate-400" />
          <span>Venues</span>
        </Link>

        <Link
          href="/customer/bookings"
          className="text-xs font-semibold text-slate-600 hover:text-sports-navy transition-colors px-2.5 py-1.5 rounded-lg hover:bg-slate-100 hidden md:flex items-center gap-1.5"
        >
          <CalendarDays className="w-3.5 h-3.5 text-slate-400" />
          <span>My Bookings</span>
        </Link>

        {isStaffOrOwner && (
          <Link
            href="/owner"
            className="text-xs font-bold text-sports-navy bg-slate-100 hover:bg-slate-200 transition-colors px-2.5 py-1.5 rounded-lg flex items-center gap-1.5 border border-slate-200"
          >
            <LayoutDashboard className="w-3.5 h-3.5 text-sports-accent" />
            <span>Owner Portal</span>
          </Link>
        )}
      </div>

      <div className="h-4 w-px bg-slate-200 hidden sm:block" />

      {/* Notifications & User Status */}
      <div className="flex items-center gap-2">
        {user && <NotificationBell />}
        <UserNav
          user={user}
          profile={profile}
          activeMembership={activeMembership}
        />
      </div>
    </nav>
  );
}

