'use client';

import React, { useTransition } from 'react';
import { signOutAction } from '@/lib/auth/actions';
import { Button } from '@/components/ui/Button';
import { LogOut, User, Shield, Loader2 } from 'lucide-react';
import Link from 'next/link';
import type { AuthUser, Profile, OrganizationMember } from '@sportshub/types';

interface UserNavProps {
  user: AuthUser | null;
  profile: Profile | null;
  activeMembership: OrganizationMember | null;
}

export function UserNav({ user, profile, activeMembership }: UserNavProps) {
  const [isPending, startTransition] = useTransition();

  if (!user) {
    return (
      <div className="flex items-center gap-3">
        <Link
          href="/login"
          className="text-xs font-semibold text-slate-700 hover:text-sports-navy transition-colors px-3 py-2 rounded-lg hover:bg-slate-100"
        >
          Sign In
        </Link>
        <Link href="/register">
          <Button size="sm" className="shadow-xs">
            Get Started
          </Button>
        </Link>
      </div>
    );
  }

  const displayName = profile?.full_name || user.email;
  const role = activeMembership?.role || 'CUSTOMER';

  const handleSignOut = () => {
    startTransition(async () => {
      await signOutAction();
    });
  };

  return (
    <div className="flex items-center gap-3">
      {/* Role Badge */}
      <span className="hidden sm:inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-bold uppercase tracking-wider bg-slate-100 text-slate-700 border border-slate-200">
        <Shield className="w-3 h-3 text-sports-accent" />
        {role}
      </span>

      {/* User Identifier */}
      <div className="flex items-center gap-2">
        <div className="w-7 h-7 rounded-full bg-sports-navy text-white flex items-center justify-center text-xs font-bold shadow-xs">
          {displayName.charAt(0).toUpperCase()}
        </div>
        <span className="text-xs font-semibold text-slate-700 max-w-[120px] truncate hidden md:inline-block">
          {displayName}
        </span>
      </div>

      {/* Sign Out Button */}
      <button
        onClick={handleSignOut}
        disabled={isPending}
        className="inline-flex items-center gap-1.5 text-xs font-medium text-slate-500 hover:text-rose-600 transition-colors p-1.5 rounded-lg hover:bg-rose-50"
        title="Sign Out"
        aria-label="Sign Out"
      >
        {isPending ? (
          <Loader2 className="w-4 h-4 animate-spin text-slate-400" />
        ) : (
          <LogOut className="w-4 h-4" />
        )}
      </button>
    </div>
  );
}
