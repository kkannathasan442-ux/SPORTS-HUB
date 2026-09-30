import React from 'react';
import { Container } from '@/components/ui/Container';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { Badge } from '@/components/ui/Badge';
import { INITIAL_SPORTS } from '@sportshub/config';
import {
  CalendarDays,
  Trophy,
  Users,
  Flame,
  ArrowRight,
  ShieldCheck,
  Zap,
} from 'lucide-react';
import Link from 'next/link';

export default function HomePage() {
  const sportsList = Object.values(INITIAL_SPORTS);

  return (
    <div className="space-y-16 pb-20">
      {/* Hero Section */}
      <section className="relative overflow-hidden pt-16 pb-12 sm:pt-24 sm:pb-20 bg-gradient-to-b from-white via-slate-50 to-slate-100 border-b border-slate-200/70">
        <Container className="relative z-10 text-center">
          <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full text-xs font-semibold bg-brand-50 text-brand-700 border border-brand-200 mb-6 shadow-sm">
            <Flame className="w-3.5 h-3.5 text-brand-600" />
            <span>Next-Generation Sports Platform</span>
          </div>

          <h1 className="text-4xl sm:text-6xl font-extrabold tracking-tight text-slate-900 max-w-4xl mx-auto leading-[1.15]">
            Sports<span className="text-sports-accent">Hub</span>
          </h1>

          <p className="mt-4 text-xl sm:text-2xl font-medium text-slate-700 max-w-2xl mx-auto tracking-tight">
            Book. Play. Compete. Connect.
          </p>

          <p className="mt-4 text-base sm:text-lg text-slate-500 max-w-xl mx-auto">
            The unified digital ecosystem for sports enthusiasts, venue operators, tournament managers, coaches, and communities.
          </p>

          {/* Action Buttons */}
          <div className="mt-8 flex flex-col sm:flex-row items-center justify-center gap-4">
            <Button size="lg" className="w-full sm:w-auto shadow-md">
              <span>Get Started</span>
              <ArrowRight className="w-4 h-4 ml-2" />
            </Button>
            <Button variant="outline" size="lg" className="w-full sm:w-auto">
              Explore Sports
            </Button>
          </div>

          {/* Platform Pillars */}
          <div className="mt-16 grid grid-cols-2 md:grid-cols-4 gap-4 max-w-4xl mx-auto text-left">
            <div className="p-4 rounded-lg bg-white/80 border border-slate-200/80 shadow-xs">
              <div className="text-xs font-semibold uppercase text-brand-600 tracking-wider">Book</div>
              <div className="text-sm font-semibold text-slate-800 mt-1">Instant Courts & Pitches</div>
            </div>
            <div className="p-4 rounded-lg bg-white/80 border border-slate-200/80 shadow-xs">
              <div className="text-xs font-semibold uppercase text-emerald-600 tracking-wider">Play</div>
              <div className="text-sm font-semibold text-slate-800 mt-1">Find Matchups & Slots</div>
            </div>
            <div className="p-4 rounded-lg bg-white/80 border border-slate-200/80 shadow-xs">
              <div className="text-xs font-semibold uppercase text-amber-600 tracking-wider">Compete</div>
              <div className="text-sm font-semibold text-slate-800 mt-1">Tournaments & Ratings</div>
            </div>
            <div className="p-4 rounded-lg bg-white/80 border border-slate-200/80 shadow-xs">
              <div className="text-xs font-semibold uppercase text-sky-600 tracking-wider">Connect</div>
              <div className="text-sm font-semibold text-slate-800 mt-1">Teams, Coaches & Clubs</div>
            </div>
          </div>
        </Container>
      </section>

      {/* Initial Sports Grid */}
      <section className="py-4">
        <Container>
          <div className="flex flex-col sm:flex-row sm:items-end justify-between mb-8 gap-4">
            <div>
              <Badge variant="info" className="mb-2">Multi-Sport Support</Badge>
              <h2 className="text-2xl sm:text-3xl font-bold tracking-tight text-slate-900">
                Explore Initial Sports
              </h2>
              <p className="text-sm text-slate-500 mt-1">
                Engineered for specialized sports rules, court scheduling, and custom scoring models.
              </p>
            </div>
            <span className="text-xs font-semibold text-slate-400">
              6 Core Sports Supported
            </span>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
            {sportsList.map((sport) => (
              <Card key={sport.id} hoverable className="flex flex-col justify-between">
                <div>
                  <div className="flex items-center justify-between mb-3">
                    <span className="text-xs font-bold uppercase tracking-wider text-brand-700 bg-brand-50 px-2.5 py-1 rounded-md border border-brand-100">
                      {sport.category}
                    </span>
                    <span className="text-xs text-slate-400 font-medium">
                      {sport.minPlayers} - {sport.maxPlayers} Players
                    </span>
                  </div>
                  <h3 className="text-lg font-bold text-slate-900">{sport.name}</h3>
                  <p className="text-sm text-slate-500 mt-2 leading-relaxed">
                    {sport.description}
                  </p>
                </div>
                <div className="mt-6 pt-4 border-t border-slate-100 flex items-center justify-between text-xs text-brand-600 font-semibold">
                  <span>Foundation Ready</span>
                  <span className="text-slate-400">Step 0</span>
                </div>
              </Card>
            ))}
          </div>
        </Container>
      </section>

      {/* Architecture Highlights */}
      <section className="py-8">
        <Container>
          <div className="rounded-2xl bg-sports-navy text-white p-8 sm:p-12 shadow-lg border border-slate-800">
            <div className="max-w-3xl">
              <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full text-xs font-semibold bg-brand-500/20 text-sky-300 border border-sky-400/30 mb-4">
                <ShieldCheck className="w-3.5 h-3.5" />
                <span>Enterprise Architecture</span>
              </div>
              <h2 className="text-2xl sm:text-3xl font-bold tracking-tight">
                Unified Foundation for Web and Mobile
              </h2>
              <p className="text-slate-300 mt-3 text-sm sm:text-base leading-relaxed">
                SportsHub is structured as a scalable monorepo sharing core types, configuration, validation rules, and future business APIs across Next.js and React Native Expo.
              </p>

              <div className="mt-8 grid grid-cols-1 sm:grid-cols-3 gap-4 text-left">
                <div className="bg-white/5 border border-white/10 p-4 rounded-lg">
                  <Zap className="w-5 h-5 text-sky-400 mb-2" />
                  <div className="font-semibold text-sm">Next.js App Router</div>
                  <div className="text-xs text-slate-400 mt-1">High-performance SSR & Web UI</div>
                </div>
                <div className="bg-white/5 border border-white/10 p-4 rounded-lg">
                  <Users className="w-5 h-5 text-sky-400 mb-2" />
                  <div className="font-semibold text-sm">React Native Expo</div>
                  <div className="text-xs text-slate-400 mt-1">Native iOS & Android experience</div>
                </div>
                <div className="bg-white/5 border border-white/10 p-4 rounded-lg">
                  <Trophy className="w-5 h-5 text-sky-400 mb-2" />
                  <div className="font-semibold text-sm">Shared Core Packages</div>
                  <div className="text-xs text-slate-400 mt-1">Single source of truth logic</div>
                </div>
              </div>

              <div className="mt-8 flex items-center gap-4">
                <Link
                  href="/health"
                  className="inline-flex items-center text-xs font-semibold text-sky-300 hover:text-white transition-colors"
                >
                  Verify Health Endpoint <ArrowRight className="w-3.5 h-3.5 ml-1" />
                </Link>
              </div>
            </div>
          </div>
        </Container>
      </section>
    </div>
  );
}
