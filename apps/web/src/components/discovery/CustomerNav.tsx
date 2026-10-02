'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { Button } from '@/components/ui/Button';
import { Badge } from '@/components/ui/Badge';
import {
  Compass,
  MapPin,
  Calendar,
  User,
  Menu,
  X,
  Dumbbell,
  Shield,
  Building2,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import type { AuthUser, Profile, AppRole } from '@sportshub/types';

interface CustomerNavProps {
  user?: AuthUser | null;
  profile?: Profile | null;
  role?: AppRole | null;
}

export function CustomerNav({ user, profile, role }: CustomerNavProps) {
  const pathname = usePathname();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  const navLinks = [
    { name: 'Home', href: '/', exact: true },
    { name: 'Discover', href: '/search', exact: false },
    { name: 'Venues', href: '/venues', exact: false },
    { name: 'My Bookings', href: '/customer/bookings', exact: false },
  ];

  return (
    <header className="sticky top-0 z-40 bg-white/95 backdrop-blur-md border-b border-slate-200/80 shadow-xs">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16">
          {/* Brand Logo */}
          <div className="flex items-center gap-6">
            <Link href="/" className="flex items-center gap-2.5">
              <div className="w-9 h-9 rounded-xl bg-sports-navy text-white flex items-center justify-center font-black shadow-md shadow-sports-navy/20">
                <Dumbbell className="w-5 h-5 text-sports-accent" />
              </div>
              <div className="flex flex-col">
                <span className="text-base font-black tracking-tight text-slate-900 leading-none">
                  Sports<span className="text-sports-navy">Hub</span>
                </span>
                <span className="text-[9px] uppercase tracking-widest text-slate-400 font-bold mt-0.5">
                  Play & Discover
                </span>
              </div>
            </Link>

            {/* Desktop Navigation Links */}
            <nav className="hidden md:flex items-center gap-1">
              {navLinks.map((link) => {
                const isActive = link.exact
                  ? pathname === link.href
                  : pathname.startsWith(link.href);

                return (
                  <Link
                    key={link.href}
                    href={link.href}
                    className={cn(
                      'px-3.5 py-2 rounded-xl text-xs font-bold transition-all',
                      isActive
                        ? 'bg-slate-100 text-sports-navy font-black'
                        : 'text-slate-600 hover:text-slate-900 hover:bg-slate-50'
                    )}
                  >
                    {link.name}
                  </Link>
                );
              })}
            </nav>
          </div>

          {/* Right Section / Auth Controls */}
          <div className="hidden md:flex items-center gap-3">
            {user ? (
              <div className="flex items-center gap-3">
                {role && (role === 'OWNER' || role === 'MANAGER' || role === 'SUPER_ADMIN') && (
                  <Link href="/owner">
                    <Button variant="outline" size="sm" className="text-xs flex items-center gap-1.5 h-8">
                      <Building2 className="w-3.5 h-3.5 text-sports-navy" />
                      <span>Owner Portal</span>
                    </Button>
                  </Link>
                )}

                <Link href="/customer">
                  <Button size="sm" className="bg-sports-navy text-white text-xs flex items-center gap-1.5 h-8 shadow-xs">
                    <User className="w-3.5 h-3.5" />
                    <span>{profile?.full_name || 'My Profile'}</span>
                  </Button>
                </Link>
              </div>
            ) : (
              <div className="flex items-center gap-2">
                <Link href="/login">
                  <Button variant="ghost" size="sm" className="text-xs font-bold text-slate-700">
                    Sign In
                  </Button>
                </Link>

                <Link href="/register">
                  <Button size="sm" className="bg-sports-navy text-white text-xs font-bold shadow-xs">
                    Register
                  </Button>
                </Link>
              </div>
            )}
          </div>

          {/* Mobile Menu Toggle Button */}
          <div className="md:hidden flex items-center gap-2">
            <button
              type="button"
              onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
              className="p-2 rounded-xl text-slate-600 hover:text-slate-900 hover:bg-slate-100"
            >
              {mobileMenuOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
            </button>
          </div>
        </div>
      </div>

      {/* Mobile Navigation Dropdown */}
      {mobileMenuOpen && (
        <div className="md:hidden border-t border-slate-100 bg-white px-4 pt-3 pb-6 space-y-3">
          <nav className="flex flex-col gap-1">
            {navLinks.map((link) => {
              const isActive = link.exact
                ? pathname === link.href
                : pathname.startsWith(link.href);

              return (
                <Link
                  key={link.href}
                  href={link.href}
                  onClick={() => setMobileMenuOpen(false)}
                  className={cn(
                    'px-3.5 py-2.5 rounded-xl text-xs font-bold transition-all',
                    isActive
                      ? 'bg-slate-100 text-sports-navy font-black'
                      : 'text-slate-600 hover:text-slate-900'
                  )}
                >
                  {link.name}
                </Link>
              );
            })}
          </nav>

          <div className="pt-3 border-t border-slate-100 flex flex-col gap-2">
            {user ? (
              <>
                {role && (role === 'OWNER' || role === 'MANAGER' || role === 'SUPER_ADMIN') && (
                  <Link href="/owner" onClick={() => setMobileMenuOpen(false)}>
                    <Button variant="outline" size="sm" className="w-full text-xs flex items-center justify-center gap-1.5">
                      <Building2 className="w-3.5 h-3.5" />
                      <span>Owner Portal</span>
                    </Button>
                  </Link>
                )}
                <Link href="/customer" onClick={() => setMobileMenuOpen(false)}>
                  <Button size="sm" className="w-full bg-sports-navy text-white text-xs flex items-center justify-center gap-1.5">
                    <User className="w-3.5 h-3.5" />
                    <span>My Profile</span>
                  </Button>
                </Link>
              </>
            ) : (
              <div className="grid grid-cols-2 gap-2">
                <Link href="/login" onClick={() => setMobileMenuOpen(false)}>
                  <Button variant="outline" size="sm" className="w-full text-xs">
                    Sign In
                  </Button>
                </Link>
                <Link href="/register" onClick={() => setMobileMenuOpen(false)}>
                  <Button size="sm" className="w-full bg-sports-navy text-white text-xs">
                    Register
                  </Button>
                </Link>
              </div>
            )}
          </div>
        </div>
      )}
    </header>
  );
}
